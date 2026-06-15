'use client'

import Image from 'next/image'
import type { EbayListing } from '@/lib/ebay/listings'

function parseTimeLeft(iso: string): string {
  // eBay returns ISO 8601 duration: P1DT2H30M0S
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

export default function ListingCard({ listing }: { listing: EbayListing }) {
  const isAuction = listing.listingType === 'Chinese'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      <div className="relative w-full h-40 bg-gray-100">
        {listing.galleryUrl ? (
          <Image
            src={listing.galleryUrl}
            alt={listing.title}
            fill
            className="object-contain p-2"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No image</div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {listing.title}
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{isAuction ? 'Current bid' : 'Price'}</p>
            <p className="text-lg font-bold text-gray-900">
              ${listing.currentPrice.toFixed(2)}
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
            {isAuction ? 'Auction' : 'Fixed'}
          </span>
        </div>

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
          <div className="col-span-2">
            <span className="text-gray-400">Ends </span>
            <span className="font-medium">{formatEndDate(listing.endTime)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Left </span>
            <span className={urgencyColor(listing.timeLeft)}>
              {parseTimeLeft(listing.timeLeft)}
            </span>
          </div>
        </div>

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
