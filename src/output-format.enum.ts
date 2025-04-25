export const OutputFormatEnum = {
    GEOJSON: 'GEOJSON',
    OPENAIR: 'OPENAIR',
} as const;

export type OutputFormat = (typeof OutputFormatEnum)[keyof typeof OutputFormatEnum];
