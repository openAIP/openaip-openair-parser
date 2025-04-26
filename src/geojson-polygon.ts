import { check } from '@placemarkio/check-geojson';
import {
    bearing as calcBearing,
    distance as calcDistance,
    kinks as checkSelfIntersections,
    featureCollection as createFeatureCollection,
    point as createPoint,
    polygon as createPolygon,
    envelope,
    area as getArea,
    rewind,
    unkinkPolygon,
} from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon, Position } from 'geojson';
import { z } from 'zod';
import { validateSchema } from './validate-schema.js';

export const GeoJsonPositionSchema = z.array(z.number());
export const GeoJsonPolygonSchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(GeoJsonPositionSchema).min(4)),
    bbox: z.array(z.number()).optional(),
});

const RemoveIntermediatePointsConfigSchema = z
    .object({ greedyVariance: z.number().int().optional() })
    .strict()
    .optional()
    .describe('Config');

/**
 * Checks if a given GeoJSON geometry is valid.
 */
export function isValid(polygonGeometry: Polygon): boolean {
    validateSchema(polygonGeometry, GeoJsonPolygonSchema, { assert: true, name: 'polygonGeometry' });

    try {
        validate(polygonGeometry);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Validates a given GeoJSON geometry. Throws an error if not valid.
 */
export function validate(polygon: Polygon): void {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });

    check(JSON.stringify(polygon));
    const selfIntersections = getSelfIntersections(polygon);

    if (selfIntersections?.length > 0) {
        throw new Error('Geometry is invalid due to self intersection');
    }
}

/**
 * Gets any self-intersections in the polygon
 */
export function getSelfIntersections(polygon: Polygon): Position[] {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });

    const polygonFeature = createPolygon(polygon.coordinates);
    const checkResult = checkSelfIntersections(polygonFeature);
    const selfIntersections: Position[] = [];
    for (const feature of checkResult.features) {
        selfIntersections.push(feature.geometry.coordinates);
    }

    return selfIntersections;
}

/**
 * Tries to fix a given GeoJSON geometry if it is invalid.
 */
export function makeValid(polygon: Polygon): Polygon {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });

    if (isValid(polygon)) {
        return polygon;
    }
    const { coordinates } = extractGeometry(polygon);

    return createFixedPolygon(coordinates);
}

/**
 * Extracts coordinates and type from GeoJSON geometry.
 */
export function extractGeometry(polygon: Polygon): { coordinates: Position[]; type: string } {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygonGeometry' });

    const { type, coordinates: wrappedCoordinates } = polygon || {};
    if (type !== 'Polygon') {
        throw new Error(`Geometry type is not 'Polygon'.`);
    }

    // coordinates are always wrapped in array
    const [coordinates] = wrappedCoordinates || [];

    return { coordinates, type };
}

/**
 * Use the largest polygon in collection as the main polygon - assumed is that all kinks are smaller in size
 * and neglectable.
 */
export function getLargestPolygon(polygons: Polygon[]): Polygon {
    validateSchema(polygons, z.array(GeoJsonPolygonSchema), { assert: true, name: 'polygons' });

    // enforce min 1 feature
    if (polygons.length === 0) {
        throw new Error('Polygons must contain at least one polygon geometry');
    }
    // the first polygon is used to compare against
    let largestPolygon: Polygon = polygons[0];
    let largestPolygonArea = getArea(polygons[0]);
    // remove the first polygon from the list if there are more than one
    if (polygons.length > 1) polygons.shift();
    // iterate over the rest of the polygons and find the largest one
    for (const polygon of polygons) {
        const area = getArea(polygon);
        if (area >= largestPolygonArea) {
            largestPolygonArea = area;
            largestPolygon = polygon;
        }
    }

    return largestPolygon;
}

/**
 * Tries to create a valid geometry without any self-intersections and holes from the input coordinates.
 * This does ALTER the geometry and will return a valid geometry instead. Depending on the size of self-intersections,
 * holes and other errors, the returned geometry may differ A LOT from the original one!
 *
 * This function only takes a list of coordinates which makes it possible to pass an invalid polygon geometry
 * and return a valid polygon geometry instead. The function requires at least three coordinates. The 4th, i.e. the
 * endpoint of the polygon, is automatically added to the list of coordinates if required.
 */
