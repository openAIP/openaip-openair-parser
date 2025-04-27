export const AltitudeUnitEnum = {
    FLIGHT_LEVEL: 'FL',
    FEET: 'FT',
    METER: 'M',
} as const;

export type AltitudeUnit = (typeof AltitudeUnitEnum)[keyof typeof AltitudeUnitEnum];
