# eBay Listing Manager

A web application for monitoring active eBay listings and creating new ones with a streamlined, field-skippable listing form.

---

## Project Overview

- **Purpose**: Simplified eBay seller dashboard — view active listings and create new ones without leaving a browser tab
- **Stack**: Next.js (App Router) + React, Node.js API routes, SQLite (local draft storage), Tailwind CSS
- **eBay Integration**: eBay RESTful Sell APIs with OAuth 2.0

---

## Environment Variables

Create a `.env.local` file at the project root. **Never commit this file.**

```env
# eBay Developer Credentials
# Obtain from https://developer.ebay.com/my/keys
EBAY_CLIENT_ID=          # "App ID" in the developer portal
EBAY_CLIENT_SECRET=      # "Cert ID" in the developer portal
EBAY_DEV_ID=             # "Dev ID" (required for older Trading API calls)

# OAuth Redirect URI — must exactly match what is registered in the eBay dev portal
# Local dev example: http://localhost:3000/api/auth/ebay/callback
EBAY_REDIRECT_URI=

# "sandbox" or "production"
EBAY_ENVIRONMENT=sandbox

# Stored OAuth tokens (populated automatically after first login — can also be set manually)
EBAY_ACCESS_TOKEN=
EBAY_REFRESH_TOKEN=
EBAY_TOKEN_EXPIRY=       # ISO timestamp, e.g. 2026-06-01T12:00:00Z

# App
PORT=3000
SESSION_SECRET=          # Random 32+ char string for cookie signing
DATABASE_URL=./data/ebay.db   # SQLite path for draft listings
```

---

## eBay Developer Setup (one-time)

