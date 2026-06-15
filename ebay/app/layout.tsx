import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My Auction Listing Tool',
  description: 'Manage and create eBay listings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">e</span>
            </div>
            <span className="font-semibold text-gray-900">My Auction Listing Tool</span>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/listings/new" className="text-blue-600 hover:text-blue-800 font-medium">+ New Listing</a>
          </nav>
        </header>
        <main className="px-6 py-8 max-w-6xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
