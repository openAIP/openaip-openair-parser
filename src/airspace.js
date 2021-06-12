const { polygon: createPolygon, feature: createFeature } = require('@turf/turf');
const uuid = require('uuid');

class Airspace {
    constructor() {
        this.name = null;
        this.class = null;
        this.upperCeiling = null;
        this.lowerCeiling = null;
        this.coordinates = [];
    }

    asGeoJson() {
        const properties = {
            name: this.name,
            class: this.class,
            upperCeiling: this.upperCeiling,
            lowerCeiling: this.lowerCeiling,
        };
        const polygon = createPolygon([this.coordinates]);

        return createFeature(polygon.geometry, properties, { id: uuid.v4() });
    }
}

module.exports = Airspace;
