const {
    polygon: createPolygon,
    feature: createFeature,
    explode: explodePolygon,
    convex: createConvexHull,
} = require('@turf/turf');
const uuid = require('uuid');
const jsts = require('jsts');

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
        if (fixGeometry) {
            // prepare "raw" coordinates first before creating a polygon feature
            // IMPORTANT run before "_closeGeometry()" to not remove the last "closing" coordinate
            this.coordinates = this._removeDuplicates(this.coordinates);
            this.coordinates = this._closeGeometry(this.coordinates);
            // create polygon and fix geometry
            polygon = this._fixGeometry(createPolygon([this.coordinates]));
        } else {
            polygon = createPolygon([this.coordinates]);
        }

        if (validateGeometry) {
            let isValid = this._isValid(polygon);
            let isSimple = this._isSimple(polygon);
            const selfIntersect = this._getSelfIntersections(polygon);

            if (!isValid || !isSimple || selfIntersect) {
                if (selfIntersect) {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new SyntaxError(
                        `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid due to a self intersection`
                    );
                } else {
                    const { lineNumber } = this.consumedTokens[0].getTokenized();
                    throw new SyntaxError(
                        `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid`
                    );
                }
            }
        }

        return createFeature(polygon.geometry, properties, { id: uuid.v4() });
    }

    /**
     * Closes the airspace geometry, i.e. checks that start- and endpoint are the same.
     *
     * @params {Object[]} coordinates
     * @returns {Object[]}
     * @private
     */
    _closeGeometry(coordinates) {
        const first = coordinates[0];
        const last = coordinates[this.coordinates.length - 1];

        if (JSON.stringify(first) != JSON.stringify(last)) {
            coordinates.push(first);
        }

        return coordinates;
    }

    /**
     * Removes duplicate coordinates.
     *
     * @params {Object[]} coordinates
     * @returns {Object[]}
     * @private
     */
    _removeDuplicates(coordinates) {
        const processed = [];
        for (const coord of coordinates) {
            const exists = processed.find((value) => {
                return JSON.stringify(value) == JSON.stringify(coord);
            });

            if (exists === undefined) {
                processed.push(coord);
            }
        }

        return processed;
    }

    /**
     * Explodes a polygon feature into points and calculates a convex hull. This may alter the geometry but it also
     * removes most self intersections.
     *
     * @param polygonFeature
     * @return {*}
     * @private
     */
    _fixGeometry(polygonFeature) {
        const points = explodePolygon(polygonFeature);

        return createConvexHull(points);
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
