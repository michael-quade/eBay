import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import { getCredentials, type EbayEnv } from '@/lib/env'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  textNodeName: '#text',
})

const MAX_BYTES = 7 * 1024 * 1024 // 7 MB — eBay's limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp']

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const env = (formData.get('env') ?? 'sandbox') as EbayEnv

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 7 MB limit' }, { status: 400 })
  }

  const creds = getCredentials(env)

  if (!creds.token) {
    return NextResponse.json(
      { error: `No access token configured for ${env}. Set EBAY_${env.toUpperCase()}_ACCESS_TOKEN in .env.local.` },
      { status: 401 }
    )
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <PictureSet>Standard</PictureSet>
</UploadSiteHostedPicturesRequest>`

  // eBay requires a multipart body where the first part is named "XML Payload"
  const ebayForm = new FormData()
  ebayForm.append('XML Payload', new Blob([xml], { type: 'text/xml;charset=UTF-8' }), 'payload.xml')
  ebayForm.append('image', file, file.name)

  const response = await fetch(creds.apiUrl, {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-DEV-NAME': creds.devId,
      'X-EBAY-API-APP-NAME': creds.clientId,
      'X-EBAY-API-CERT-NAME': creds.clientSecret,
      'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
      'X-EBAY-API-SITEID': '0',
    },
    body: ebayForm,
  })

  const text = await response.text()
  const result = parser.parse(text)
  const res = result?.UploadSiteHostedPicturesResponse

  if (res?.Ack === 'Failure') {
    const errors = Array.isArray(res?.Errors) ? res.Errors : [res?.Errors]
    const msg = errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; ')
    return NextResponse.json({ error: msg || 'eBay upload failed' }, { status: 502 })
  }

  const url = res?.SiteHostedPictureDetails?.FullURL as string | undefined
  if (!url) {
    return NextResponse.json({ error: 'No URL returned by eBay' }, { status: 502 })
  }

  return NextResponse.json({ url })
}
