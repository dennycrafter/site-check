# Base Home Check

Photo qualification for residential electrical panels. Upload a photo of a breaker
panel and get a qualification result in seconds, with human review only when the
model is not confident enough to call it.

Base Hackathon project.

## Stack

- Next.js 16 with React 19 (server components)
- `vinext` + Vite, deployed to Cloudflare Workers via Wrangler
- Tailwind CSS 4

## Routes

| Route            | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `/`              | Main photo qualification flow            |
| `/customer-deck` | Customer-facing pitch deck               |

## Running locally

Requires Node >= 22.13.0.

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Status

The photo qualification UI and customer deck are in place. The Google Maps
breaker-location pinning is not implemented yet.

## SiteCheck backend (`sitecheck/`)

`sitecheck/` is a separate Next.js app with the working photo check: guided
capture of the meter and breaker box, a Claude check on each photo, the
PASS/FAIL/REVIEW rules engine with the battery count, and the surveyor queue at
`/review`. It stores homes and photos in Supabase. Live demo:
https://sitecheck-sigma.vercel.app

Setup, environment variables, the API and the rules table are in
[`sitecheck/README.md`](sitecheck/README.md). To create a home from another
part of the system, `POST /api/homes` takes `address`, with optional
`inAustin`, `hasSolar`, `customerName` and `customerEmail`.
