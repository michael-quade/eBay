import { tradingApiCall } from './client'
import { getCredentials, type EbayEnv } from '../env'

export interface EbayListing {
  itemId: string
  title: string
  currentPrice: number
  currency: string
  bidCount: number
  watchCount: number
  hitCount: number
  listingType: string
  galleryUrl?: string
  viewItemUrl: string
  endTime: string
  timeLeft: string
  status: 'active' | 'unsold'
}

export interface SoldItem {
  orderId: string
  itemId: string
  title: string
  salePrice: number           // hammer price (item only)
  shippingPaidByBuyer: number // shipping amount buyer paid
  salesTax: number            // collected & remitted by eBay — seller never keeps this
  buyerPaidTotal: number      // total buyer paid = salePrice + shipping + tax
  finalValueFee: number       // total eBay fees (variable FVF + per-order fixed fee)
  currency: string
  quantity: number
  buyerUserId: string
  saleDate: string
  paidDate?: string
  shippedDate?: string
  status: 'awaiting_payment' | 'paid' | 'shipped' | 'cancelled'
  trackingNumber?: string
  trackingCarrier?: string
  galleryUrl?: string
  viewItemUrl?: string
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
  <UnsoldList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>50</EntriesPerPage></Pagination>
  </UnsoldList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`

  const result = await tradingApiCall('GetMyeBaySelling', xml, env)
  const response = result?.GetMyeBaySellingResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapItem(item: any, status: EbayListing['status']): EbayListing {
    return {
      itemId: String(item.ItemID),
      title: String(item.Title ?? ''),
      currentPrice: extractPrice(item.SellingStatus?.CurrentPrice),
      currency: item.SellingStatus?.CurrentPrice?.['@_currencyID'] ?? 'USD',
      bidCount: Number(item.SellingStatus?.BidCount ?? 0),
      watchCount: Number(item.WatchCount ?? 0),
      hitCount: Number(item.HitCount ?? 0),
      listingType: String(item.ListingType ?? ''),
      galleryUrl: item.PictureDetails?.GalleryURL as string | undefined,
      viewItemUrl: String(item.ListingDetails?.ViewItemURL ?? ''),
      endTime: String(item.ListingDetails?.EndTime ?? ''),
      timeLeft: String(item.TimeLeft ?? ''),
      status,
    }
  }

  const activeItems = response?.ActiveList?.ItemArray?.Item
  const unsoldItems = response?.UnsoldList?.ItemArray?.Item

  const active = activeItems
    ? (Array.isArray(activeItems) ? activeItems : [activeItems]).map(i => mapItem(i, 'active'))
    : []

  const unsold = unsoldItems
    ? (Array.isArray(unsoldItems) ? unsoldItems : [unsoldItems]).map(i => mapItem(i, 'unsold'))
    : []

  return [...active, ...unsold]
}

export async function getSoldItems(env: EbayEnv): Promise<SoldItem[]> {
  const creds = getCredentials(env)

  const now = new Date()
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 90)

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${sixMonthsAgo.toISOString()}</CreateTimeFrom>
  <CreateTimeTo>${now.toISOString()}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeFinalValueFee>true</IncludeFinalValueFee>
  <Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
</GetOrdersRequest>`

