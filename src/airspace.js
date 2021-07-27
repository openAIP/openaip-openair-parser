const { polygon: createPolygon, feature: createFeature, cleanCoords } = require('@turf/turf');
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
     * @param {{validate: boolean, fix: boolean, includeOpenair: boolean}} config
     * @return {Feature<*, {upperCeiling: null, lowerCeiling: null, name: null, class: null}>}
     */
    asGeoJson(config) {
        const { validate, fix, includeOpenair } = Object.assign(
            { validate: false, fix: false, includeOpenair: false },
            config
        );

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

        // close geometry if "fix geometry" is set as option
        if (fix) this._closeGeometry();

        let polygon;
        try {
            polygon = cleanCoords(createPolygon([this.coordinates]));
        } catch (e) {
            const { lineNumber } = this.consumedTokens[0].getTokenized();
            throw new SyntaxError(
                `Geometry of airspace '${this.name}' starting on line ${lineNumber} is invalid. ${e.message}`
            );
        }

        let isValid = this._isValid(polygon);
        let isSimple = this._isSimple(polygon);

        if (fix && (!isValid || !isSimple)) {
            polygon = createFeature(this._fixGeometry(polygon));
            // IMPORTANT validate again to error out in validate step if something went wrong with fixing geometry
            isValid = this._isValid(polygon);
            isSimple = this._isSimple(polygon);
        }

        if (validate) {
            if (!isValid || !isSimple) {
                const selfIntersect = this._getSelfIntersections(polygon);
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
     * @private
     */
    _closeGeometry() {
        const first = this.coordinates[0];
        const last = this.coordinates[this.coordinates.length - 1];

        if (JSON.stringify(first) != JSON.stringify(last)) {
            this.coordinates.push(first);
        }
    }

    /**
     * @param polygonFeature
     * @return {*}
     * @private
     */
    _fixGeometry(polygonFeature) {
        const reader = new jsts.io.GeoJSONReader();
        const writer = new jsts.io.GeoJSONWriter();
        const jstsGeometry = reader.read(polygonFeature.geometry);
        const convexHull = jstsGeometry.convexHull();

        return writer.write(convexHull);
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
