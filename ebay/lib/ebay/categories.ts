import { tradingApiCall } from './client'
import { getCredentials, type EbayEnv } from '../env'

export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  categoryParentName?: string
}

export async function getCategorySuggestions(
  query: string,
  env: EbayEnv
): Promise<CategorySuggestion[]> {
  const creds = getCredentials(env)

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetSuggestedCategoriesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${creds.token}</eBayAuthToken>
  </RequesterCredentials>
  <Query>${query}</Query>
  <CategoryCount>10</CategoryCount>
</GetSuggestedCategoriesRequest>`

  const result = await tradingApiCall('GetSuggestedCategories', xml, env)
  const response = result?.GetSuggestedCategoriesResponse

  if (!response?.SuggestedCategoryArray) return []

  const suggestions = response.SuggestedCategoryArray.SuggestedCategory
  const arr = Array.isArray(suggestions) ? suggestions : [suggestions]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return arr.map((s: any) => ({
    categoryId: String(s?.Category?.CategoryID ?? ''),
    categoryName: String(s?.Category?.CategoryName ?? ''),
    categoryParentName: s?.Category?.CategoryParentName as string | undefined,
  }))
}
