import { NextRequest, NextResponse } from 'next/server'
import { createListing, type NewListingData } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { env = 'sandbox', ...listingData } = body as NewListingData & { env?: EbayEnv }

  try {
    const result = await createListing(listingData, env)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
