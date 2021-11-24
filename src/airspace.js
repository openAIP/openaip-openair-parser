const {
    lineString: createLinestring,
    feature: createFeature,
    distance,
    unkinkPolygon,
    area: calculateArea,
    simplify,
    lineToPolygon,
} = require('@turf/turf');
const uuid = require('uuid');
const jsts = require('jsts/dist/jsts');
const ParserError = require('./parser-error');

/**
 * Result of a parsed airspace definition block. Can be output as GeoJSON.
 */
class Airspace {
    constructor() {
        this.consumedTokens = [];
        this.name = null;
        this.class = null;
        this.upperCeiling = null;
        this.lowerCeiling = null;
        this.coordinates = [];
    }

    /**
     * @param {{ validateGeometry: boolean, fixGeometry: boolean, includeOpenair: boolean}} config
     * @return {Feature<*, {upperCeiling: null, lowerCeiling: null, name: null, class: null}>}
     */
    asGeoJson(config) {
        const { validateGeometry, fixGeometry, includeOpenair } = Object.assign(
            { validateGeometry: false, fixGeometry: false, includeOpenair: false },
            config
        );

        // handle edge case where 3 or less coordinates are defined
        if (this.coordinates.length <= 2) {
            const acToken = this.consumedTokens.shift();
            const { lineNumber } = acToken.getTokenized();

            throw new ParserError({
                lineNumber,
                errorMessage: `Airspace definition on line ${lineNumber} has insufficient number of coordinates: ${this.coordinates.length}`,
            });
        }

        // set feature properties
        const properties = {
            name: this.name,
            class: this.class,
            upperCeiling: this.upperCeiling,
            lowerCeiling: this.lowerCeiling,
        };
        // include original OpenAIR airspace definition block
        if (includeOpenair) {
            properties.openair = '';
            for (const token of this.consumedTokens) {
                const { line } = token.getTokenized();
                properties.openair += line + '\n';
            }
        }

        let polygon;
        let lineNumber;
        if (fixGeometry) {
            try {
                polygon = this._createFixedPolygon(this.coordinates);
            } catch (e) {
                if (e instanceof SyntaxError) {
                    const acToken = this.consumedTokens.shift();
                    const { lineNumber: lineNum } = acToken.getTokenized();
                    lineNumber = lineNum;

                    throw new ParserError({ lineNumber, errorMessage: e.message });
                } else {
                    throw e;
                }
            }
        } else {
            try {
                // create a linestring first, then polygonize it => suppresses errors where first coordinate does not equal last coordinate when creating polygon
                const linestring = createLinestring(this.coordinates);
                polygon = lineToPolygon(linestring);
            } catch (e) {
                throw new ParserError({ lineNumber, errorMessage: e.message });
            }
        }

        if (validateGeometry) {
            let isValid = this._isValid(polygon);
            let isSimple = this._isSimple(polygon);
            const selfIntersect = this._getSelfIntersections(polygon);

            if (!isValid || !isSimple || selfIntersect) {
                if (selfIntersect) {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid due to a self intersection`,
                    });
                } else {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid`,
                    });
                }
            }
        }

        return createFeature(polygon.geometry, properties, { id: uuid.v4() });
    }

    /**
     * Removes high proximity coordinates, i.e. removes coordinate if another coordinate is within 200 meters.
     *
     * @params {Array[]} coordinates
     * @returns {Array[]}
     * @private
     */
    _removeDuplicates(coordinates) {
        const processed = [];
        for (const coord of coordinates) {
            const exists = processed.find((value) => {
                return distance(value, coord, { units: 'kilometers' }) < 0.001;
            });

            if (exists === undefined) {
                processed.push(coord);
            }
        }

        return processed;
    }

    /**
     * Tries to create a valid geometry without any self-intersections and holes from the input coordinates.
     * This does ALTER the geometry and will return a valid geometry instead. Depending on the size of self-intersections,
     * holes and other errors, the returned geometry may differ A LOT from the original one!
     *
     * @param {Array[]} coordinates
     * @return {*}
     * @private
     */
    _createFixedPolygon(coordinates) {
        // prepare "raw" coordinates first before creating a polygon feature
        coordinates = this._removeDuplicates(coordinates);

        let polygon;
        try {
            const linestring = createLinestring(coordinates);
            polygon = lineToPolygon(linestring);
        } catch (e) {
            // IMPORTANT handle errors on edge cases that cannot be fixed
            throw new SyntaxError(e.message);
        }
        // remove self-intersections (unkink polygon)
        const unkinkedPolygon = unkinkPolygon(polygon);

        // TODO there seems to be room for improvement here but currently there is no better way I know of
        const { features } = unkinkedPolygon;
        let fixedGeometry;
        if (unkinkedPolygon.features.length > 1) {
            // to get the "unkinked" valid geometry (without kinks), take the one with the biggest calculated area
            // in the list. This DOES NOT work for several edge cases which should not occur in normal OpenAIR files.
            let biggestArea = 0;
            for (const feature of features) {
                const area = calculateArea(feature);
                if (area >= biggestArea) {
                    biggestArea = area;
                    fixedGeometry = feature;
                }
            }
        } else {
            fixedGeometry = features.shift();
        }
        fixedGeometry = simplify(fixedGeometry, { highQuality: true, tolerance: 0.00001 });

        return fixedGeometry;
    }

    /**
     * @param {Object} polygonFeature
     * @return {boolean}
     * @private
     */
    _isValid(polygonFeature) {
        const reader = new jsts.io.GeoJSONReader();
        const jstsGeometry = reader.read(polygonFeature.geometry);
        const isValidValidator = new jsts.operation.valid.IsValidOp(jstsGeometry);

        return isValidValidator.isValid();
    }

    /**
     * @param {Object} polygonFeature
     * @return {boolean}
     * @private
     */
    _isSimple(polygonFeature) {
        const reader = new jsts.io.GeoJSONReader();
        const jstsGeometry = reader.read(polygonFeature.geometry);
        const isSimpleValidator = new jsts.operation.IsSimpleOp(jstsGeometry);

        return isSimpleValidator.isSimple();
    }

    /**
     * @param {Object} polygonFeature
     * @return {Object|null}
     * @private
     */
    _getSelfIntersections(polygonFeature) {
        const reader = new jsts.io.GeoJSONReader();
        const jstsGeometry = reader.read(polygonFeature.geometry);

        // if the geometry is already a simple linear ring, do not
        // try to find self intersection points.
        if (jstsGeometry) {
            const validator = new jsts.operation.IsSimpleOp(jstsGeometry);
            if (validator.isSimpleLinearGeometry(jstsGeometry)) {
                return;
            }

            let res = {};
            const graph = new jsts.geomgraph.GeometryGraph(0, jstsGeometry);
            const cat = new jsts.operation.valid.ConsistentAreaTester(graph);
            const r = cat.isNodeConsistentArea();
            if (!r) {
                res = cat.getInvalidPoint();
            }
            return res;
        }
    }
}

module.exports = Airspace;
