import { NextRequest, NextResponse } from 'next/server'
import { reviseItemPrice } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

export async function POST(request: NextRequest) {
  const { itemId, price, env = 'production' } = await request.json() as {
    itemId: string
    price: number
    env?: EbayEnv
  }

  if (!itemId || typeof price !== 'number' || price <= 0) {
    return NextResponse.json({ error: 'itemId and a positive price are required' }, { status: 400 })
  }

  try {
    await reviseItemPrice(itemId, price, env)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
