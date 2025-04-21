import type { z } from 'zod';

/* eslint-disable @typescript-eslint/no-namespace */

export namespace Geometry {
    export type Point = {};

    export type Polygon = {};

    export const PolygonSchema = z.object({});
}

export type TokenType =
    | 'BASE_LINE'
    | 'BASE_ALTITUDE'
    | 'BLANK'
    | 'COMMENT'
    | 'SKIPPED'
    | 'EOF'
    | 'AC'
    | 'AY'
    | 'AN'
    | 'AI'
    | 'AF'
    | 'AG'
    | 'AL'
    | 'AH'
    | 'DA'
    | 'DB'
    | 'DC'
    | 'DP'
    | 'DY'
    | 'TP'
    | 'VD'
    | 'VW'
    | 'VX'
