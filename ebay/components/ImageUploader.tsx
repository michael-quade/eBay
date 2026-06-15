'use client'

import { useState, useRef, useCallback, useId } from 'react'
import Image from 'next/image'
import type { EbayEnv } from '@/lib/env'

export interface UploadedImage {
  id: string
  previewUrl: string   // blob URL for local preview
  ebayUrl: string      // eBay-hosted URL (empty while uploading)
  filename: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

interface Props {
  env: EbayEnv
  onChange: (orderedUrls: string[]) => void
}

export default function ImageUploader({ env, onChange }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false) // file drop zone
  const [thumbDragIdx, setThumbDragIdx] = useState<number | null>(null)
  const [thumbDragOverIdx, setThumbDragOverIdx] = useState<number | null>(null)

  // Notify parent whenever the ordered, successful URL list changes
  function notify(imgs: UploadedImage[]) {
    onChange(imgs.filter(i => i.status === 'done').map(i => i.ebayUrl))
  }

  async function uploadFile(file: File): Promise<UploadedImage> {
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)

    const pending: UploadedImage = { id, previewUrl, ebayUrl: '', filename: file.name, status: 'uploading' }

    setImages(prev => {
      const next = [...prev, pending]
      notify(next)
      return next
    })

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('env', env)

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed')

      setImages(prev => {
        const next = prev.map(img =>
          img.id === id ? { ...img, ebayUrl: data.url, status: 'done' as const } : img
        )
        notify(next)
        return next
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setImages(prev => {
        const next = prev.map(img =>
          img.id === id ? { ...img, status: 'error' as const, error: message } : img
        )
        notify(next)
        return next
      })
    }

    return pending
  }

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
      arr.forEach(uploadFile)
    },
    // uploadFile is stable; env triggers re-upload if env changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [env]
  )

  // --- File drop zone handlers ---
  function onZoneDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }
  function onZoneDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }
  function onZoneDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files)
  }

  // --- Thumbnail reorder handlers ---
  function onThumbDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/x-thumb-idx', String(idx))
    setThumbDragIdx(idx)
  }
  function onThumbDragOver(e: React.DragEvent, idx: number) {
    if (!e.dataTransfer.types.includes('text/x-thumb-idx')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setThumbDragOverIdx(idx)
  }
  function onThumbDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault()
    const fromIdx = parseInt(e.dataTransfer.getData('text/x-thumb-idx'))
    if (isNaN(fromIdx) || fromIdx === dropIdx) return
    setImages(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(dropIdx, 0, moved)
      notify(next)
      return next
    })
    setThumbDragIdx(null)
    setThumbDragOverIdx(null)
  }
  function onThumbDragEnd() {
    setThumbDragIdx(null)
    setThumbDragOverIdx(null)
  }

  function setAsMain(idx: number) {
    setImages(prev => {
      const next = [...prev]
      const [img] = next.splice(idx, 1)
      next.unshift(img)
      notify(next)
      return next
    })
  }

  function retryUpload(idx: number) {
    const img = images[idx]
    if (!img) return
    // Reload from previewUrl is not possible; ask user to re-add the file.
    // Instead mark it removed and have user re-add.
    removeImage(idx)
  }

  function removeImage(idx: number) {
    setImages(prev => {
      const next = prev.filter((_, i) => i !== idx)
      notify(next)
      return next
    })
  }

  const doneCount = images.filter(i => i.status === 'done').length
  const uploadingCount = images.filter(i => i.status === 'uploading').length

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={onZoneDragOver}
        onDragLeave={onZoneDragLeave}
        onDrop={onZoneDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors select-none
          ${isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
          }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            {isDragOver ? 'Drop images here' : 'Drag & drop images, or click to browse'}
          </p>
          <p className="text-xs text-gray-400">JPG, PNG, GIF, WebP · max 7 MB each</p>
        </div>
      </div>

      {/* Status summary */}
      {images.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{doneCount} uploaded</span>
          {uploadingCount > 0 && <span className="text-blue-600 font-medium">{uploadingCount} uploading…</span>}
          <span className="text-gray-400">· Drag thumbnails to reorder · First image = main auction photo</span>
        </div>
      )}

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable={img.status === 'done'}
              onDragStart={e => onThumbDragStart(e, idx)}
              onDragOver={e => onThumbDragOver(e, idx)}
              onDrop={e => onThumbDrop(e, idx)}
              onDragEnd={onThumbDragEnd}
              className={`relative rounded-lg overflow-hidden border-2 transition-all
                ${thumbDragOverIdx === idx && thumbDragIdx !== idx
                  ? 'border-blue-500 scale-105 shadow-lg'
                  : idx === 0
                  ? 'border-yellow-400'
                  : 'border-gray-200'
                }
                ${thumbDragIdx === idx ? 'opacity-40' : 'opacity-100'}
                ${img.status === 'done' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
              `}
              style={{ aspectRatio: '1' }}
            >
              <Image
                src={img.previewUrl}
                alt={img.filename}
                fill
                className="object-cover"
                unoptimized
              />

              {/* Main badge */}
              {idx === 0 && img.status === 'done' && (
                <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  MAIN
                </div>
              )}

              {/* Uploading overlay */}
              {img.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-[10px]">Uploading</span>
                </div>
              )}

              {/* Error overlay */}
              {img.status === 'error' && (
                <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-1 p-1">
                  <span className="text-white text-[10px] text-center leading-tight">{img.error}</span>
                  <button
                    type="button"
                    onClick={() => retryUpload(idx)}
                    className="text-[10px] underline text-white/80 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Action bar (shown on hover for done images) */}
              {img.status === 'done' && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 flex items-center justify-between px-1 py-0.5 opacity-0 hover:opacity-100 transition-opacity">
                  {idx !== 0 ? (
                    <button
                      type="button"
                      title="Set as main image"
                      onClick={() => setAsMain(idx)}
                      className="text-yellow-300 hover:text-yellow-100 text-[11px] font-medium"
                    >
                      ★ Main
                    </button>
                  ) : (
                    <span className="text-yellow-300 text-[11px]">★ Main</span>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => removeImage(idx)}
                    className="text-white/70 hover:text-red-300 text-base leading-none"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Done: remove button always visible top-right */}
              {img.status === 'done' && (
                <button
                  type="button"
                  title="Remove image"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 hover:bg-red-600 text-white text-xs leading-none flex items-center justify-center transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ordering tip when multiple images are done */}
      {doneCount >= 2 && (
        <p className="text-xs text-gray-400">
          Drag to reorder · Click <span className="text-yellow-600 font-medium">★ Main</span> on any image to promote it to the top slot.
        </p>
      )}
    </div>
  )
}