export function createFixedPolygon(coordinates: Position[], config?: { consumeDuplicateBuffer?: number }): Polygon {
    validateSchema(coordinates, z.array(GeoJsonPositionSchema).min(3), { assert: true, name: 'polygon' });
    validateSchema(
        config,
        z
            .object({ buffer: z.number().int().min(0).optional() })
            .strict()
            .optional(),
        {
            assert: true,
            name: 'config',
        }
    );

    const defaultConfig = { consumeDuplicateBuffer: 0 };
    const { consumeDuplicateBuffer } = { ...defaultConfig, ...config };

    try {
        // check if we have a closed polygon coordinates list - this is the least required constraint to create a polygon
        if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
        }
        // create a polygon feature from the coordinates
        const polygon = createPolygon([coordinates]).geometry;
        // prepare "raw" coordinates first before creating a polygon feature
        let fixedPolygon = removeDuplicatePoints(polygon, { consumeDuplicateBuffer });
        fixedPolygon = removeIntermediatePoints(fixedPolygon);
        const unkinkedFeatureCollection = unkinkPolygon(fixedPolygon) as FeatureCollection<Polygon>;
        // convert to list of polygon geometries
        const fixedPolygons = unkinkedFeatureCollection.features.map((feature) => feature.geometry);
        // make sure polygons follow the right hand rule
        const polygonsWithRightHandRule = fixedPolygons.map((polygon) => {
            return withRightHandRule(polygon);
        });

        return getLargestPolygon(polygonsWithRightHandRule);
    } catch (err) {
        /*
        Use "envelope" on edge cases that cannot be fixed with above logic. Resulting geometry will be
        completely changed but area enclosed by original airspace will be enclosed also. In case of single, dual point
        invalid polygons, this will at least return a valid geometry though it will differ the most from the original one.
         */
        try {
            const pointFeatures: Feature<Point>[] = [];
            for (const coord of coordinates) {
                pointFeatures.push(createPoint(coord));
            }
            return envelope(createFeatureCollection(pointFeatures)).geometry;
        } catch (err) {
            throw new Error(err.message);
        }
    }
}

/**
 * Ensures a polygon follows the right hand rule
 */
export function withRightHandRule(polygon: Polygon): Polygon {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });

    return rewind(polygon, { reverse: false }) as Polygon;
}

/**
 * Removes high duplicate coordinates by default. Optional can be configured to also remove a coordinate if
 * another coordinate is within a defined buffer in meters.
 */
export function removeDuplicatePoints(polygon: Polygon, config?: { consumeDuplicateBuffer?: number }): Polygon {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });
    validateSchema(
        config,
        z
            .object({ consumeDuplicateBuffer: z.number().int().min(0).optional() })
            .strict()
            .optional(),
        {
            assert: true,
            name: 'config',
        }
    );

    const defaultConfig = { consumeDuplicateBuffer: 0 };
    const { consumeDuplicateBuffer } = { ...defaultConfig, ...config };

    const coordinates = polygon.coordinates[0];
    if (coordinates.length < 4) {
        throw new Error('Polygon must at least have four coordinates');
    }

    const processed = [];
    for (const coord of coordinates) {
        const exists = processed.find((value) => {
            // distance that is allowed to be between two coordinates - if below, the coordinate is cosidered a duplicate
            const minAllowedDistance = consumeDuplicateBuffer / 1000;
            const distance = calcDistance(value, coord, { units: 'kilometers' });

            return distance <= minAllowedDistance;
        });
        if (exists == null) {
            processed.push(coord);
        }
    }
    // make sure that the last coordinate equals the first coordinate - i.e. close the polygon
    if (processed[0] !== processed[processed.length - 1]) {
        processed.push(processed[0]);
    }

    if (processed.length < 4) {
        throw new Error('The polygon dimensions are too small to create a polygon.');
    }

    return createPolygon([processed]).geometry;
}

/**
 * Takes a polygon and moves along all points and checks whether the traversed
 * path would form an overlapping line. This function will NOT remove duplicates!
 */
export function removeIntermediatePoints(polygon: Polygon, config?: { greedyVariance?: number }): Polygon {
    validateSchema(polygon, GeoJsonPolygonSchema, { assert: true, name: 'polygon' });
    validateSchema(config, RemoveIntermediatePointsConfigSchema, { assert: true, name: 'config' });

    const defaultConfig = { greedyVariance: 0 };
    const { greedyVariance } = { ...defaultConfig, ...config };

    function isIntermediateCoordinate(config: {
        coord: number[];
        coordIdx: number;
        coordinateList: number[][];
        greedyVariance: number;
    }) {
        const { coord, coordIdx, coordinateList, greedyVariance } = config;
        // remove the currently processed coordinate from the list
        const filteredList = coordinateList.filter((_: any, idx: number) => idx !== coordIdx);
        for (let i = 0; i < filteredList.length; i++) {
            const coordA = coordinateList[i];
            const coordB = coordinateList[i + 1];
            // calculate the bearing between the "coord" and the "coordA"
            const bearingA = calcBearing(coord, coordA);
            const bearingB = calcBearing(coord, coordB);
            const bearingDelta = Math.abs(bearingA - bearingB);
            if (
                bearingDelta <= 180 + greedyVariance &&
                bearingDelta >= 180 - greedyVariance &&
                coordIdx > i &&
                coordIdx > i + 1
            ) {
                return true;
            }
        }

        return false;
    }

    const coordinates = polygon.coordinates[0];
    const fixedPoints: Position[] = [];
    for (let i = 0; i < coordinates.length; i++) {
        const currentCoord = coordinates[i];
        if (i === 0) {
            // always add the first coordinate
            fixedPoints.push(currentCoord);
            continue;
        }
        if (
            isIntermediateCoordinate({
                coord: currentCoord,
                coordIdx: i,
                coordinateList: coordinates,
                greedyVariance: greedyVariance,
            }) === false
        ) {
            fixedPoints.push(currentCoord);
        }
    }
    // make sure that the last coordinate equals the first coordinate - i.e. close the polygon
    if (fixedPoints[0] !== fixedPoints[fixedPoints.length - 1]) {
        fixedPoints.push(fixedPoints[0]);
    }

    return createPolygon([fixedPoints]).geometry;
}
