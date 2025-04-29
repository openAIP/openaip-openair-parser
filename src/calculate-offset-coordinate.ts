import type { Position } from 'geojson';

/**
 * Calculates the destination point given a starting point, bearing, and a short distance (< 1000m).
 * Uses a flat-Earth approximation, suitable for short distances.
 * Position coordinates are expected and returned in [longitude, latitude] order.
 *
 * - startCoord: The starting position as [longitude, latitude] in degrees.
 * - bearingDegrees: The bearing in degrees, measured clockwise from North (0° is North, 90° is East).
 * - offsetMeters: The distance to travel along the bearing in meters (assumed to be small, e.g., < 500m).
 */
export function calculateOffsetCoordinate(
    startCoord: Position,
    bearingDegrees: number,
    offsetMeters: number
): Position {
    // extract start longitude and latitude, adhering to [longitude, latitude] order
    const startLon = startCoord[0];
    const startLat = startCoord[1];
    // handle the simple case of zero offset distance
    if (offsetMeters === 0) {
        // return a new tuple with the same coordinates
        return [startLon, startLat];
    }
    const DEG_TO_RAD = Math.PI / 180;
    // approx meters/degree latitude
    const METERS_PER_DEGREE_LATITUDE = 111132;
    // approx meters/degree longitude at equator
    const METERS_PER_DEGREE_LONGITUDE_FACTOR = 111320;
    // convert start latitude and bearing to radians ---
    // Latitude (index 1) is needed for longitude scaling and doesn't change much over short distances
    const startLatRad = startLat * DEG_TO_RAD;
    const bearingRadFromNorth = bearingDegrees * DEG_TO_RAD;
    // calculate standard mathematical angle (0 rad = East, counter-clockwise)
    const mathAngleRad = Math.PI / 2 - bearingRadFromNorth;
    // calculate North-South (dy) and East-West (dx) offsets in meters
    const offsetY_meters = offsetMeters * Math.sin(mathAngleRad);
    const offsetX_meters = offsetMeters * Math.cos(mathAngleRad);
    // convert meter offsets to degree offsets
    // latitude offset in degrees
    const offsetLatDegrees = offsetY_meters / METERS_PER_DEGREE_LATITUDE;
    // calculate meters per degree longitude at the starting latitude
    const metersPerDegreeLongitude = METERS_PER_DEGREE_LONGITUDE_FACTOR * Math.cos(startLatRad);
    // longitude offset in degrees (check for division by zero near poles)
    const offsetLonDegrees = metersPerDegreeLongitude > 1e-6 ? offsetX_meters / metersPerDegreeLongitude : 0;
    // calculate final coordinates
    const finalLat = startLat + offsetLatDegrees;
    const finalLon = startLon + offsetLonDegrees;
    // normalize final longitude to the standard [-180, 180] degree range
    const normalizedLon = ((finalLon + 540) % 360) - 180;

    return [normalizedLon, finalLat];
}
