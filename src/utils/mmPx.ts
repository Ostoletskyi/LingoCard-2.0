export const DPI_FACTOR = 3.78;

export const mmToPx = (mm: number, pxPerMm: number) => mm * pxPerMm;
export const pxToMm = (px: number, pxPerMm: number) => px / pxPerMm;

export const getPxPerMm = (scale: number) => DPI_FACTOR * scale;

export const DEFAULT_PX_PER_MM = DPI_FACTOR;
