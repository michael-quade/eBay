'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { EbayListing } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

function parseTimeLeft(iso: string): string {
  const match = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return iso
  const [, d, h, m] = match
  const parts = []
  if (d && Number(d) > 0) parts.push(`${d}d`)
  if (h && Number(h) > 0) parts.push(`${h}h`)
  if (m && Number(m) > 0) parts.push(`${m}m`)
  return parts.length ? parts.join(' ') : 'Ending soon'
}

function formatEndDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function urgencyColor(timeLeft: string): string {
  const match = timeLeft.match(/P(?:(\d+)D)?/)
  const days = Number(match?.[1] ?? 0)
  if (days === 0) return 'text-red-600 font-bold'
  if (days <= 1) return 'text-orange-500 font-semibold'
  return 'text-green-600'
}

export default function ListingCard({
  listing,
  env,
  onRelisted,
  onDismiss,
}: {
  listing: EbayListing
  env: EbayEnv
  onRelisted?: (oldItemId: string, newItemId: string) => void
  onDismiss?: (itemId: string) => void
}) {
  const isAuction = listing.listingType === 'Chinese'
  const isUnsold = listing.status === 'unsold'

  // Price edit state (active listings)
  const [editing, setEditing] = useState(false)
  const [priceInput, setPriceInput] = useState(listing.currentPrice.toFixed(2))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [displayPrice, setDisplayPrice] = useState(listing.currentPrice)

  // Relist state (unsold listings)
  const [relisting, setRelisting] = useState(false)
  const [relistPrice, setRelistPrice] = useState(listing.currentPrice.toFixed(2))
  const [changePrice, setChangePrice] = useState(false)
  const [relistBusy, setRelistBusy] = useState(false)
  const [relistError, setRelistError] = useState('')
  const [relisted, setRelisted] = useState(false)

  async function savePrice() {
    const newPrice = parseFloat(priceInput)
    if (isNaN(newPrice) || newPrice <= 0) { setSaveError('Enter a valid price'); return }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/listings/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: listing.itemId, price: newPrice, env }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Revision failed')
      setDisplayPrice(newPrice)
      setEditing(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update price')
    } finally {
      setSaving(false)
    }
  }

  async function submitRelist() {
    const price = changePrice ? parseFloat(relistPrice) : null
    if (changePrice && (isNaN(price!) || price! <= 0)) { setRelistError('Enter a valid price'); return }
    setRelistBusy(true)
    setRelistError('')
    try {
      const res = await fetch('/api/listings/relist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: listing.itemId, price, env }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Relist failed')
      setRelisted(true)
      setRelisting(false)
      onRelisted?.(listing.itemId, data.itemId)
    } catch (e: unknown) {
      setRelistError(e instanceof Error ? e.message : 'Failed to relist')
    } finally {
      setRelistBusy(false)
    }
  }

  if (relisted) return null

  return (
    <div className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${
      isUnsold ? 'border-amber-300' : 'border-gray-200'
    }`}>
      <div className="relative w-full h-40 bg-gray-100">
        {listing.galleryUrl ? (
          <Image
            src={listing.galleryUrl}
            alt={listing.title}
            fill
            className={`object-contain p-2 ${isUnsold ? 'opacity-60' : ''}`}
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No image</div>
        )}
        {isUnsold && (
          <div className="absolute top-2 left-2 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
            ENDED — NO SALE
          </div>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(listing.itemId)}
            title="Dismiss from this list"
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 hover:bg-black/70 text-white text-xs leading-none flex items-center justify-center transition-colors"
          >
            ×
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {listing.title}
        </h3>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{isAuction ? 'Starting price' : 'Price'}</p>
            {editing ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-lg font-bold text-gray-900">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePrice(); if (e.key === 'Escape') setEditing(false) }}
                  className="w-24 text-lg font-bold border border-blue-400 rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-bold text-gray-900">${displayPrice.toFixed(2)}</p>
                {env === 'production' && !isUnsold && (
                  <button
                    onClick={() => { setPriceInput(displayPrice.toFixed(2)); setEditing(true); setSaveError('') }}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit price"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
            {isAuction ? 'Auction' : 'Fixed'}
          </span>
        </div>

        {/* Price edit controls */}
        {editing && (
          <div className="flex items-center gap-2">
            <button onClick={savePrice} disabled={saving}
              className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setSaveError('') }}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
          {isAuction && (
            <div>
              <span className="text-gray-400">Bids </span>
              <span className="font-medium">{listing.bidCount}</span>
            </div>
          )}
          <div>
            <span className="text-gray-400">Watching </span>
            <span className="font-medium">{listing.watchCount}</span>
          </div>
          <div>
            <span className="text-gray-400">Views </span>
            <span className="font-medium">{listing.hitCount.toLocaleString()}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">{isUnsold ? 'Ended ' : 'Ends '}</span>
            <span className="font-medium">{formatEndDate(listing.endTime)}</span>
          </div>
          {!isUnsold && (
            <div className="col-span-2">
              <span className="text-gray-400">Left </span>
              <span className={urgencyColor(listing.timeLeft)}>
                {parseTimeLeft(listing.timeLeft)}
              </span>
            </div>
          )}
        </div>

        {/* Relist section */}
        {isUnsold && env === 'production' && !relisted && (
          <div className="mt-1 pt-2 border-t border-amber-200">
            {!relisting ? (
              <button
                onClick={() => { setRelisting(true); setRelistError('') }}
                className="w-full px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors"
              >
                Relist this item
              </button>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={changePrice}
                    onChange={e => setChangePrice(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Change price
                </label>
                {changePrice && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={relistPrice}
                      onChange={e => setRelistPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitRelist() }}
                      className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      autoFocus
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={submitRelist} disabled={relistBusy}
                    className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50 transition-colors">
                    {relistBusy ? 'Relisting…' : 'Confirm relist'}
                  </button>
                  <button onClick={() => { setRelisting(false); setRelistError('') }}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
                {relistError && <p className="text-xs text-red-600">{relistError}</p>}
              </div>
            )}
          </div>
        )}

        <a
          href={listing.viewItemUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto text-center text-xs text-blue-600 hover:text-blue-800 underline"
        >
          View on eBay →
        </a>
      </div>
    </div>
  )
}
