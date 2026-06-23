import { NextRequest, NextResponse } from 'next/server'
import { getCredentials, type EbayEnv } from '@/lib/env'

export async function GET(request: NextRequest) {
  const env = (request.nextUrl.searchParams.get('env') ?? 'production') as EbayEnv
  const creds = getCredentials(env)

  // 1. Show what credentials are loaded (mask middle of token)
  const token = creds.token
  const maskedToken = token.length > 20
    ? `${token.slice(0, 10)}...${token.slice(-10)}`
    : '(empty)'

  const credsSummary = {
    clientId: creds.clientId || '(empty)',
    clientSecret: creds.clientSecret ? `${creds.clientSecret.slice(0, 8)}...` : '(empty)',
    devId: creds.devId || '(empty)',
    token: maskedToken,
    apiUrl: creds.apiUrl,
  }

  // 2. Test with GeteBayOfficialTime (no auth required — tests connectivity)
  const timeXml = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
</GeteBayOfficialTimeRequest>`

  let timeRaw = ''
  let timeError = ''
  try {
    const res = await fetch(creds.apiUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': creds.devId,
        'X-EBAY-API-APP-NAME': creds.clientId,
        'X-EBAY-API-CERT-NAME': creds.clientSecret,
        'X-EBAY-API-CALL-NAME': 'GeteBayOfficialTime',
        'X-EBAY-API-SITEID': '0',
        'Content-Type': 'text/xml',
      },
      body: timeXml,
    })
    timeRaw = await res.text()
  } catch (e: unknown) {
    timeError = e instanceof Error ? e.message : String(e)
  }

  // 3. Test GetUser (requires valid token)
  const userXml = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
</GetUserRequest>`

  let userRaw = ''
  let userError = ''
  try {
    const res = await fetch(creds.apiUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': creds.devId,
        'X-EBAY-API-APP-NAME': creds.clientId,
        'X-EBAY-API-CERT-NAME': creds.clientSecret,
        'X-EBAY-API-CALL-NAME': 'GetUser',
        'X-EBAY-API-SITEID': '0',
        'Content-Type': 'text/xml',
      },
      body: userXml,
    })
    userRaw = await res.text()
  } catch (e: unknown) {
    userError = e instanceof Error ? e.message : String(e)
  }

  // 4. Optional: GetItem for a specific itemId to inspect HitCount field path
  const itemId = request.nextUrl.searchParams.get('itemId')
  let getItemResult: unknown = null
  let getItemError = ''
  if (itemId) {
    const itemXml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
</GetItemRequest>`
    try {
      const res = await fetch(creds.apiUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-DEV-NAME': creds.devId,
          'X-EBAY-API-APP-NAME': creds.clientId,
          'X-EBAY-API-CERT-NAME': creds.clientSecret,
          'X-EBAY-API-CALL-NAME': 'GetItem',
          'X-EBAY-API-SITEID': '0',
          'Content-Type': 'text/xml',
        },
        body: itemXml,
      })
      const raw = await res.text()
      // Return both raw XML and a quick grep for HitCount
      const hitCountMatch = raw.match(/<HitCount>(\d+)<\/HitCount>/)
      const watchCountMatch = raw.match(/<WatchCount>(\d+)<\/WatchCount>/)
      getItemResult = {
        hitCountInRawXml: hitCountMatch ? hitCountMatch[1] : '(not found in XML)',
        watchCountInRawXml: watchCountMatch ? watchCountMatch[1] : '(not found in XML)',
        rawXml: raw,
      }
    } catch (e: unknown) {
      getItemError = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    env,
    credentials: credsSummary,
    geteBayOfficialTime: { raw: timeRaw, fetchError: timeError },
    getUser: { raw: userRaw, fetchError: userError },
    ...(itemId ? { getItem: { itemId, result: getItemResult, fetchError: getItemError } } : {}),
  })
}
