export const OutputGeometryEnum = {
    POLYGON: 'POLYGON',
    LINESTRING: 'LINESTRING',
} as const;

export type OutputGeometry = (typeof OutputGeometryEnum)[keyof typeof OutputGeometryEnum];
