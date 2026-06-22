import { getCredentials, type EbayEnv } from '../env'

export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  categoryParentName?: string
}

async function getAppToken(env: EbayEnv): Promise<string> {
  const creds = getCredentials(env)
  const baseUrl =
    env === 'sandbox'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com'

  const encoded = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')

  const res = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })

  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth token error: ${JSON.stringify(data)}`)
  return data.access_token as string
}

export async function getCategorySuggestions(
  query: string,
  env: EbayEnv
): Promise<CategorySuggestion[]> {
  const token = await getAppToken(env)
  const baseUrl =
    env === 'sandbox'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com'

  const res = await fetch(
    `${baseUrl}/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  if (!data.categorySuggestions) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.categorySuggestions.slice(0, 10).map((s: any) => ({
    categoryId: String(s.category?.categoryId ?? ''),
    categoryName: String(s.category?.categoryName ?? ''),
    categoryParentName: s.categoryTreeNodeAncestors?.[0]?.categoryName as string | undefined,
  }))
}
