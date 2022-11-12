const {
    lineString: createLinestring,
    feature: createFeature,
    area: getArea,
    distance,
    lineToPolygon,
    envelope,
    polygon: createPolygon,
    point: createPoint,
    featureCollection: createFeatureCollection,
    unkinkPolygon,
} = require('@turf/turf');
const uuid = require('uuid');
const jsts = require('jsts');
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
     * @param {Object} config
     * @param {boolean} config.validateGeometry
     * @param {boolean} config.fixGeometry
     * @param {boolean} config.includeOpenair
     * @return {Feature<*, {upperCeiling: null, lowerCeiling: null, name: null, class: null}>}
     */
    asGeoJson(config) {
        const { validateGeometry, fixGeometry, includeOpenair } = {
            ...{ validateGeometry: false, fixGeometry: false, includeOpenair: false },
            ...config,
        };

        if (
            // directly error out on definitions with only 2 points or less
            this.coordinates.length <= 2 ||
            // if 3 points are given and the last point does NOT equal first point, a polygon geometry could be
            // created if "fix geometry" is true, otherwise error out
            (this.coordinates.length === 3 && this.coordinates[0].join(', ') === this.coordinates[2].join(', '))
        ) {
            const acToken = this.consumedTokens.shift();
            const { lineNumber } = acToken.getTokenized();

            throw new ParserError({
                lineNumber,
                errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} has insufficient number of coordinates: ${this.coordinates.length}`,
                geometry: this.getGeometryAsLineString(),
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

        let lineNumber;
        let airspacePolygon;
        // build airspace from current coordinates => this variable may be updated with an updated/fixed geometry if required
        try {
            airspacePolygon = this.getPolygonFeature();
        } catch (e) {
            // Geometry creation errors may happen here already as it is NOT possible to create certain invalid
            //  polygon geometries, i.e. too few points, start and end points do not match - if "fix geometry" flag
            // is active catch build errors and directly create a fixed polygon. In the main "fix" step below, the
            // geometry is checked for other issues like self-intersections etc and other fixes are applied.
            if (fixGeometry) {
                try {
                    airspacePolygon = this.createFixedPolygon(this.coordinates);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        const acToken = this.consumedTokens.shift();
                        const { lineNumber: lineNum } = acToken.getTokenized();
                        lineNumber = lineNum;

                        throw new ParserError({
                            lineNumber,
                            errorMessage: e.message,
                            geometry: this.getGeometryAsLineString(),
                        });
                    } else {
                        throw e;
                    }
                }
            } else {
                const { lineNumber } = this.consumedTokens[0].getTokenized();
                throw new ParserError({
                    lineNumber,
                    errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid. ${e.message}`,
                    geometry: this.getGeometryAsLineString(),
                });
            }
        }

        // only try to fix if not valid, not simple or has self-intersection
        if (fixGeometry) {
            const { isValid, isSimple, selfIntersect } = this.validateAirspaceFeature(airspacePolygon);
            // IMPORTANT only run if required since process will slightly change the original airspace by creating a buffer
            //  which will lead to an increase of polygon coordinates
            if (!isValid || !isSimple || selfIntersect) {
                try {
                    airspacePolygon = this.createFixedPolygon(this.coordinates);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        const acToken = this.consumedTokens.shift();
                        const { lineNumber: lineNum } = acToken.getTokenized();
                        lineNumber = lineNum;

                        throw new ParserError({
                            lineNumber,
                            errorMessage: e.message,
                            geometry: this.getGeometryAsLineString(),
                        });
                    } else {
                        throw e;
                    }
                }
            }
        } else {
            try {
                // create a linestring first, then polygonize it => suppresses errors where first coordinate does not equal last coordinate when creating polygon
                const linestring = createLinestring(this.coordinates);
                airspacePolygon = lineToPolygon(linestring);
            } catch (e) {
                throw new ParserError({
                    lineNumber,
                    errorMessage: e.message,
                    geometry: this.getGeometryAsLineString(),
                });
            }
        }

        if (validateGeometry) {
            // IMPORTANT work on "airspacePolygon" variable as it may contain either the original or fixed geometry
            const { isValid, isSimple, selfIntersect } = this.validateAirspaceFeature(airspacePolygon);
            if (!isValid || !isSimple || selfIntersect) {
                if (selfIntersect) {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid due to a self intersection`,
                        geometry: this.getGeometryAsLineString(),
                    });
                } else {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new ParserError({
                        lineNumber,
                        errorMessage: `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid`,
                        geometry: this.getGeometryAsLineString(),
                    });
                }
            }
        }

        return createFeature(airspacePolygon.geometry, properties, { id: uuid.v4() });
    }

    /**
     * @param {Object} airspaceFeature
     * @return {{isValid: boolean, isSimple: boolean, selfIntersect: (Object|null)}}
     */
    validateAirspaceFeature(airspaceFeature) {
        // validate airspace geometry
        let isValid = this.isValid(airspaceFeature);
        let isSimple = this.isSimple(airspaceFeature);
        const selfIntersect = this.getSelfIntersections(airspaceFeature);

        return { isValid, isSimple, selfIntersect };
    }

    /**
     * This method is mainly intended as utility method that returns the airspace geometry to be included
     * in a parser error object.
     *
     * @returns {Object|null}
     */
    getGeometryAsLineString() {
        try {
            // return as GeoJSON line feature
            return createLinestring(this.coordinates);
        } catch (e) {
            // possible that polygon cannot be created due to too few points => return null
            return null;
        }
    }

    /**
     * @return {Object}
     */
    getPolygonFeature() {
        return createPolygon([this.coordinates]);
    }

    /**
     * Removes high proximity coordinates, i.e. removes coordinate if another coordinate is within 10 meters.
     *
     * @params {Array[]} coordinates
     * @returns {Array[]}
     * @private
     */
    removeDuplicates(coordinates) {
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
     * Tries to create a valid Polygon geometry without any self-intersections and holes from the input coordinates.
     * This does ALTER the geometry and will return a new and valid geometry instead. Depending on the size of self-intersections,
     * holes and other errors, the returned geometry may differ A LOT from the original one!
     *
     * @param {Array[]} coordinates
     * @return {*}
     * @private
     */
    createFixedPolygon(coordinates) {
        // prepare "raw" coordinates first before creating a polygon feature
        coordinates = this.removeDuplicates(coordinates);

        let polygon;
        try {
            const linestring = createLinestring(coordinates);
            polygon = lineToPolygon(linestring);
            polygon = unkinkPolygon(polygon);
            // use the largest polygon in collection as the main polygon - assumed is that all kinks are smaller in size
            // and neglectable
            const getPolygon = function (features) {
                let polygon = null;
                let polygonArea = null;
                for (const feature of features) {
                    const area = getArea(feature);

                    if (area >= polygonArea) {
                        polygonArea = area;
                        polygon = feature;
                    }
                }

                return polygon;
            };
            polygon = getPolygon(polygon.features);

            return polygon;
        } catch (e) {
            /*
            Use "envelope" on edge cases that cannot be fixed with above logic. Resulting geometry will be
            completely changed but area enclosed by original airspace will be enclosed also. In case of single, dual point
            invalid polygons, this will at least return a valid geometry though it will differ the most from the original one.
             */
            try {
                const pointFeatures = [];
                for (const coord of coordinates) {
                    pointFeatures.push(createPoint(coord));
                }
                return envelope(createFeatureCollection(pointFeatures));
            } catch (e) {
                throw new Error(e.message);
            }
        }
    }

    /**
     * @param {Object} polygonFeature
     * @return {boolean}
     * @private
     */
    isValid(polygonFeature) {
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
    isSimple(polygonFeature) {
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
    getSelfIntersections(polygonFeature) {
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
