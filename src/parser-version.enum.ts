export const ParserVersionEnum = {
    VERSION_1: '1.0',
    VERSION_2: '2.0',
} as const;

export type ParserVersion = (typeof ParserVersionEnum)[keyof typeof ParserVersionEnum];
