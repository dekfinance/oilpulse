# Oil Pulse Mobile

A mobile-first oil-market dashboard delivered by one Cloudflare Worker. It refreshes server-side every hour, stores the latest payload in Workers KV, displays Brent/WTI through OilPriceAPI, and shows up to 10 recent headlines across 10 source filters.

## Deploy

1. Install Node.js 20+ and run `npm install`.
2. Sign in with `npx wrangler login`.
3. Create storage: `npx wrangler kv namespace create OIL_PULSE`.
4. Copy the returned namespace ID into `wrangler.jsonc`.
5. Create an OilPriceAPI key and save it as a secret: `npx wrangler secret put OILPRICE_API_KEY`.
6. Deploy: `npm run deploy`.
7. Open the generated Worker URL on a phone and choose **Add to Home Screen**.

The hourly schedule is `0 * * * *` and runs in UTC. The Refresh button performs an immediate server-side refresh. Without an API key, news still loads and price cards show a configuration prompt.

## Sources and controls

The app queries Google News RSS searches for Reuters, Bloomberg, OilPrice.com, Rigzone, CNBC, Financial Times, EIA, IEA, OPEC, and S&P Global. Google News availability and publisher coverage can vary. Headlines always link to the original destination. Review publisher terms and your organization's data-licensing requirements before production use.

Price source: OilPriceAPI `/v1/prices/latest`. Its free quota may not support 24 hourly calls/day plus manual refreshes indefinitely, so confirm the plan before production deployment.

## Production hardening

- Protect `/api/data?refresh=1` with Cloudflare Access or a shared secret to prevent quota abuse.
- Add monitoring for failed scheduled runs and API quota exhaustion.
- Replace keyword sentiment with an approved model if used in decision support.
- Keep API keys only in Worker secrets, never in browser code.
- Validate market-data and news redistribution rights with Legal/Procurement.
