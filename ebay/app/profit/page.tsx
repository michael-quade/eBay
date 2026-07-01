'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SoldItem } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

const LABEL_COSTS_KEY = 'ebay_shipping_label_costs'

function getLabelCosts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LABEL_COSTS_KEY) ?? '{}') }
  catch { return {} }
}

function saveLabelCost(orderId: string, cost: number) {
  try {
    const costs = getLabelCosts()
    costs[orderId] = cost
    localStorage.setItem(LABEL_COSTS_KEY, JSON.stringify(costs))
  } catch { /* unavailable */ }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

const STATUS_BADGE: Record<SoldItem['status'], string> = {
  awaiting_payment: 'bg-amber-100 text-amber-800',
  paid:             'bg-blue-100 text-blue-800',
  shipped:          'bg-green-100 text-green-800',
  cancelled:        'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<SoldItem['status'], string> = {
  awaiting_payment: 'Awaiting Pmt',
  paid:             'Paid',
  shipped:          'Shipped',
  cancelled:        'Cancelled',
}

export default function ProfitPage() {
  const [env, setEnv] = useState<EbayEnv>('production')
  const [items, setItems] = useState<SoldItem[]>([])
  const [labelCosts, setLabelCosts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setLabelCosts(getLabelCosts()) }, [])

  const fetch_ = useCallback(async (e: EbayEnv) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/listings/sold?env=${e}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      setItems(data.soldItems ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_(env) }, [env, fetch_])

  function handleLabelCost(orderId: string, value: string) {
    const cost = parseFloat(value) || 0
    saveLabelCost(orderId, cost)
    setLabelCosts(prev => ({ ...prev, [orderId]: cost }))
  }

  // Exclude cancelled from totals
  const billable = items.filter(i => i.status !== 'cancelled')
  const totals = billable.reduce(
    (acc, item) => {
      const label = labelCosts[item.orderId] ?? 0
      return {
        salePrice:          acc.salePrice          + item.salePrice,
        buyerPaidTotal:     acc.buyerPaidTotal     + item.buyerPaidTotal,
        shippingIn:         acc.shippingIn         + item.shippingPaidByBuyer,
        ebayFee:            acc.ebayFee            + item.finalValueFee,
        labelCost:          acc.labelCost          + label,
        profit:             acc.profit             + (item.buyerPaidTotal - item.finalValueFee - label),
      }
    },
    { salePrice: 0, buyerPaidTotal: 0, shippingIn: 0, ebayFee: 0, labelCost: 0, profit: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Profit Tracker</h1>
          <p className="text-xs text-gray-400 mt-0.5">Past 90 days · Shipping label cost is entered manually</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium">
            {(['sandbox', 'production'] as EbayEnv[]).map(e => (
              <button key={e} onClick={() => setEnv(e)}
                className={`px-3 py-1.5 rounded-md transition-colors capitalize ${
                  env === e
                    ? e === 'sandbox' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}>
                {e}
              </button>
            ))}
          </div>
          <button onClick={() => fetch_(env)} disabled={loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-center py-16 text-gray-400">No sold orders in the past 90 days.</p>
      )}

      {(loading || items.length > 0) && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Sale Price</th>
                <th className="text-right px-4 py-3 font-medium">Shipping In</th>
                <th className="text-right px-4 py-3 font-medium">Buyer Paid</th>
                <th className="text-right px-4 py-3 font-medium">eBay Fee</th>
                <th className="text-right px-4 py-3 font-medium">Label Cost</th>
                <th className="text-right px-4 py-3 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && items.map(item => {
                const label = labelCosts[item.orderId] ?? 0
                const profit = item.buyerPaidTotal - item.finalValueFee - label
                const isCancelled = item.status === 'cancelled'
                return (
                  <tr key={`${item.orderId}-${item.itemId}`}
                    className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 max-w-[220px]">
                      {item.viewItemUrl ? (
                        <a href={item.viewItemUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline line-clamp-2 leading-tight font-medium">
                          {item.title}
                        </a>
                      ) : (
                        <span className="line-clamp-2 leading-tight font-medium text-gray-800">{item.title}</span>
                      )}
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-400 ml-1">×{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(item.saleDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(item.salePrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(item.shippingPaidByBuyer)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(item.buyerPaidTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">−{fmt(item.finalValueFee)}</td>
                    <td className="px-4 py-3 text-right">
                      {isCancelled ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={label > 0 ? label.toFixed(2) : ''}
                            onBlur={e => handleLabelCost(item.orderId, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="w-20 text-right text-sm border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent tabular-nums text-red-600"
                          />
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      isCancelled ? 'text-gray-300' : profit >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {isCancelled ? '—' : fmt(profit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totals row */}
            {!loading && billable.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-800">
                  <td className="px-4 py-3" colSpan={3}>
                    Totals <span className="text-xs font-normal text-gray-400">({billable.length} order{billable.length !== 1 ? 's' : ''})</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.salePrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(totals.shippingIn)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.buyerPaidTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">−{fmt(totals.ebayFee)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">−{fmt(totals.labelCost)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums text-base ${totals.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(totals.profit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        eBay Fee shown is the Final Value Fee per transaction. It may not include promoted listing fees or insertion fees.
        Shipping label cost is saved locally in your browser.
      </p>
    </div>
  )
}