  const result = await tradingApiCall('GetOrders', xml, env)
  const response = result?.GetOrdersResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }

  const orders = response?.OrderArray?.Order
  if (!orders) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(orders) ? orders : [orders]).flatMap((order: any) => {
    const transactions = order.TransactionArray?.Transaction
    if (!transactions) return []

    let status: SoldItem['status'] = 'awaiting_payment'
    if (String(order.OrderStatus) === 'Cancelled') status = 'cancelled'
    else if (order.ShippedTime) status = 'shipped'
    else if (order.PaidTime || order.CheckoutStatus?.Status === 'Complete') status = 'paid'

    const buyerPaidTotal = extractPrice(order.AmountPaid)
    // eBay returns shipping cost under different paths depending on API version
    const shippingPaidByBuyer =
      extractPrice(order.ShippingDetails?.ShippingServiceSelected?.ShippingServiceCost) ||
      extractPrice(order.ShippingCost) ||
      extractPrice(order.ShippingDetails?.ShippingServiceOptions?.ShippingServiceCost) ||
      0
    // Per-order fixed fee lives at Order.FinalValueFee (separate from per-transaction variable FVF)
    const orderLevelFee = extractPrice(order.FinalValueFee)

    const txList = Array.isArray(transactions) ? transactions : [transactions]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return txList.map((tx: any, txIndex: number) => {
      const trackingRaw = tx.ShippingDetails?.ShipmentTrackingDetails
      const trackingList = trackingRaw ? (Array.isArray(trackingRaw) ? trackingRaw : [trackingRaw]) : []
      const tracking = trackingList[0]

      // Sales tax — eBay collects and remits; seller never keeps it
      let salesTax = 0
      const taxDetails = tx.Taxes?.TaxDetails
      if (taxDetails) {
        const taxList = Array.isArray(taxDetails) ? taxDetails : [taxDetails]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        salesTax = taxList.reduce((sum: number, t: any) => sum + extractPrice(t.TaxAmount), 0)
      }

      // Total eBay fees = transaction-level variable FVF + per-order fixed fee (first tx only)
      const finalValueFee = extractPrice(tx.FinalValueFee) + (txIndex === 0 ? orderLevelFee : 0)

      return {
        orderId: String(order.OrderID ?? ''),
        itemId: String(tx.Item?.ItemID ?? ''),
        title: String(tx.Item?.Title ?? ''),
        salePrice: extractPrice(tx.TransactionPrice),
        shippingPaidByBuyer,
        salesTax,
        buyerPaidTotal,
        finalValueFee,
        currency: tx.TransactionPrice?.['@_currencyID'] ?? 'USD',
        quantity: Number(tx.QuantityPurchased ?? 1),
        buyerUserId: String(order.BuyerUserID ?? tx.Buyer?.UserID ?? ''),
        saleDate: String(order.CreatedTime ?? ''),
        paidDate: order.PaidTime ? String(order.PaidTime) : undefined,
        shippedDate: order.ShippedTime ? String(order.ShippedTime) : undefined,
        status,
        trackingNumber: tracking?.ShipmentTrackingNumber ? String(tracking.ShipmentTrackingNumber) : undefined,
        trackingCarrier: tracking?.ShippingCarrierUsed ? String(tracking.ShippingCarrierUsed) : undefined,
        galleryUrl: tx.Item?.PictureDetails?.GalleryURL as string | undefined,
        viewItemUrl: tx.Item?.ListingDetails?.ViewItemURL as string | undefined,
      } satisfies SoldItem
    })
  })
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

  const locationXml = `<Location>${escapeXml(data.location || 'United States')}</Location>`

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
    <HitCounter>BasicStyle</HitCounter>
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

export async function relistItem(
  itemId: string,
  newPrice: number | null,
  env: EbayEnv
): Promise<{ itemId: string }> {
  const creds = getCredentials(env)

  const priceXml = newPrice != null
    ? `<StartPrice currencyID="USD">${newPrice.toFixed(2)}</StartPrice>`
    : ''

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<RelistItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    ${priceXml}
  </Item>
</RelistItemRequest>`

  const result = await tradingApiCall('RelistItem', xml, env)
  const response = result?.RelistItemResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }

  return { itemId: String(response?.ItemID) }
}

export async function reviseItemPrice(
  itemId: string,
  newPrice: number,
  env: EbayEnv
): Promise<void> {
  const creds = getCredentials(env)

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    <StartPrice currencyID="USD">${newPrice.toFixed(2)}</StartPrice>
  </Item>
</ReviseItemRequest>`

  const result = await tradingApiCall('ReviseItem', xml, env)
  const response = result?.ReviseItemResponse

  if (response?.Ack === 'Failure') {
    const errors = Array.isArray(response?.Errors) ? response.Errors : [response?.Errors]
    throw new Error(errors.map((e: { LongMessage?: string }) => e?.LongMessage).filter(Boolean).join('; '))
  }
}
