import { useEffect, useState } from 'react'
import { readStoredExportOptions, writeStoredExportOptions } from './export-cache'
import {
  MIN_EXPORT_QUALITY,
  canSubmitExport,
  showsPngQuality,
  type ExportFileFormat,
  type ExportOptions,
  type ImageFormat,
  type VideoFormat,
} from './export-options'
import type { ExportProgress } from './pdf-export'

export type { ExportFileFormat, ExportOptions }

type ExportModalProps = {
  open?: boolean
  progress: ExportProgress | null
  error: string | null
  onClose: () => void
  onExport?: (options: ExportOptions) => void
  format?: ExportFileFormat
}

const FILE_OPTIONS: { value: ExportFileFormat; label: string }[] = [
  { value: 'PDF', label: 'PDF' },
  { value: 'PPTX', label: 'PPTX' },
  { value: 'ZIP', label: 'ZIP' },
]

const IMAGE_OPTIONS: { value: ImageFormat; label: string }[] = [
  { value: 'same', label: 'Same' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]

const VIDEO_OPTIONS: { value: VideoFormat; label: string }[] = [
  { value: 'same', label: 'Same' },
  { value: 'gif', label: 'GIF' },
  { value: 'webp', label: 'WebP' },
  { value: 'apng', label: 'APNG' },
]

export function ExportModal({
  open = false,
  progress,
  error,
  onClose,
  onExport,
  format = 'PPTX',
}: ExportModalProps) {
  const [initial] = useState(readStoredExportOptions)
  const [file, setFile] = useState<ExportFileFormat>(initial.file)
  const [images, setImages] = useState<ImageFormat>(initial.images)
  const [videos, setVideos] = useState<VideoFormat>(initial.videos)
  const [quality, setQuality] = useState(initial.quality)

  const options: ExportOptions = { file, images, videos, quality }
  useEffect(() => {
    writeStoredExportOptions({ file, images, videos, quality })
  }, [file, images, videos, quality])
  const canExport = canSubmitExport(options)
  const running = Boolean(progress) || Boolean(error)
  if (!open && !running) return null

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0
  const done = progress ? progress.current === progress.total : false

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 shadow-2xl">
        {error ? (
          <>
            <div className="mb-4 text-center text-lg font-semibold text-red-400">Export Failed</div>
            <p className="mb-6 text-center text-sm text-neutral-400">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/15"
            >
              Close
            </button>
          </>
        ) : progress ? (
          <>
            <div className="mb-2 text-center text-lg font-semibold text-neutral-100">
              Exporting Deck to {format}
            </div>
            <p className="mb-6 text-center text-sm text-neutral-400">{progress.status}</p>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-center text-xs text-neutral-500">
              {progress.current} / {progress.total} slides
            </div>
            {done && (
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/15"
              >
                Done
              </button>
            )}
          </>
        ) : (
          <Chooser
            file={file}
            images={images}
            videos={videos}
            quality={quality}
            canExport={canExport}
            onFile={setFile}
            onImages={setImages}
            onVideos={setVideos}
            onQuality={setQuality}
            onCancel={onClose}
            onExport={() => {
              if (!canExport || !onExport) return
              onExport(options)
            }}
          />
        )}
      </div>
    </div>
  )
}

function Chooser({
  file,
  images,
  videos,
  quality,
  canExport,
  onFile,
  onImages,
  onVideos,
  onQuality,
  onCancel,
  onExport,
}: {
  file: ExportFileFormat
  images: ImageFormat
  videos: VideoFormat
  quality: number
  canExport: boolean
  onFile: (value: ExportFileFormat) => void
  onImages: (value: ImageFormat) => void
  onVideos: (value: VideoFormat) => void
  onQuality: (value: number) => void
  onCancel: () => void
  onExport: () => void
}) {
  return (
    <>
      <div className="mb-6 text-center text-lg font-semibold text-neutral-100">Export</div>
      <RadioRow label="File" name="export-file" value={file} options={FILE_OPTIONS} onChange={onFile} />
      <RadioRow
        label="Images"
        name="export-images"
        value={images}
        options={IMAGE_OPTIONS}
        onChange={onImages}
      />
      {showsPngQuality(images) && <QualityGauge value={quality} onChange={onQuality} />}
      <RadioRow
        label="Videos"
        name="export-videos"
        value={videos}
        options={VIDEO_OPTIONS}
        onChange={onVideos}
      />
      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        PowerPoint plays MP4 (and looping GIF). Animated WebP/APNG belong in the ZIP; PDF/PPTX
        will use a still or GIF there.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={onExport}
          className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export
        </button>
      </div>
    </>
  )
}

function QualityGauge({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const pct = Math.round(value * 100)
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
        Quality
      </legend>
      <div className="flex items-center gap-3">
        <div className="relative h-5 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
              style={{ width: `${((value - MIN_EXPORT_QUALITY) / (1 - MIN_EXPORT_QUALITY)) * 100}%` }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fuchsia-400 shadow"
            style={{ left: `${((value - MIN_EXPORT_QUALITY) / (1 - MIN_EXPORT_QUALITY)) * 100}%` }}
          />
          <input
            type="range"
            min={Math.round(MIN_EXPORT_QUALITY * 100)}
            max={100}
            step={1}
            value={pct}
            onChange={(event) => onChange(Number(event.target.value) / 100)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label="PNG quality"
          />
        </div>
        <span className="w-10 text-right text-xs font-medium tabular-nums text-neutral-300">{pct}%</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] tracking-[0.12em] text-neutral-600 uppercase">
        <span>Smaller</span>
        <span>Full</span>
      </div>
    </fieldset>
  )
}

function RadioRow<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string
  name: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <label
              key={option.value}
              className={
                'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ' +
                (selected
                  ? 'border-fuchsia-400/70 bg-fuchsia-500/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/25 hover:text-white')
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
