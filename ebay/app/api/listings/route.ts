import { NextRequest, NextResponse } from 'next/server'
import { getActiveListings, getSoldItems } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

export async function GET(request: NextRequest) {
  const env = (request.nextUrl.searchParams.get('env') ??
    process.env.EBAY_ENVIRONMENT ??
    'sandbox') as EbayEnv

  try {
    const [listings, soldItems] = await Promise.all([
      getActiveListings(env),
      getSoldItems(env),
    ])
    return NextResponse.json({ listings, soldItems, env })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