1. Create an account at [developer.ebay.com](https://developer.ebay.com).
2. Create an application in **My Account → Application Keys**.
   - Copy `App ID` → `EBAY_CLIENT_ID`
   - Copy `Cert ID` → `EBAY_CLIENT_SECRET`
   - Copy `Dev ID` → `EBAY_DEV_ID`
3. Under **Auth Tokens**, add your `EBAY_REDIRECT_URI` to the allowed redirect URIs.
4. Start in **Sandbox** environment to test without real listings.
5. Switch `EBAY_ENVIRONMENT=production` and rotate to production keys when ready to go live.

**Required eBay API scopes (OAuth):**
- `https://api.ebay.com/oauth/api_scope/sell.inventory`
- `https://api.ebay.com/oauth/api_scope/sell.inventory.readonly`
- `https://api.ebay.com/oauth/api_scope/sell.account`
- `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly`

---

## Architecture

```
/
├── app/
│   ├── page.tsx                  # Dashboard — active listings list
│   ├── listings/
│   │   └── new/page.tsx          # New listing creation form
│   ├── api/
│   │   ├── auth/
│   │   │   ├── ebay/route.ts     # Redirect to eBay OAuth consent screen
│   │   │   └── ebay/callback/route.ts  # Receive code, exchange for tokens
│   │   ├── listings/
│   │   │   ├── route.ts          # GET: fetch active listings from eBay API
│   │   │   └── create/route.ts   # POST: submit new listing to eBay API
│   │   └── categories/route.ts   # GET: eBay category suggestions
│   └── layout.tsx
├── components/
│   ├── ListingCard.tsx           # Single listing display (bids, days left, price)
│   ├── ListingsGrid.tsx          # Responsive grid of ListingCards
│   └── NewListingForm.tsx        # Multi-step form with skippable optional fields
├── lib/
│   ├── ebay/
│   │   ├── auth.ts               # Token management, refresh logic
│   │   ├── client.ts             # Authenticated fetch wrapper for eBay APIs
│   │   ├── listings.ts           # getActiveListings(), createListing()
│   │   └── categories.ts        # getCategorySuggestions()
│   └── db.ts                     # SQLite client (better-sqlite3), draft storage
├── data/
│   └── ebay.db                   # Auto-created SQLite file (gitignored)
├── .env.local                    # Secret credentials (gitignored)
└── CLAUDE.md
```

---

## Implementation Steps

### Step 1 — Project Scaffolding
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npm install better-sqlite3 @types/better-sqlite3
npm install iron-session          # Secure encrypted cookie sessions
```

### Step 2 — Database Setup (`lib/db.ts`)
- Initialize SQLite on startup
- Create `drafts` table: `id, title, description, price, category_id, condition, photos_json, created_at`
- Drafts are listings started but not yet submitted to eBay

### Step 3 — eBay OAuth Flow
- `GET /api/auth/ebay` → build authorization URL with scopes, redirect user to eBay
- `GET /api/auth/ebay/callback` → exchange `code` for access + refresh tokens, store in session
- `lib/ebay/auth.ts` → `getValidToken()` checks expiry, calls refresh endpoint if needed
- Store tokens in an encrypted session cookie (iron-session) or write back to `.env.local` for single-user use

### Step 4 — Active Listings Dashboard (`app/page.tsx`)
Fetch from `GET /api/listings` which calls eBay **Inventory API** + **Browse Sell API**.

Display per listing:
- Item title and thumbnail
- Current bid / Buy It Now price
- Number of bids
- Watchers count
- Time remaining (days + hours)
- Listing status (Active, Ended, Sold)
- Direct link to the eBay listing

Refresh button to re-fetch from eBay without reloading the page.

### Step 5 — New Listing Form (`app/listings/new/page.tsx`)

The form is split into **required** and **optional** sections. Optional sections can be collapsed/skipped.

**Required fields:**
| Field | Notes |
|---|---|
| Title | Max 80 characters |
| Category | Type-ahead search via eBay category suggestions API |
| Condition | Dropdown: New, Used, Like New, etc. |
| Starting price | Minimum bid or fixed price |
| Listing duration | 1, 3, 5, 7, 10, 30 days, or GTC (Good Till Cancelled) |
| Shipping | At least one shipping option with carrier + cost |
| At least one photo | URL or file upload |

**Optional (skippable) fields:**
| Field | Notes |
|---|---|
| Description | Rich text or plain text |
| Buy It Now price | Shows alongside auction |
| Reserve price | Hidden minimum |
| Quantity | Defaults to 1 |
| Item specifics | Key/value pairs (brand, size, color, etc.) |
| Return policy | Days, restocking fee, who pays return shipping |
| Payment instructions | Free text |
| Location | Defaults to account location |

Form validation runs client-side before submitting to `POST /api/listings/create`.

### Step 6 — eBay Listing Submission (`lib/ebay/listings.ts`)
Use the **Sell Inventory API** flow:
1. `POST /sell/inventory/v1/inventory_item/{sku}` — create inventory item (product details, photos, condition)
2. `POST /sell/inventory/v1/offer` — create offer (price, category, listing duration, fulfillment policy)
3. `POST /sell/inventory/v1/offer/{offerId}/publish` — publish to eBay marketplace

This three-step approach is the modern RESTful alternative to the legacy Trading API `AddItem` call.

### Step 7 — Error Handling & Auth Guard
- Redirect to `/api/auth/ebay` if no valid token exists
- Display eBay API error messages inline in the listing form
- Show a toast notification on successful listing creation with a link to the live listing

---

## Key eBay API Endpoints

| Purpose | Method | Endpoint |
|---|---|---|
| Get active listings | GET | `https://api.ebay.com/sell/inventory/v1/inventory_item` |
| Get offers (listing details) | GET | `https://api.ebay.com/sell/inventory/v1/offer` |
| Create inventory item | PUT | `https://api.ebay.com/sell/inventory/v1/inventory_item/{sku}` |
| Create offer | POST | `https://api.ebay.com/sell/inventory/v1/offer` |
| Publish listing | POST | `https://api.ebay.com/sell/inventory/v1/offer/{offerId}/publish` |
| Category suggestions | GET | `https://api.ebay.com/commerce/taxonomy/v1/category_tree/{id}/get_category_suggestions` |
| OAuth token exchange | POST | `https://api.ebay.com/identity/v1/oauth2/token` |

Sandbox base URL: `https://api.sandbox.ebay.com`
Production base URL: `https://api.ebay.com`

---

## Local Development

```bash
npm run dev         # Start dev server at http://localhost:3000
npm run build       # Production build
npm run lint        # ESLint check
```

First run: visit `http://localhost:3000/api/auth/ebay` to authorize the app with your eBay account.

---

## Notes & Constraints

- eBay's Inventory API requires a **Business Policy** to be set up on your eBay seller account for payment, return, and fulfillment policies. Do this once in eBay Seller Hub before testing listing creation.
- The `EBAY_ENVIRONMENT=sandbox` setting uses a separate sandbox seller account — create one at developer.ebay.com.
- Category tree ID for eBay US is `0`. Use the taxonomy API to look up category IDs.
- Access tokens expire after **2 hours**; refresh tokens last **18 months**. The `getValidToken()` helper handles auto-refresh.
- Photo uploads: eBay requires image URLs (not binary uploads via their REST API). Host images externally or use a service like Cloudinary, then pass the URL to the inventory item.
