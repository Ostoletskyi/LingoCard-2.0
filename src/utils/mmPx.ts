export const MM_PER_INCH = 25.4;
export const SCREEN_DPI = 96;

// Единая формула координат: px = mm * scale * dpiFactor, где dpiFactor = SCREEN_DPI / MM_PER_INCH.
export const DEFAULT_PX_PER_MM = SCREEN_DPI / MM_PER_INCH;

export const getPxPerMm = (scale: number) => DEFAULT_PX_PER_MM * scale;

export const mmToPx = (mm: number, pxPerMm: number) => mm * pxPerMm;

export const pxToMm = (px: number, pxPerMm: number) => px / pxPerMm;

export const mmToPdf = (mm: number) => mm;
