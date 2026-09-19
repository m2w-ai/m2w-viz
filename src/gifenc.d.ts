declare module 'gifenc' {
  export type Palette = number[][]

  export function GIFEncoder(opt?: { initialCapacity?: number; auto?: boolean }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette
        delay?: number
        repeat?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
  }

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string },
  ): Palette

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string,
  ): Uint8Array
}
