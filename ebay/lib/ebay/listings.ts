import { tradingApiCall } from './client'
import { getCredentials, type EbayEnv } from '../env'

export interface EbayListing {
  itemId: string
  title: string
  currentPrice: number
  currency: string
  bidCount: number
  watchCount: number
  listingType: string
  galleryUrl?: string
  viewItemUrl: string
  endTime: string
  timeLeft: string
}

export interface NewListingData {
  title: string
  description?: string
  categoryId: string
  conditionId: string
  listingType: 'Chinese' | 'FixedPriceItem'
  startPrice: number
  buyItNowPrice?: number
  reservePrice?: number
  duration: string
  quantity?: number
  photos: string[]
  shippingService: string
  shippingCost: number
  returnsAccepted: boolean
  returnDays?: string
  location?: string
  itemSpecifics?: { name: string; value: string }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPrice(priceNode: any): number {
  if (typeof priceNode === 'number') return priceNode
  if (typeof priceNode === 'object' && priceNode !== null) {
    return Number(priceNode['#text'] ?? 0)
  }
  return Number(priceNode ?? 0)
}

export async function getActiveListings(env: EbayEnv): Promise<EbayListing[]> {
  const creds = getCredentials(env)

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>100</EntriesPerPage></Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`

  const result = await tradingApiCall('GetMyeBaySelling', xml, env)
  const response = result?.GetMyeBaySellingResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }

  const items = response?.ActiveList?.ItemArray?.Item
  if (!items) return []

  const arr = Array.isArray(items) ? items : [items]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return arr.map((item: any) => ({
    itemId: String(item.ItemID),
    title: String(item.Title ?? ''),
    currentPrice: extractPrice(item.SellingStatus?.CurrentPrice),
    currency: item.SellingStatus?.CurrentPrice?.['@_currencyID'] ?? 'USD',
    bidCount: Number(item.SellingStatus?.BidCount ?? 0),
    watchCount: Number(item.WatchCount ?? 0),
    listingType: String(item.ListingType ?? ''),
    galleryUrl: item.PictureDetails?.GalleryURL as string | undefined,
    viewItemUrl: String(item.ListingDetails?.ViewItemURL ?? ''),
    endTime: String(item.ListingDetails?.EndTime ?? ''),
    timeLeft: String(item.TimeLeft ?? ''),
  }))
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function createListing(
  data: NewListingData,
  env: EbayEnv
): Promise<{ itemId: string; env: EbayEnv }> {
  const creds = getCredentials(env)

  const pictureUrls = data.photos
    .filter(Boolean)
    .map(url => `    <PictureURL>${url}</PictureURL>`)
    .join('\n')

  const itemSpecificsXml =
    data.itemSpecifics?.length
      ? `<ItemSpecifics>\n${data.itemSpecifics
          .map(s => `      <NameValueList><Name>${escapeXml(s.name)}</Name><Value>${escapeXml(s.value)}</Value></NameValueList>`)
          .join('\n')}\n    </ItemSpecifics>`
      : ''

  const buyItNowXml = data.buyItNowPrice
    ? `<BuyItNowPrice currencyID="USD">${data.buyItNowPrice}</BuyItNowPrice>`
    : ''

  const reserveXml = data.reservePrice
    ? `<ReservePrice currencyID="USD">${data.reservePrice}</ReservePrice>`
    : ''

  const returnPolicyXml = data.returnsAccepted
    ? `<ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_${data.returnDays ?? '30'}</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>`
    : `<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>`

  const locationXml = data.location
    ? `<Location>${escapeXml(data.location)}</Location>`
    : ''

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(data.title)}</Title>
    <Description><![CDATA[${data.description ?? ''}]]></Description>
    <PrimaryCategory><CategoryID>${data.categoryId}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">${data.startPrice}</StartPrice>
    <ConditionID>${data.conditionId}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>${data.duration}</ListingDuration>
    <ListingType>${data.listingType}</ListingType>
    ${buyItNowXml}
    ${reserveXml}
    <Quantity>${data.quantity ?? 1}</Quantity>
    <PictureDetails>
${pictureUrls}
    </PictureDetails>
    ${itemSpecificsXml}
    ${returnPolicyXml}
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>${data.shippingService}</ShippingService>
        <ShippingServiceCost currencyID="USD">${data.shippingCost}</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <Site>US</Site>
    ${locationXml}
  </Item>
</AddItemRequest>`

  const result = await tradingApiCall('AddItem', xml, env)
  const response = result?.AddItemResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }

  return { itemId: String(response?.ItemID), env }
}
