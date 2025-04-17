export const AltitudeUnitEnum = {
    ft: 'FT',
    m: 'M',
} as const;

export type AltitudeUnit = (typeof AltitudeUnitEnum)[keyof typeof AltitudeUnitEnum];
