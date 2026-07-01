'use client'

import { useState, useEffect, useCallback } from 'react'
import ListingCard from '@/components/ListingCard'
import SoldItemCard from '@/components/SoldItemCard'
import type { EbayListing, SoldItem } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

const RELISTED_KEY = 'ebay_relisted_ids'
const SANDBOX_DISMISSED_KEY = 'ebay_sandbox_dismissed_ids'

function getStoredSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) }
  catch { return new Set() }
}

function addToStoredSet(key: string, id: string) {
  try {
    const ids = getStoredSet(key)
    ids.add(id)
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch { /* localStorage unavailable */ }
}

export default function Dashboard() {
  const [env, setEnv] = useState<EbayEnv>('sandbox')
  const [listings, setListings] = useState<EbayListing[]>([])
  const [soldItems, setSoldItems] = useState<SoldItem[]>([])
  const [relistedIds, setRelistedIds] = useState<Set<string>>(new Set())
  const [sandboxDismissedIds, setSandboxDismissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  useEffect(() => {
    setRelistedIds(getStoredSet(RELISTED_KEY))
    setSandboxDismissedIds(getStoredSet(SANDBOX_DISMISSED_KEY))
  }, [])

  const activeListings = listings.filter(l =>
    l.status === 'active' && !(env === 'sandbox' && sandboxDismissedIds.has(l.itemId))
  )
  const unsoldListings = listings.filter(l => l.status === 'unsold' && !relistedIds.has(l.itemId))

  function handleRelisted(oldItemId: string) {
    addToStoredSet(RELISTED_KEY, oldItemId)
    setRelistedIds(prev => new Set([...prev, oldItemId]))
  }

  function handleSandboxDismiss(itemId: string) {
    addToStoredSet(SANDBOX_DISMISSED_KEY, itemId)
    setSandboxDismissedIds(prev => new Set([...prev, itemId]))
  }

  const fetchListings = useCallback(async (e: EbayEnv) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/listings?env=${e}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Request failed')
      setListings(data.listings ?? [])
      setSoldItems(data.soldItems ?? [])
      setLastFetched(new Date())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load listings')
      setListings([])
      setSoldItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchListings(env) }, [env, fetchListings])

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Listings</h1>
          {lastFetched && (
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 text-sm font-medium">
            {(['sandbox', 'production'] as EbayEnv[]).map(e => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`px-3 py-1.5 rounded-md transition-colors capitalize ${
                  env === e
                    ? e === 'sandbox'
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchListings(env)}
            disabled={loading}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <a
            href="/listings/new"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            + New Listing
          </a>
        </div>
      </div>

      {/* Environment badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          env === 'sandbox'
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${env === 'sandbox' ? 'bg-blue-500' : 'bg-green-500'}`} />
        {env === 'sandbox' ? 'Sandbox — test listings only' : 'Production — real eBay listings'}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && activeListings.length === 0 && unsoldListings.length === 0 && soldItems.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-500">No active listings</p>
          <p className="text-sm mt-1">
            {env === 'sandbox'
              ? 'Switch to Production to see your real listings, or create a sandbox test.'
              : 'Create your first listing to get started.'}
          </p>
          <a
            href="/listings/new"
            className="mt-4 inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Listing
          </a>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl animate-pulse">
              <div className="h-40 bg-gray-100 rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-5 bg-gray-100 rounded w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active listings grid */}
      {!loading && activeListings.length > 0 && (
        <>
          <p className="text-sm text-gray-500">{activeListings.length} active listing{activeListings.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeListings.map(l => (
              <ListingCard
                key={l.itemId}
                listing={l}
                env={env}
                onDismiss={env === 'sandbox' ? handleSandboxDismiss : undefined}
              />
            ))}
          </div>
        </>
      )}

      {/* Ended without buyer — production only */}
      {!loading && env === 'production' && unsoldListings.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-base font-semibold text-gray-700">Ended Without a Buyer</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">
              {unsoldListings.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unsoldListings.map(l => (
              <ListingCard key={l.itemId} listing={l} env={env} onRelisted={oldId => handleRelisted(oldId)} onDismiss={handleRelisted} />
            ))}
          </div>
        </>
      )}

      {/* Sold items — past 6 months */}
      {!loading && soldItems.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-base font-semibold text-gray-700">Sold — Past 6 Months</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-medium">
              {soldItems.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {soldItems.map(item => (
              <SoldItemCard key={`${item.orderId}-${item.itemId}`} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
