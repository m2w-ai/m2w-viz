import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportFileFormat, ExportOptions } from './export-options'
import { DEFAULT_EXPORT_OPTIONS } from './export-options'
import type { ExportProgress } from './pdf-export'
import type { PptxExportOptions } from './pptx-export'
import { runDeckExport } from './run-export'

// Presenting a deck needs fullscreen, an export, and a way to know which of
// those is currently happening. Every deck wants the same set, so it lives
// here rather than in either app.

export function usePresenterControls(baseName: string, pptxOptions: PptxExportOptions = {}) {
  const offscreenRef = useRef<HTMLDivElement>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFileFormat>(DEFAULT_EXPORT_OPTIONS.file)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // The browser can leave fullscreen without going through our button (Esc,
  // window manager, etc.), so mirror the document rather than trusting state.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Safari rejects the promise when the gesture is not trusted. Nothing to
      // recover from — the deck is still usable windowed.
    }
  }, [])

  const openExport = useCallback(() => {
    setError(null)
    setProgress(null)
    setChooserOpen(true)
  }, [])

  const runExport = useCallback(
    async (options: ExportOptions) => {
      if (!offscreenRef.current) return
      setChooserOpen(false)
      setFormat(options.file)
      setError(null)
      setProgress({ current: 0, total: 1, status: 'Preparing…' })
      try {
        await runDeckExport(offscreenRef.current, setProgress, baseName, options, pptxOptions)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unknown error')
      }
    },
    [baseName, pptxOptions],
  )

  const closeModal = useCallback(() => {
    setChooserOpen(false)
    setProgress(null)
    setError(null)
  }, [])

  // F toggles fullscreen, E opens the export chooser. Ignored while typing
  // in a field, and while a modifier is held so browser shortcuts still work.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        void toggleFullscreen()
      }
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault()
        if (progress && !error) return
        openExport()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen, openExport, progress, error])

  return {
    offscreenRef,
    chooserOpen,
    progress,
    error,
    format,
    isFullscreen,
    toggleFullscreen,
    openExport,
    runExport,
    closeModal,
  }
}
