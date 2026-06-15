import { NextRequest, NextResponse } from 'next/server'
import { getCategorySuggestions } from '@/lib/ebay/categories'
import type { EbayEnv } from '@/lib/env'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  const env = (request.nextUrl.searchParams.get('env') ??
    process.env.EBAY_ENVIRONMENT ??
    'sandbox') as EbayEnv

  if (!q.trim()) return NextResponse.json([])

  try {
    const suggestions = await getCategorySuggestions(q, env)
    return NextResponse.json(suggestions)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
