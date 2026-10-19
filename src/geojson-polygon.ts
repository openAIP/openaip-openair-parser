import { check } from '@placemarkio/check-geojson';
import {
    booleanPointInPolygon,
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

// distance in meters by which the return path of a keyhole bridge is offset from its outbound path - well below
// the precision of OpenAir coordinates (1 second ~ 30m) but above the precision of the parser output (6 decimals)
const KEYHOLE_OFFSET_METERS = 1;
// maximum number of candidate bridges (closest vertex pairs first) that are tried per hole
const KEYHOLE_MAX_BRIDGE_CANDIDATES = 100;
const METERS_PER_DEGREE = 111320;

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

    // rings that cross the antimeridian must be checked with continuous longitudes, otherwise the edges spanning
    // the antimeridian are treated as edges that go around the whole globe and are reported as self intersections
    const rings = polygon.coordinates.map((ring) => unwrapAntimeridian(ring));
    const isUnwrapped = rings.some((ring, index) => ring !== polygon.coordinates[index]);
    const polygonFeature = createPolygon(rings);
    const checkResult = checkSelfIntersections(polygonFeature);
    const selfIntersections: Position[] = [];
    for (const feature of checkResult.features) {
        const [lon, ...rest] = feature.geometry.coordinates;
        // report intersections within the same longitude range as the input coordinates
        selfIntersections.push(isUnwrapped ? [normalizeLongitude(lon), ...rest] : feature.geometry.coordinates);
    }

    return selfIntersections;
}

/**
 * Makes the longitudes of a coordinate list continuous if it crosses the antimeridian (180/-180 longitude), i.e.
 * consecutive coordinates never differ by more than 180 degrees longitude. Longitudes of the returned coordinates may
 * be outside the -180 to 180 range, e.g. [179, 0], [-179, 0] becomes [179, 0], [181, 0]. This is required for all
 * planar geometry operations (validation, self-intersection checks, winding order, fixes) to work on geometries
 * that cross the antimeridian. If the coordinates do not cross the antimeridian, the input list is returned as is.
 */
export function unwrapAntimeridian(coordinates: Position[]): Position[] {
    validateSchema(coordinates, z.array(GeoJsonPositionSchema), { assert: true, name: 'coordinates' });

    let isCrossing = false;
    for (let i = 1; i < coordinates.length; i++) {
        if (Math.abs(coordinates[i][0] - coordinates[i - 1][0]) > 180) {
            isCrossing = true;
            break;
        }
    }
    if (isCrossing === false) {
        return coordinates;
    }

    const unwrapped: Position[] = [[...coordinates[0]]];
    for (let i = 1; i < coordinates.length; i++) {
        const [lon, ...rest] = coordinates[i];
        // keep the reference to the first coordinate for a closing coordinate - consumers compare by reference
        if (i === coordinates.length - 1 && coordinates[i] === coordinates[0]) {
            unwrapped.push(unwrapped[0]);
            continue;
        }
        let delta = lon - coordinates[i - 1][0];
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        unwrapped.push([roundCoordinate(unwrapped[i - 1][0] + delta), ...rest]);
    }
    // make sure the unwrapped coordinates overlap the -180 to 180 range
    const longitudes = unwrapped.map((coord) => coord[0]);
    const shift = Math.min(...longitudes) >= 180 ? -360 : Math.max(...longitudes) <= -180 ? 360 : 0;
    if (shift !== 0) {
        // use a set as the closing coordinate may reference the first coordinate
        for (const coord of new Set(unwrapped)) {
            coord[0] = roundCoordinate(coord[0] + shift);
        }
    }

    return unwrapped;
}

/**
 * Normalizes a longitude value to the -180 to 180 range.
 */
