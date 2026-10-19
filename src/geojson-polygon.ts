import { check } from '@placemarkio/check-geojson';
import {
    bearing as calcBearing,
    distance as calcDistance,
    kinks as checkSelfIntersections,
    convex,
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
 * Tries to create a valid geometry from the input coordinates by applying a ladder of repairs in decreasing order
 * of fidelity. This does ALTER the geometry and will return a valid geometry instead - depending on the error, the
 * returned geometry may differ A LOT from the original one! The ladder is:
 *
 * 1. Lossless preparation - close the ring, remove consecutive duplicate points and collinear intermediate points.
 * 2. If the prepared ring is already valid, it is returned unchanged.
 * 3. Revisited vertices - the ring is split at each vertex the outline passes more than once and the largest
 *    enclosed loop is kept. This interprets the "seam" encoding of an airspace with a hole (outer ring -> seam ->
 *    hole -> seam back -> outer ring) as well as degenerate spikes (a -> b -> a): the largest loop is the outer
 *    ring, the smaller loops (the hole outline, the spike) are discarded. NOTE until holes are supported, the
 *    hole area is over-included in the result - this is the closest possible single-polygon approximation.
 * 4. Self intersections - the ring is unkinked and the largest simple polygon is kept.
 * 5. Convex hull - if unkinking fails, the convex hull of all points is used.
 * 6. Envelope - the bounding box of all points as a last resort.
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

    try {
        // check if we have a closed polygon coordinates list - this is the least required constraint to create a polygon
        if (coordinates[0] !== coordinates[coordinates.length - 1]) {
            coordinates.push(coordinates[0]);
        }
        // create a polygon feature from the coordinates
        const polygon = createPolygon([coordinates]).geometry;
        // stage 1: lossless preparation - consecutive duplicates and collinear intermediate points
        let fixedPolygon = removeDuplicatePoints(polygon, { consumeDuplicateBuffer });
        fixedPolygon = removeIntermediatePoints(fixedPolygon);
        // stage 2: if the prepared ring is already valid, no fix is required - return it unchanged
        if (isValid(fixedPolygon)) {
            return withRightHandRule(fixedPolygon);
        }
        // stage 3: split the ring at revisited vertices (seam/spike encodings) and keep the largest loop - this
        // preserves the outer ring without cutting corners off it
        const preparedCoordinates = fixedPolygon.coordinates[0];
        const largestLoop = extractLargestLoop(preparedCoordinates);
        if (largestLoop !== preparedCoordinates && largestLoop.length >= 4) {
            const loopPolygon = withRightHandRule(createPolygon([largestLoop]).geometry);
            if (isValid(loopPolygon)) {
                return loopPolygon;
            }
            // the largest loop is still invalid (e.g. due to a self intersection) - continue the repair on it
            fixedPolygon = loopPolygon;
        }
        // stage 4: unkink the ring and keep the largest simple polygon
        const unkinkedFeatureCollection = unkinkPolygon(fixedPolygon) as FeatureCollection<Polygon>;
        // convert to list of polygon geometries
        const fixedPolygons = unkinkedFeatureCollection.features.map((feature) => feature.geometry);
        // make sure polygons follow the right hand rule
        const polygonsWithRightHandRule = fixedPolygons.map((polygon) => {
            return withRightHandRule(polygon);
        });
        const largestPolygon = getLargestPolygon(polygonsWithRightHandRule);
        if (isValid(largestPolygon)) {
            return largestPolygon;
        }
        // stage 5: use the convex hull of all points as a fallback
        const pointFeatures: Feature<Point>[] = [];
        for (const coord of coordinates) {
            pointFeatures.push(createPoint(coord));
        }
        const convexHullFeature = convex(createFeatureCollection(pointFeatures));
        if (convexHullFeature != null && convexHullFeature.geometry.type === 'Polygon') {
            const hullPolygon = withRightHandRule(convexHullFeature.geometry);
            if (isValid(hullPolygon)) {
                return hullPolygon;
            }
        }
        // stage 6: use the envelope (bounding box) as a last resort
        return envelope(createFeatureCollection(pointFeatures)).geometry;
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
            let errorMessage = 'Unknown error occured.';
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            throw new Error(errorMessage);
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
 * Splits a closed ring at every vertex the outline passes more than once and returns the loop that encloses the
 * largest area as a closed ring. If the ring has no revisited vertices, the input ring is returned as is (same
 * reference).
 *
 * The ring is traversed once while keeping the current path. When a vertex is reached that is already on the path,
 * the part of the path from its first visit up to now is a closed loop: it is cut out and the traversal continues
 * from that vertex. What remains at the end is the final loop. For the seam encoding of an airspace with a hole
 * (outer ring -> seam -> hole -> seam back -> outer ring) this yields the outer ring, the hole outline and the
 * degenerate seam (P -> Q -> P) - the outer ring is the largest of them. Loops with fewer than three distinct
 * vertices (spikes, seams) enclose no area and are discarded.
 */
function extractLargestLoop(ring: Position[]): Position[] {
    // work on the open ring, i.e. without the closing coordinate
    const openRing = ring.slice(0, -1);
    const toKey = (coord: Position) => `${coord[0]},${coord[1]}`;

    const loops: Position[][] = [];
    const path: Position[] = [];
    // maps a coordinate key to its index on the current path
    const pathIndex = new Map<string, number>();
    for (const coord of openRing) {
        const key = toKey(coord);
        const firstVisitIndex = pathIndex.get(key);
        if (firstVisitIndex != null) {
            // vertex is revisited - cut out the loop from its first visit up to now, keep the vertex on the path
            const loop = path.splice(firstVisitIndex + 1);
            for (const removed of loop) {
                pathIndex.delete(toKey(removed));
            }
            loops.push([coord, ...loop, coord]);
            continue;
        }
        pathIndex.set(key, path.length);
        path.push(coord);
    }
    // no revisited vertex found - ring is returned unchanged
    if (loops.length === 0) {
        return ring;
    }
    // the remaining path is the final loop
    loops.push([...path, path[0]]);

    let largestLoop: Position[] = ring;
    let largestLoopArea = 0;
    for (const loop of loops) {
        // a closed loop requires at least three distinct vertices to enclose an area
        if (loop.length < 4) continue;
        const loopArea = getArea(createPolygon([loop]));
        if (loopArea > largestLoopArea) {
            largestLoopArea = loopArea;
            largestLoop = loop;
        }
    }

    return largestLoop;
}

/**
 * Removes duplicate coordinates that directly follow each other. Optional can be configured to also remove a
 * coordinate if it is within a defined buffer in meters of the coordinate directly before it.
 *
 * IMPORTANT Only consecutive duplicates are removed. A coordinate the outline passes more than once with other
 * points in between is NOT a duplicate in the geometric sense: it is the corner of two different pairs of edges
 * and removing it replaces those edges with a chord, which alters the geometry (e.g. the seam encoding of an
 * airspace with a hole, see https://github.com/openAIP/openaip-openair-parser/issues/53).
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

    // duplicate detection buffer in kilometers
    const bufferKm = consumeDuplicateBuffer / 1000;

    // checks if two coordinates are to be considered duplicates of each other
    const isDuplicate = (a: Position, b: Position): boolean => {
        if (bufferKm === 0) {
            // with no buffer, duplicates are exact-equal points
            return a[0] === b[0] && a[1] === b[1];
        }
        // cheap bounding-box lower-bound check: if either the north-south or east-west
        // component alone already exceeds the buffer, the great-circle distance certainly
        // does too, so the expensive haversine call can be skipped (result is identical)
        const nsKm = Math.abs(a[1] - b[1]) * 110.0;
        if (nsKm > bufferKm) return false;
        const cosLat = Math.cos((Math.max(Math.abs(a[1]), Math.abs(b[1])) * Math.PI) / 180);
        const ewKm = Math.abs(a[0] - b[0]) * 111.32 * cosLat;
        if (ewKm > bufferKm) return false;
        return calcDistance(a, b, { units: 'kilometers' }) <= bufferKm;
    };

    const processed: Position[] = [];
    for (const coord of coordinates) {
        // only compare against the previous coordinate that was kept - a point is a duplicate only if it repeats
        // its direct predecessor; a point the outline revisits later is kept as it is topologically relevant
        const previous = processed[processed.length - 1];
        if (previous != null && isDuplicate(previous, coord)) {
            continue;
        }
        processed.push(coord);
    }
    // treat a last coordinate that duplicates the first coordinate as a duplicate closure - it is dropped and the
    // exact first coordinate is appended below to close the polygon
    if (processed.length >= 4 && isDuplicate(processed[0], processed[processed.length - 1]) === true) {
        processed.pop();
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
        const coordLng = coord[0];
        const coordLat = coord[1];
        // a coordinate can only be "intermediate" (collinear) between two coordinates that both
        // precede it in the list - the original `coordIdx > i && coordIdx > i + 1` guard is equivalent
        // to `i + 1 < coordIdx`, so bound the loop accordingly and skip the per-iteration array allocation
        for (let i = 0; i + 1 < coordIdx; i++) {
            const coordA = coordinateList[i];
            const coordB = coordinateList[i + 1];
            // a coordinate that equals one of the segment endpoints only touches the segment - it is NOT intermediate
            // between two other coordinates. This is essential to keep coordinates the outline revisits, e.g. the ends
            // of a seam that encodes an airspace with a hole, see
            // https://github.com/openAIP/openaip-openair-parser/issues/53
            if (
                (coordLng === coordA[0] && coordLat === coordA[1]) ||
                (coordLng === coordB[0] && coordLat === coordB[1])
            ) {
                continue;
            }
            // cheap bbox pre-check: if coord lies outside the bbox of the (coordA, coordB) segment it
            // cannot be between them, so the bearings cannot be ~180° apart - skip the costly calcBearing calls
            const minX = Math.min(coordA[0], coordB[0]);
            const maxX = Math.max(coordA[0], coordB[0]);
            const minY = Math.min(coordA[1], coordB[1]);
            const maxY = Math.max(coordA[1], coordB[1]);
            if (coordLng < minX || coordLng > maxX || coordLat < minY || coordLat > maxY) {
                continue;
            }
            // calculate the bearing between the "coord" and the "coordA" / "coordB"
            const bearingA = calcBearing(coord, coordA);
            const bearingB = calcBearing(coord, coordB);
            const bearingDelta = Math.abs(bearingA - bearingB);
            if (bearingDelta <= 180 + greedyVariance && bearingDelta >= 180 - greedyVariance) {
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
