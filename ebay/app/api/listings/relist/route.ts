import { NextRequest, NextResponse } from 'next/server'
import { relistItem } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

export async function POST(request: NextRequest) {
  const { itemId, price, env = 'production' } = await request.json() as {
    itemId: string
    price?: number | null
    env?: EbayEnv
  }

  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
  }
  if (price !== undefined && price !== null && (typeof price !== 'number' || price <= 0)) {
    return NextResponse.json({ error: 'price must be a positive number' }, { status: 400 })
  }

  try {
    const result = await relistItem(itemId, price ?? null, env)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