export function normalizeLongitude(lon: number): number {
    if (lon >= -180 && lon <= 180) {
        return lon;
    }

    return roundCoordinate((((lon % 360) + 540) % 360) - 180);
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
 * 3. Keyhole - an airspace with a hole is written in OpenAir with a "seam" (outer ring -> seam -> hole -> seam
 *    back -> outer ring) that revisits vertices. The ring is split into its loops and each loop inside the outer
 *    ring is connected to it with a bridge whose return path is offset by KEYHOLE_OFFSET_METERS. The result is a
 *    single simple polygon without revisited vertices that excludes the hole except for a hairline channel.
 * 4. Revisited vertices - the ring is split at each vertex the outline passes more than once and the largest
 *    enclosed loop is kept. Removes degenerate spikes (a -> b -> a) and, if no keyhole could be created, keeps
 *    the outer ring of a seam encoded airspace - the hole area is then over-included.
 * 5. Self intersections - the ring is unkinked and the largest simple polygon is kept.
 * 6. Convex hull - if unkinking fails, the convex hull of all points is used.
 * 7. Envelope - the bounding box of all points as a last resort.
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
    // all repair stages operate in planar space and require continuous longitudes
    coordinates = unwrapAntimeridian(coordinates);

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
        const preparedCoordinates = fixedPolygon.coordinates[0];
        // stage 3: connect holes encoded with a seam to the outer ring with an offset bridge (keyhole)
        try {
            const keyholeRing = createKeyholeRing(preparedCoordinates);
            if (keyholeRing != null) {
                const keyholePolygon = withRightHandRule(createPolygon([keyholeRing]).geometry);
                if (isValid(keyholePolygon)) {
                    return keyholePolygon;
                }
            }
        } catch (err) {
            // keyhole could not be created - continue with the next stage
        }
        // stage 4: split the ring at revisited vertices (seam/spike encodings) and keep the largest loop - this
        // preserves the outer ring without cutting corners off it
        const largestLoop = extractLargestLoop(preparedCoordinates);
        if (largestLoop !== preparedCoordinates && largestLoop.length >= 4) {
            const loopPolygon = withRightHandRule(createPolygon([largestLoop]).geometry);
            if (isValid(loopPolygon)) {
                return loopPolygon;
            }
            // the largest loop is still invalid (e.g. due to a self intersection) - continue the repair on it
            fixedPolygon = loopPolygon;
        }
        // stage 5: unkink the ring and keep the largest simple polygon
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
        // stage 6: use the convex hull of all points as a fallback
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
        // stage 7: use the envelope (bounding box) as a last resort
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
 * Splits a closed ring at every vertex the outline passes more than once and returns all loops as closed rings.
 * If the ring has no revisited vertices, a single loop is returned.
 *
 * The ring is traversed once while keeping the current path. When a vertex is reached that is already on the path,
 * the part of the path from its first visit up to now is a closed loop: it is cut out and the traversal continues
 * from that vertex. What remains at the end is the final loop. For the seam encoding of an airspace with a hole
 * (outer ring -> seam -> hole -> seam back -> outer ring) this yields the outer ring, the hole outline and the
 * degenerate seam (P -> Q -> P).
 */
function splitIntoLoops(ring: Position[]): Position[][] {
    // work on the open ring, i.e. without the closing coordinate
    const openRing = ring.slice(0, -1);
    const loops: Position[][] = [];
    const path: Position[] = [];
    // maps a coordinate key to its index on the current path
    const pathIndex = new Map<string, number>();
    for (const coord of openRing) {
        const key = toCoordinateKey(coord);
        const firstVisitIndex = pathIndex.get(key);
        if (firstVisitIndex != null) {
            // vertex is revisited - cut out the loop from its first visit up to now, keep the vertex on the path
            const loop = path.splice(firstVisitIndex + 1);
            for (const removed of loop) {
                pathIndex.delete(toCoordinateKey(removed));
            }
            loops.push([coord, ...loop, coord]);
            continue;
        }
        pathIndex.set(key, path.length);
        path.push(coord);
    }
    // the remaining path is the final loop
    loops.push([...path, path[0]]);

    return loops;
}

/**
 * Splits a closed ring at every vertex the outline passes more than once and returns the loop that encloses the
 * largest area as a closed ring. If the ring has no revisited vertices, the input ring is returned as is (same
 * reference). Loops with fewer than three distinct vertices (spikes, seams) enclose no area and are discarded.
 */
function extractLargestLoop(ring: Position[]): Position[] {
    const loops = splitIntoLoops(ring);
    // no revisited vertex found - ring is returned unchanged
    if (loops.length === 1) {
        return ring;
    }

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
 * Creates a "keyhole" ring from a closed ring that encodes holes with seams, i.e. revisits vertices. The ring is
 * split into its loops - the largest loop is the outer ring, every other loop that encloses an area must lie inside
 * the outer ring and is a hole. Each hole is connected to the outer ring with a bridge between the closest vertex
 * pair that does not cross any edge. The return path of each bridge is then offset by KEYHOLE_OFFSET_METERS into
 * the polygon so that no vertex is visited twice and the ring does not touch itself.
 *
 * Returns the closed keyhole ring or null if the ring does not encode holes or the holes cannot be connected. The
 * returned ring must still be validated.
 */
function createKeyholeRing(ring: Position[]): Position[] | null {
    const loops = splitIntoLoops(ring)
        // a closed loop requires at least three distinct vertices to enclose an area
        .filter((loop) => loop.length >= 4)
        .map((loop) => ({ loop, area: getArea(createPolygon([loop])) }))
        .filter(({ area }) => area > 0)
        .sort((a, b) => b.area - a.area)
        .map(({ loop }) => loop);
    // without at least an outer ring and a hole, there is nothing to connect
    if (loops.length < 2) {
        return null;
    }
    const [outerLoop, ...holeLoops] = loops;
    const outerPolygon = createPolygon([outerLoop]);
    const outerKeys = new Set(outerLoop.map(toCoordinateKey));
    // all rings are open rings from here on - outer ring counter-clockwise, holes clockwise
    const holes: Position[][] = [];
    for (const holeLoop of holeLoops) {
        // a hole must lie inside the outer ring - it may only touch the outer ring at shared vertices
        const unsharedVertices = holeLoop.filter((coord) => outerKeys.has(toCoordinateKey(coord)) === false);
        if (unsharedVertices.length === 0) {
            return null;
        }
        const isInside = unsharedVertices.every((coord) =>
            booleanPointInPolygon(coord, outerPolygon, { ignoreBoundary: true })
        );
        if (isInside === false) {
            return null;
        }
        holes.push(orientRing(holeLoop.slice(0, -1), false));
    }

    let keyholeRing = orientRing(outerLoop.slice(0, -1), true);
    for (let i = 0; i < holes.length; i++) {
        const hole = holes[i];
        const bridge = findBridge(keyholeRing, hole, holes.slice(i + 1));
        if (bridge == null) {
            return null;
        }
        const { ringIndex, holeIndex } = bridge;
        const bridgeStart = keyholeRing[ringIndex];
        // hole vertices starting with the bridge end
        const holeFromBridgeEnd = [...hole.slice(holeIndex), ...hole.slice(0, holeIndex)];
        // walk the bridge to the hole, around the hole and back - if the hole touches the outer ring at the bridge
        // start, the bridge has no length and only the bridge start is revisited
        const bridgedHole = isEqualPosition(bridgeStart, holeFromBridgeEnd[0])
            ? [...holeFromBridgeEnd.slice(1), bridgeStart]
            : [...holeFromBridgeEnd, holeFromBridgeEnd[0], bridgeStart];
        keyholeRing = [...keyholeRing.slice(0, ringIndex + 1), ...bridgedHole, ...keyholeRing.slice(ringIndex + 1)];
    }

    return offsetRevisitedVertices(keyholeRing);
}

/**
 * Finds the closest pair of a vertex of the (open) ring and a vertex of the (open) hole whose connecting segment does
 * not cross any edge of the ring, the hole or the remaining holes. Vertices that are already visited more than once
 * in the ring, i.e. the ends of previously created bridges, are not used as bridge start.
 */
function findBridge(
    ring: Position[],
    hole: Position[],
    remainingHoles: Position[][]
): { ringIndex: number; holeIndex: number } | null {
    const ringKeyCounts = new Map<string, number>();
    for (const coord of ring) {
        const key = toCoordinateKey(coord);
        ringKeyCounts.set(key, (ringKeyCounts.get(key) ?? 0) + 1);
    }
    const candidates: { ringIndex: number; holeIndex: number; distance: number }[] = [];
    for (let ringIndex = 0; ringIndex < ring.length; ringIndex++) {
        if ((ringKeyCounts.get(toCoordinateKey(ring[ringIndex])) ?? 0) > 1) continue;
        for (let holeIndex = 0; holeIndex < hole.length; holeIndex++) {
            candidates.push({ ringIndex, holeIndex, distance: getPlanarDistance(ring[ringIndex], hole[holeIndex]) });
        }
    }
    candidates.sort((a, b) => a.distance - b.distance);

    const edges = [ring, hole, ...remainingHoles].flatMap((openRing) => getRingEdges(openRing));
    for (const candidate of candidates.slice(0, KEYHOLE_MAX_BRIDGE_CANDIDATES)) {
        const bridgeStart = ring[candidate.ringIndex];
        const bridgeEnd = hole[candidate.holeIndex];
        // a bridge without length (hole touches the ring) cannot cross anything
        if (isEqualPosition(bridgeStart, bridgeEnd)) {
            return candidate;
        }
        const crossesEdge = edges.some(([edgeStart, edgeEnd]) => {
            // edges connected to the bridge ends touch the bridge by definition
            const isConnected = [edgeStart, edgeEnd].some(
                (coord) => isEqualPosition(coord, bridgeStart) || isEqualPosition(coord, bridgeEnd)
            );
            return isConnected === false && segmentsIntersect(bridgeStart, bridgeEnd, edgeStart, edgeEnd);
        });
        if (crossesEdge === false) {
            return candidate;
        }
    }

    return null;
}

/**
 * Takes an open, counter-clockwise ring and moves every repeated visit of a vertex KEYHOLE_OFFSET_METERS along the
 * bisector of its corner into the polygon interior. Returns the closed ring or null if a corner has no defined
 * bisector.
 */
function offsetRevisitedVertices(openRing: Position[]): Position[] | null {
    const seenKeys = new Set<string>();
    const result: Position[] = [];
    for (let i = 0; i < openRing.length; i++) {
        const vertex = openRing[i];
        const key = toCoordinateKey(vertex);
        if (seenKeys.has(key) === false) {
            seenKeys.add(key);
            result.push(vertex);
            continue;
        }
        const previous = openRing[(i - 1 + openRing.length) % openRing.length];
        const next = openRing[(i + 1) % openRing.length];
        // local planar frame in meters around the vertex
        const metersPerDegreeLon = METERS_PER_DEGREE * Math.cos((vertex[1] * Math.PI) / 180);
        const incoming = normalizeVector(
            (vertex[0] - previous[0]) * metersPerDegreeLon,
            (vertex[1] - previous[1]) * METERS_PER_DEGREE
        );
        const outgoing = normalizeVector(
            (next[0] - vertex[0]) * metersPerDegreeLon,
            (next[1] - vertex[1]) * METERS_PER_DEGREE
        );
        if (incoming == null || outgoing == null) {
            return null;
        }
        // the ring is counter-clockwise, i.e. the interior is left of the direction of travel - the bisector is the
        // sum of the left normals of the incoming and outgoing edge
        const bisector = normalizeVector(-incoming[1] - outgoing[1], incoming[0] + outgoing[0]);
        if (bisector == null) {
            return null;
        }
        result.push([
            roundCoordinate(vertex[0] + (bisector[0] * KEYHOLE_OFFSET_METERS) / metersPerDegreeLon),
            roundCoordinate(vertex[1] + (bisector[1] * KEYHOLE_OFFSET_METERS) / METERS_PER_DEGREE),
        ]);
    }
    result.push(result[0]);

    return result;
}

/**
 * Returns the open ring in the requested orientation.
 */
function orientRing(openRing: Position[], counterClockwise: boolean): Position[] {
    // shoelace formula - positive for counter-clockwise rings
    let signedArea = 0;
    for (let i = 0; i < openRing.length; i++) {
        const current = openRing[i];
        const next = openRing[(i + 1) % openRing.length];
        signedArea += current[0] * next[1] - next[0] * current[1];
    }
    const isCounterClockwise = signedArea > 0;

    return isCounterClockwise === counterClockwise ? openRing : [...openRing].reverse();
}

function getRingEdges(openRing: Position[]): [Position, Position][] {
    return openRing.map((coord, index) => [coord, openRing[(index + 1) % openRing.length]]);
}

/**
 * Checks if two segments intersect, including touching and collinear overlapping segments.
 */
function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
    const orientation = (p: Position, q: Position, r: Position): number => {
        const value = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        return value === 0 ? 0 : value > 0 ? 1 : -1;
    };
    const isOnSegment = (p: Position, q: Position, r: Position): boolean =>
        Math.min(p[0], q[0]) <= r[0] &&
        r[0] <= Math.max(p[0], q[0]) &&
        Math.min(p[1], q[1]) <= r[1] &&
        r[1] <= Math.max(p[1], q[1]);

    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && isOnSegment(a, b, c)) return true;
    if (o2 === 0 && isOnSegment(a, b, d)) return true;
    if (o3 === 0 && isOnSegment(c, d, a)) return true;
    if (o4 === 0 && isOnSegment(c, d, b)) return true;

    return false;
}

function getPlanarDistance(a: Position, b: Position): number {
    const metersPerDegreeLon = METERS_PER_DEGREE * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);

    return Math.hypot((a[0] - b[0]) * metersPerDegreeLon, (a[1] - b[1]) * METERS_PER_DEGREE);
}

function normalizeVector(x: number, y: number): [number, number] | null {
    const length = Math.hypot(x, y);
    if (length < 1e-9) {
        return null;
    }

    return [x / length, y / length];
}

function isEqualPosition(a: Position, b: Position): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

function toCoordinateKey(coord: Position): string {
    return `${coord[0]},${coord[1]}`;
}

/**
 * Rounds a coordinate value to 6 decimal places - the precision used by the parser.
 */
function roundCoordinate(value: number): number {
    return parseFloat(value.toFixed(6));
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
