# NanoFun Google Sheets backend

Architecture matches PromptKami: private Google Sheet plus Apps Script Web App. The existing PromptKami project, customer rows and endpoint are not modified.

- Sheet: `nanofun-paid`, Players and Ledger; contains no invented customers or orders.
- Script source: Code.gs. Browser client: dist/wallet-client.js, mirrored in docs/.
- API is not deployed or connected to the current homepage yet. No paid purchases or real ads are enabled.

## Setup

1. Open the bound NanoFun Apps Script project as pawfunstudios@gmail.com, review the source and authorize the Google scopes. `setup` validates the Sheet schema and creates a private signing secret in Script Properties. The source calls Sheets, sends requested login-code emails and fetches Stripe order data. Do not put secrets in the source/Sheet.
2. Set Script Property `STRIPE_READ_KEY` to a Stripe restricted key with the read permissions needed for Checkout Sessions, line items and Payment Links. Secret entry is done in private settings, never in chat. Initially leave `COIN_CHECKOUT_ENABLED` unset.
3. Deploy a Web App, execute as owner. Making the endpoint accessible to website users requires the owner's explicit deployment/access authorization. The private Sheet remains private; public GET returns health only.
4. Configure the verified /exec endpoint for wallet-client.js. Verify real-browser CORS/redirect behavior before wiring to the three game Start/Retry controls; they currently use a synchronous local demo bridge and need an asynchronous authorization step.
5. Configure Stripe's after-payment redirect to `https://nanofungames.com/?session_id={CHECKOUT_SESSION_ID}`. The literal placeholder is replaced by Stripe. Existing `nanofun_reward` query parameters are not evidence of payment and must never award anything.
6. Run sign-in, 5-coin grant, start/retry idempotency, zero balance, ownership mismatch, unpaid/wrong-product order and duplicate fulfillment acceptance checks in a separate test Sheet/Stripe test environment. Only after end-to-end verification may `COIN_CHECKOUT_ENABLED=true` expose the 50-coin checkout.

## Interface and identity

Requests use JSON as text/plain POST; do not place the user's login token in URLs. Login is email-based with a short code so somebody cannot spend a wallet merely by guessing its email address. Each login is limited, and each email receives the server welcome grant only once. The script never lists customer emails through a public API. Operational email quotas and Apps Script/Sheets latency make this a small-scale starting backend; load and quota behavior has not been tested.

The signed login token is cached by the browser; the Sheet ledger is authoritative for coins. A request UUID identifies each round; repeated clicks/retries with the same UUID cannot double-charge. Stripe order verification checks the link, mode, currency, price, quantity, successful payment, player reference and matching signed-in email. A checkout session can be fulfilled once only. The Ledger is appended before the Players display cache is updated so retries can repair the cache.

## Deliberately not enabled yet

- VIP is a recurring **$9.99/year** Stripe subscription, not a one-time 365-day purchase. Renewal, cancellation, refund and dispute reconciliation must be implemented and tested before VIP checkout or rights are exposed. Current code rejects VIP fulfillment.
- Paid coin refund/dispute reconciliation and offline-payment recovery still need acceptance testing before live enablement. The return flow alone is not a substitute for reliable payment reconciliation.
- Real ads require approved H5 access and provider wiring. No timer simulates paid advertising. Daily limit 8 and +3 reward remain pending server/provider integration.
- No real customer emails were sent, no payments were made, and no production entitlement was created during local tests.
