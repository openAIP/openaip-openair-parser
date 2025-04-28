export const AltitudeReferenceDatumEnum = {
    STANDARD_ATMOSPHERE: 'STD',
    GROUND: 'GND',
    MAIN_SEA_LEVEL: 'MSL',
} as const;

export type AltitudeReferenceDatum = (typeof AltitudeReferenceDatumEnum)[keyof typeof AltitudeReferenceDatumEnum];
