'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { EbayEnv } from '@/lib/env'
import type { CategorySuggestion } from '@/lib/ebay/categories'
import type { NewListingData } from '@/lib/ebay/listings'
import ImageUploader from './ImageUploader'

type SubmitState = 'idle' | 'testing' | 'sandbox_done' | 'publishing' | 'production_done' | 'error'

const CONDITION_OPTIONS = [
  { id: '1000', label: 'New' },
  { id: '1500', label: 'New (other)' },
  { id: '2500', label: 'Seller refurbished' },
  { id: '3000', label: 'Used' },
  { id: '4000', label: 'Very Good' },
  { id: '5000', label: 'Good' },
  { id: '6000', label: 'Acceptable' },
  { id: '7000', label: 'For parts / not working' },
]

const DURATION_OPTIONS = [
  { value: 'Days_1', label: '1 day' },
  { value: 'Days_3', label: '3 days' },
  { value: 'Days_5', label: '5 days' },
  { value: 'Days_7', label: '7 days' },
  { value: 'Days_10', label: '10 days' },
  { value: 'GTC', label: 'Good Till Cancelled' },
]

const SHIPPING_SERVICES = [
  'USPSFirstClass',
  'USPSPriority',
  'USPSParcelSelect',
  'UPSGround',
  'UPSNextDayAir',
  'FedExGround',
  'FedExHomeDelivery',
  'Other',
]

interface ItemSpecific {
  name: string
  value: string
}

interface FormValues {
  title: string
  categoryId: string
  categoryName: string
  conditionId: string
  listingType: 'Chinese' | 'FixedPriceItem'
  startPrice: string
  duration: string
  photos: string[]
  description: string
  buyItNowPrice: string
  reservePrice: string
  quantity: string
  shippingService: string
  shippingCost: string
  returnsAccepted: boolean
  returnDays: string
  location: string
  itemSpecifics: ItemSpecific[]
}

const defaultForm: FormValues = {
  title: '',
  categoryId: '',
  categoryName: '',
  conditionId: '1000',
  listingType: 'Chinese',
  startPrice: '',
  duration: 'Days_7',
  photos: [''],
  description: '',
  buyItNowPrice: '',
  reservePrice: '',
  quantity: '1',
  shippingService: 'USPSPriority',
  shippingCost: '0',
  returnsAccepted: true,
  returnDays: '30',
  location: '',
  itemSpecifics: [],
}

