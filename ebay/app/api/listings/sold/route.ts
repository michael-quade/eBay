import { NextRequest, NextResponse } from 'next/server'
import { getSoldItems } from '@/lib/ebay/listings'
import type { EbayEnv } from '@/lib/env'

export async function GET(request: NextRequest) {
  const env = (request.nextUrl.searchParams.get('env') ?? 'production') as EbayEnv
  try {
    const soldItems = await getSoldItems(env)
    return NextResponse.json({ soldItems, env })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
