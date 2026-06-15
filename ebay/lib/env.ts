export type EbayEnv = 'sandbox' | 'production'

export function getCredentials(env: EbayEnv) {
  if (env === 'sandbox') {
    return {
      clientId: process.env.EBAY_SANDBOX_CLIENT_ID!,
      clientSecret: process.env.EBAY_SANDBOX_CLIENT_SECRET!,
      devId: process.env.EBAY_SANDBOX_DEV_ID!,
      token: process.env.EBAY_SANDBOX_ACCESS_TOKEN || '',
      apiUrl: 'https://api.sandbox.ebay.com/ws/api.dll',
    }
  }
  return {
    clientId: process.env.EBAY_PROD_CLIENT_ID!,
    clientSecret: process.env.EBAY_PROD_CLIENT_SECRET!,
    devId: process.env.EBAY_PROD_DEV_ID!,
    token: process.env.EBAY_PROD_ACCESS_TOKEN || process.env.EBAY_ACCESS_TOKEN || '',
    apiUrl: 'https://api.ebay.com/ws/api.dll',
  }
}
