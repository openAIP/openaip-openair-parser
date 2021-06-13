const { polygon: createPolygon, feature: createFeature, cleanCoords } = require('@turf/turf');
const uuid = require('uuid');
const jsts = require('jsts');

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
     * @param {{validate: boolean, fix: boolean}} config
     * @return {Feature<*, {upperCeiling: null, lowerCeiling: null, name: null, class: null}>}
     */
    asGeoJson(config) {
        const { validate, fix } = config || { validate: false, fix: false };

        const properties = {
            name: this.name,
            class: this.class,
            upperCeiling: this.upperCeiling,
            lowerCeiling: this.lowerCeiling,
        };
        let polygon = cleanCoords(createPolygon([this.coordinates]));

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
                const { lineNumber } = this.consumedTokens[0].getTokenized();
                throw new Error(`Geometry of airspace ${this.name} starting on line ${lineNumber} is invalid`);
            }
        }

        return createFeature(polygon.geometry, properties, { id: uuid.v4() });
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
