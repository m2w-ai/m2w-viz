import { describe, expect, test } from 'bun:test'
import { encodeApngFrames, encodeGifFrames, videoBaseName, videoCacheKey } from '../video-encode'

function solidFrame(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return data
}

describe('video frame encoders', () => {
  test('GIF encoder writes a GIF87/89 header', () => {
    const frames = [solidFrame(4, 4, 255, 0, 0), solidFrame(4, 4, 0, 0, 255)]
    const bytes = encodeGifFrames(frames, 4, 4, 125)
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!, bytes[5]!)).toBe(
      'GIF89a',
    )
    expect(bytes.length).toBeGreaterThan(32)
  })

  test('APNG encoder writes a PNG with an animation control chunk', () => {
    const frames = [solidFrame(4, 4, 255, 0, 0), solidFrame(4, 4, 0, 255, 0)]
    const bytes = encodeApngFrames(frames, 4, 4, 125)
    expect(bytes[0]).toBe(0x89)
    expect(String.fromCharCode(bytes[1]!, bytes[2]!, bytes[3]!)).toBe('PNG')
    const asText = new TextDecoder('latin1').decode(bytes)
    expect(asText.includes('acTL')).toBe(true)
  })

  test('file names come from the video path, not the query string', () => {
    expect(videoBaseName('/media/detection.mp4?cache=1')).toBe('detection')
    expect(videoBaseName('https://cdn.example/deck/demo.mp4')).toBe('demo')
    expect(videoCacheKey('/deck/demo.mp4', 'mp4')).toBe('mp4:/deck/demo.mp4')
  })
})
