'use client'

import Image from 'next/image'
import type { SoldItem } from '@/lib/ebay/listings'

const STATUS_STYLES: Record<SoldItem['status'], { label: string; card: string; badge: string }> = {
  awaiting_payment: {
    label: 'Awaiting Payment',
    card: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  paid: {
    label: 'Paid',
    card: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  shipped: {
    label: 'Shipped',
    card: 'border-green-300',
    badge: 'bg-green-100 text-green-800 border-green-300',
  },
  cancelled: {
    label: 'Cancelled',
    card: 'border-gray-300',
    badge: 'bg-gray-100 text-gray-500 border-gray-300',
  },
}

function formatDate(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

export default function SoldItemCard({ item }: { item: SoldItem }) {
  const style = STATUS_STYLES[item.status]

  return (
    <div className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${style.card}`}>
      {/* Image */}
      <div className="relative w-full h-36 bg-gray-100">
        {item.galleryUrl ? (
          <Image
            src={item.galleryUrl}
            alt={item.title}
            fill
            className="object-contain p-2"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No image</div>
        )}
        {/* Status badge */}
        <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
          {style.label.toUpperCase()}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {item.title}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-gray-900">${item.salePrice.toFixed(2)}</p>
          {item.quantity > 1 && (
            <span className="text-xs text-gray-500">Qty {item.quantity}</span>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-0.5">
          <p><span className="text-gray-400">Sold </span>{formatDate(item.saleDate)}</p>
          <p><span className="text-gray-400">Buyer </span><span className="font-medium">{item.buyerUserId}</span></p>
          {item.status === 'paid' && item.paidDate && (
            <p><span className="text-gray-400">Paid </span>{formatDate(item.paidDate)}</p>
          )}
          {item.status === 'shipped' && (
            <>
              {item.shippedDate && (
                <p><span className="text-gray-400">Shipped </span>{formatDate(item.shippedDate)}</p>
              )}
              {item.trackingNumber && (
                <p className="truncate">
                  <span className="text-gray-400">{item.trackingCarrier ?? 'Tracking'} </span>
                  <span className="font-mono font-medium">{item.trackingNumber}</span>
                </p>
              )}
            </>
          )}
        </div>

        {item.viewItemUrl && (
          <a
            href={item.viewItemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto text-center text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View on eBay →
          </a>
        )}
      </div>
    </div>
  )
}