function SectionToggle({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        <span>{label}</span>
        <span className="text-gray-400">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function NewListingForm({ defaultEnv }: { defaultEnv: EbayEnv }) {
  const [form, setForm] = useState<FormValues>(defaultForm)
  const [photoBlobUrls, setPhotoBlobUrls] = useState<string[]>([])
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [sandboxItemId, setSandboxItemId] = useState('')
  const [productionItemId, setProductionItemId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [specificsOpen, setSpecificsOpen] = useState(false)

  // Category type-ahead
  const [catQuery, setCatQuery] = useState('')
  const [catSuggestions, setCatSuggestions] = useState<CategorySuggestion[]>([])
  const [catLoading, setCatLoading] = useState(false)
  const catDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCategories = useCallback(
    (q: string) => {
      if (!q.trim()) { setCatSuggestions([]); return }
      setCatLoading(true)
      fetch(`/api/categories?q=${encodeURIComponent(q)}&env=${defaultEnv}`)
        .then(r => r.json())
        .then(data => { setCatSuggestions(Array.isArray(data) ? data : []); setCatLoading(false) })
        .catch(() => setCatLoading(false))
    },
    [defaultEnv]
  )

  useEffect(() => {
    if (catDebounce.current) clearTimeout(catDebounce.current)
    catDebounce.current = setTimeout(() => fetchCategories(catQuery), 350)
    return () => { if (catDebounce.current) clearTimeout(catDebounce.current) }
  }, [catQuery, fetchCategories])

  function set<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function addSpecific() { set('itemSpecifics', [...form.itemSpecifics, { name: '', value: '' }]) }
  function setSpecific(i: number, field: 'name' | 'value', val: string) {
    const s = [...form.itemSpecifics]
    s[i] = { ...s[i], [field]: val }
    set('itemSpecifics', s)
  }
  function removeSpecific(i: number) {
    set('itemSpecifics', form.itemSpecifics.filter((_, idx) => idx !== i))
  }

  function buildPayload(env: EbayEnv, photos: string[]): NewListingData & { env: EbayEnv } {
    return {
      env,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      categoryId: form.categoryId,
      conditionId: form.conditionId,
      listingType: form.listingType,
      startPrice: parseFloat(form.startPrice),
      buyItNowPrice: form.buyItNowPrice ? parseFloat(form.buyItNowPrice) : undefined,
      reservePrice: form.reservePrice ? parseFloat(form.reservePrice) : undefined,
      duration: form.duration,
      quantity: parseInt(form.quantity) || 1,
      photos,
      shippingService: form.shippingService,
      shippingCost: parseFloat(form.shippingCost) || 0,
      returnsAccepted: form.returnsAccepted,
      returnDays: form.returnDays || undefined,
      location: form.location.trim() || undefined,
      itemSpecifics: form.itemSpecifics.filter(s => s.name && s.value),
    }
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required'
    if (form.title.length > 80) return 'Title must be 80 characters or less'
    if (!form.categoryId) return 'Category is required'
    if (!form.startPrice || isNaN(parseFloat(form.startPrice))) return 'Starting price is required'
    if (form.photos.filter(Boolean).length === 0) return 'At least one photo is required — upload via the image picker'
    return null
  }

  async function reuploadToProduction(blobUrls: string[]): Promise<string[]> {
    return Promise.all(
      blobUrls.map(async (blobUrl) => {
        const blob = await fetch(blobUrl).then(r => r.blob())
        const fd = new FormData()
        fd.append('file', blob, 'image.jpg')
        fd.append('env', 'production')
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error ?? 'Image re-upload failed')
        return data.url as string
      })
    )
  }

  async function submit(env: EbayEnv) {
    const err = validate()
    if (err) { setErrorMsg(err); setSubmitState('error'); return }

    setErrorMsg('')
    setSubmitState(env === 'sandbox' ? 'testing' : 'publishing')

    try {
      // Re-upload images to production EPS so URLs are publicly accessible
      const photos = env === 'production'
        ? await reuploadToProduction(photoBlobUrls)
        : form.photos.filter(Boolean)

      const res = await fetch('/api/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(env, photos)),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error')

      if (env === 'sandbox') {
        setSandboxItemId(data.itemId)
        setSubmitState('sandbox_done')
      } else {
        setProductionItemId(data.itemId)
        setSubmitState('production_done')
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Request failed')
      setSubmitState('error')
    }
  }

  const busy = submitState === 'testing' || submitState === 'publishing'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Required fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Required information</h2>

        <Field label="Title" required>
          <div className="relative">
            <input
              className={inputCls + ' w-full pr-14'}
              maxLength={80}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Item title (max 80 chars)"
            />
            <span className="absolute right-3 top-2 text-xs text-gray-400">
              {form.title.length}/80
            </span>
          </div>
        </Field>

        <Field label="Category" required>
          <div className="relative">
            <input
              className={inputCls + ' w-full'}
              value={catQuery || form.categoryName}
              onChange={e => { setCatQuery(e.target.value); set('categoryId', ''); set('categoryName', '') }}
              placeholder="Type to search categories…"
            />
            {catLoading && (
              <span className="absolute right-3 top-2 text-xs text-gray-400">Searching…</span>
            )}
            {catSuggestions.length > 0 && !form.categoryId && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-md max-h-48 overflow-y-auto">
                {catSuggestions.map(s => (
                  <li
                    key={s.categoryId}
                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                    onClick={() => {
                      set('categoryId', s.categoryId)
                      set('categoryName', s.categoryName)
                      setCatQuery('')
                      setCatSuggestions([])
                    }}
                  >
                    <span className="font-medium">{s.categoryName}</span>
                    {s.categoryParentName && (
                      <span className="text-gray-400 ml-1">({s.categoryParentName})</span>
                    )}
                    <span className="text-gray-300 ml-1 text-xs">#{s.categoryId}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {form.categoryId && (
            <p className="text-xs text-green-700">
              Selected: {form.categoryName} <span className="text-gray-400">(#{form.categoryId})</span>
              <button
                type="button"
                className="ml-2 text-red-400 hover:text-red-600"
                onClick={() => { set('categoryId', ''); set('categoryName', ''); setCatQuery('') }}
              >
                ×
              </button>
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Condition" required>
            <select
              className={inputCls + ' w-full'}
              value={form.conditionId}
              onChange={e => set('conditionId', e.target.value)}
            >
              {CONDITION_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Listing type" required>
            <select
              className={inputCls + ' w-full'}
              value={form.listingType}
              onChange={e => set('listingType', e.target.value as FormValues['listingType'])}
            >
              <option value="Chinese">Auction</option>
              <option value="FixedPriceItem">Fixed price</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={form.listingType === 'Chinese' ? 'Starting bid ($)' : 'Price ($)'} required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputCls + ' w-full'}
              value={form.startPrice}
              onChange={e => set('startPrice', e.target.value)}
              placeholder="0.99"
            />
          </Field>

          <Field label="Duration" required>
            <select
              className={inputCls + ' w-full'}
              value={form.duration}
              onChange={e => set('duration', e.target.value)}
            >
              {DURATION_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Shipping service" required>
            <select
              className={inputCls + ' w-full'}
              value={form.shippingService}
              onChange={e => set('shippingService', e.target.value)}
            >
              {SHIPPING_SERVICES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="Shipping cost ($)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls + ' w-full'}
              value={form.shippingCost}
              onChange={e => set('shippingCost', e.target.value)}
              placeholder="0.00 for free"
            />
          </Field>
        </div>

        <Field label="Photos" required>
          <ImageUploader
            env={defaultEnv}
            onChange={(ebayUrls, blobUrls) => {
              set('photos', ebayUrls)
              setPhotoBlobUrls(blobUrls)
            }}
          />
        </Field>
      </div>

      {/* Optional fields */}
      <SectionToggle label="Optional details" open={optionalOpen} onToggle={() => setOptionalOpen(o => !o)}>
        <Field label="Description">
          <textarea
            rows={5}
            className={inputCls + ' w-full resize-y'}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Describe your item…"
          />
        </Field>

        {form.listingType === 'Chinese' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Buy It Now price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls + ' w-full'}
                value={form.buyItNowPrice}
                onChange={e => set('buyItNowPrice', e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Reserve price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls + ' w-full'}
                value={form.reservePrice}
                onChange={e => set('reservePrice', e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity">
            <input
              type="number"
              min="1"
              className={inputCls + ' w-full'}
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
            />
          </Field>
          <Field label="Item location">
            <input
              className={inputCls + ' w-full'}
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="City, State"
            />
          </Field>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.returnsAccepted}
              onChange={e => set('returnsAccepted', e.target.checked)}
              className="rounded"
            />
            Accept returns
          </label>
          {form.returnsAccepted && (
            <div className="mt-2">
              <Field label="Return window">
                <select
                  className={inputCls + ' w-full'}
                  value={form.returnDays}
                  onChange={e => set('returnDays', e.target.value)}
                >
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
              </Field>
            </div>
          )}
        </div>
      </SectionToggle>

      {/* Item specifics */}
      <SectionToggle label="Item specifics (brand, size, color, etc.)" open={specificsOpen} onToggle={() => setSpecificsOpen(o => !o)}>
        <div className="space-y-2">
          {form.itemSpecifics.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputCls + ' flex-1'}
                value={s.name}
                onChange={e => setSpecific(i, 'name', e.target.value)}
                placeholder="Name (e.g. Brand)"
              />
              <input
                className={inputCls + ' flex-1'}
                value={s.value}
                onChange={e => setSpecific(i, 'value', e.target.value)}
                placeholder="Value (e.g. Nike)"
              />
              <button
                type="button"
                onClick={() => removeSpecific(i)}
                className="text-red-400 hover:text-red-600 px-2 text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSpecific}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add item specific
          </button>
        </div>
      </SectionToggle>

      {/* Status messages */}
      {submitState === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {(submitState === 'sandbox_done' || submitState === 'production_done') && sandboxItemId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <strong>Sandbox test passed</strong> — item ID: <code>{sandboxItemId}</code>
          <br />
          <span className="text-xs text-blue-600">
            This was posted to sandbox only. Use the button below to publish for real.
          </span>
        </div>
      )}

      {submitState === 'production_done' && productionItemId && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <strong>Listed on eBay!</strong> — item ID: <code>{productionItemId}</code>
        </div>
      )}

      {/* Submit buttons */}
      <div className="flex gap-3">
        {submitState !== 'production_done' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('sandbox')}
            className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
          >
            {submitState === 'testing' ? 'Testing in sandbox…' : 'Test in Sandbox'}
          </button>
        )}

        {(submitState === 'sandbox_done' || submitState === 'error' || submitState === 'publishing' || submitState === 'production_done') && (
          <button
            type="button"
            disabled={busy || submitState === 'production_done'}
            onClick={() => submit('production')}
            className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            {submitState === 'publishing'
              ? 'Publishing…'
              : submitState === 'production_done'
              ? 'Published!'
              : 'Publish to eBay'}
          </button>
        )}
      </div>
    </div>
  )
}
