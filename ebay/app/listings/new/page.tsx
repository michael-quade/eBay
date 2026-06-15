import NewListingForm from '@/components/NewListingForm'
import type { EbayEnv } from '@/lib/env'

export default function NewListingPage() {
  const defaultEnv = (process.env.EBAY_ENVIRONMENT ?? 'sandbox') as EbayEnv

  return (
    <div className="space-y-6">
      <div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-xl font-bold text-gray-900 mt-1">New Listing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Test in sandbox first, then publish to eBay with one click.
        </p>
      </div>

      <NewListingForm defaultEnv={defaultEnv} />
    </div>
  )
}
