import { XMLParser } from 'fast-xml-parser'
import { getCredentials, type EbayEnv } from '../env'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  textNodeName: '#text',
})

export async function tradingApiCall(
  callName: string,
  xmlBody: string,
  env: EbayEnv
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const creds = getCredentials(env)

  const response = await fetch(creds.apiUrl, {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-DEV-NAME': creds.devId,
      'X-EBAY-API-APP-NAME': creds.clientId,
      'X-EBAY-API-CERT-NAME': creds.clientSecret,
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml',
    },
    body: xmlBody,
  })

  const text = await response.text()
  return parser.parse(text)
}
