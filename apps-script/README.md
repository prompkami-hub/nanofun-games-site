# NanoFun Google Sheets backend

Architecture matches PromptKami: private Google Sheet plus Apps Script Web App. The existing PromptKami project, customer rows and endpoint are not modified.

- Sheet: `nanofun-paid`, Players and Ledger; contains no invented customers or orders.
- Script source: Code.gs. Browser client: dist/wallet-client.js, mirrored in docs/.
- Web App version 2 (`guest-rounds-2`) deployed on 2026-11-07, same endpoint and access as the user-authorized version 1. Homepage and all three cabinets use asynchronous server authorization. Version 3 is deployed for owner-only coin payment acceptance; public purchases, annual VIP and real ads remain closed.

## Setup

1. Open the bound NanoFun Apps Script project as the private administration account, review the source and authorize the Google scopes. `setup` validates the Sheet schema and creates a private signing secret in Script Properties. The source calls Sheets, sends requested login-code emails and fetches Stripe order data. Do not put secrets in the source/Sheet.
2. Set Script Property `STRIPE_READ_KEY` to a Stripe restricted key with the read permissions needed for Checkout Sessions, line items and Payment Links. Secret entry is done in private settings, never in chat. The owner has saved this key; do not reveal it. Billing flags remain acceptance-only.
3. Deploy a Web App, execute as owner. Making the endpoint accessible to website users requires the owner's explicit deployment/access authorization. The private Sheet remains private; public GET returns health only.
4. The /exec endpoint is configured in dist/arcade.js. Cross-origin browser POST and all three asynchronous Start controls have been tested. Local pending round IDs allow a lost response to be retried without charging twice.
5. Configure Stripe's after-payment redirect to `https://nanofungames.com/?session_id={CHECKOUT_SESSION_ID}`. The literal placeholder is replaced by Stripe. Existing `nanofun_reward` query parameters are not evidence of payment and must never award anything.
6. Run sign-in, 5-coin grant, start/retry idempotency, zero balance, ownership mismatch, unpaid/wrong-product order and duplicate fulfillment acceptance checks in a separate test Sheet/Stripe test environment. Only after end-to-end verification may the owner-only restriction be removed. `BILLING_ENABLED=true` with `BILLING_TEST_EMAIL` still restricts button visibility to the test owner.

## Interface and identity

Requests use JSON as text/plain POST; do not place the user's login token in URLs. Login is email-based with a short code so somebody cannot spend a wallet merely by guessing its email address. Each login is limited, and each email receives the server welcome grant only once. The script never lists customer emails through a public API. Operational email quotas and Apps Script/Sheets latency make this a small-scale starting backend; load and quota behavior has not been tested.

The signed login token is cached by the browser; the Sheet ledger is authoritative for coins. A request UUID identifies each round; repeated clicks/retries with the same UUID cannot double-charge. Stripe order verification checks the link, mode, currency, price, quantity, successful payment, player reference and matching signed-in email. A checkout session can be fulfilled once only. The Ledger is appended before the Players display cache is updated so retries can repair the cache.

## Deliberately not enabled yet

- VIP is a recurring **$9.99/year** Stripe subscription, not a one-time 365-day purchase. Renewal, cancellation, refund and dispute reconciliation is implemented and fixture-tested below. Annual checkout remains disabled pending acceptance; no real subscription fulfillment has been claimed.
- Paid coin refund/dispute reconciliation and missed-return recovery are implemented below and still need actual payment acceptance before public enablement. The return flow alone is not a substitute for reliable payment reconciliation.
- Real ads require approved H5 access and provider wiring. No timer simulates paid advertising. Daily limit 8 and +3 reward remain pending server/provider integration.
- Acceptance uses the owner email only: one requested sign-in code and a free daily claim. Test guest/owner rows are operational QA records, not customers or orders. No payments or paid entitlements were created.
- Welcome grants: five per guest identity, transferred once to a newly verified email without refilling spent coins. Verified email daily claim: ten once per Los Angeles date. Guest creation is capped at 500/day; OTP email sending at 50/day. These quotas are not strong bot protection.
- The browser timeout is 30 seconds. If the response is lost after charging, the pending operation ID is preserved; retrying that game recovers the same round.

## Billing acceptance implementation (v3, 2026-11-07)

A private read-only Stripe key was saved by the owner. Ten resource probes succeeded without printing secrets or customer records. Only the two exact NanoFun payment-link IDs are handled. The existing PromptKami products are not modified. Both NanoFun completion redirects now use the real Checkout Session ID.

- `nfFulfillSession` fetches paid live-mode objects from Stripe, checks product/link, amount, currency, quantity, player reference and verified email, then reconciles the ledger idempotently. Test objects, forged URL flags and unrelated links are rejected.
- Coin refunds adjust the pack to the remaining paid proportion, rounding down to whole coins. An unresolved/lost dispute gives zero entitlement; a won dispute restores the remaining paid entitlement. If coins were already spent, spendable balance is zero and future coin credits offset the adjustment; this never creates a cash debt.
- VIP follows the paid annual Stripe subscription period. Scheduled end-of-period cancellation preserves the paid period; canceled, overdue/unpaid, refunded or disputed periods revoke access. Renewal is read from the latest paid invoice. Duplicate annual subscriptions are flagged for review; users cannot open a second subscription from the wallet. Re-subscribing after a canceled prior subscription requires support review in this initial version.
- A Google-native Head trigger runs `reconcileNanoFunBilling` every five minutes. It scans only NanoFun links, 25 sessions per link per invocation, and persists pagination cursors. It does not label partial coverage complete. Large histories may take multiple cycles; quotas/scale remain a limitation. No Stripe write key or webhook signature shortcut is used.
- Wallet reads/starts recheck the current VIP and latest pack, cached for 60 seconds. The background cursor covers older purchases/refunds. Explicit Restore purchases scans up to 1,000 sessions per NanoFun link and errors on incomplete coverage. No account is auto-created for an unknown payer. A purchase made without a matching signed-in player reference needs support review.

`installNanoFunBilling` validates private read access, both exact products and both return URLs before allowing **owner-only coin acceptance**. `BILLING_TEST_EMAIL=<private-acceptance-email>` limits checkout visibility to the owner's verified wallet. `BILLING_ENABLED=true` enables backend verification/reconciliation; it does not mean public checkout is released while a test email is set. Annual checkout stays closed unless `VIP_CHECKOUT_ENABLED=true`, and no real subscription test is claimed. Public release requires actual payment acceptance evidence. No payment or refund is executed by diagnostic functions.

### Latest acceptance status
Live read key and ten GET checks passed. Both actual redirects were validated. The five-minute Head trigger was saved; its first manual scan returned processed=0, pending=0, errors=0, completed_links=2. No payment has been made.

The initial owner-only live preview has been withdrawn: `BILLING_TEST_EMAIL=__awaiting_sandbox_acceptance__`, so no wallet gets an active purchase button. Keep it closed until isolated **Stripe Test mode** acceptance passes. Do not use real cards for live-mode testing (https://docs.stripe.com/testing). The owner saved a replacement `STRIPE_TEST_READ_KEY` privately; all nine sandbox resource checks passed. Do not overwrite the live key or use test orders to grant production credit. Earlier references to an owner purchase test mean sandbox-only acceptance; no real-money test should be requested.

## Transactional purchase confirmations (v4)

Reference: PromptKami handover `04-网站与收款.md` describes Stripe → private paid Sheet → email delivery, and its `resources/ad-email-template.md` supplies the 600px brand-mail layout. No dedicated purchase-receipt source or matching sent receipt was available in the handover/connected mailbox, so NanoFun's receipt is a separate implementation; existing PromptKami mail and customers are unchanged.

- Editable HTML: `apps-script/templates/purchase_receipt.html`. Run `node apps-script/build_receipt_template.cjs` after changing it; the generated block keeps single-file Apps Script deployments self-contained. English HTML plus plain-text versions identify the 50 Coins Pack ($0.99 one-time) or Annual VIP ($9.99/year, recurring until canceled), quantity, verified amount/date, order reference, credited coins or paid coverage, restore instructions, Stripe payment-document link when supplied, and support contact. No password, API key, signed login token, marketing subscription or tax-invoice claim is included.
- Sender policy: superpowergames.us@gmail.com must be the verified actual sender, with display name NanoFun Games and the same Reply-To. The former administration-account sender is retired; a display-name/Reply-To change alone does not satisfy this requirement. The merchant descriptor is PromptKami, matching the real shared Stripe merchant. No sender impersonation or new Gmail alias is configured.
- `setupNanoFunReceipts` initializes an empty, private Receipts outbox in the existing NanoFun Sheet. It records an enablement cutoff and skips historical payments. It does not send mail or enable delivery.
- A receipt is queued only after a server-verified order updates the wallet successfully. Coin receipts deduplicate by Checkout Session ID. Initial/renewal VIP confirmations deduplicate by paid invoice ID; a newly paid renewal receives its own receipt. Failure to queue must not undo the fulfilled purchase.
- `processNanoFunReceiptOutbox` is called by the existing five-minute billing job. It does not run a second schedule and sends only if `RECEIPT_EMAIL_ENABLED=true`. That flag remains off throughout payment sandbox acceptance. Quota exhaustion leaves queued messages for a later run.
- Claim is persisted before send. Since MailApp does not return an idempotency key/message ID, a send exception or interruption is held as delivery_unknown for Sent-mail reconciliation by unique order reference. It is never blindly retried, and provider acceptance is not proof of inbox delivery. This avoids duplicate automated sends but requires operator recovery of ambiguous failures.
- Sandbox tests use mocks/isolated test data; no preview email is sent to a real payer, and no existing PromptKami contacts are imported. Production sends remain off until end-to-end acceptance and public billing release.


## Isolated Stripe sandbox acceptance (2026-11-07, Los Angeles)

`AdminChecks.gs` is an editor-only companion file, not a public API route. The test key is used for GET requests only. It rejects live credentials/objects and never logs credentials or customer details. Two separately named sandbox products/payment links match the production prices: 50 coins $0.99 once and VIP $9.99/year. Stripe's documented fake card was used; no real funds moved.

`runNanoFunSandboxAcceptance` verifies actual paid sandbox Checkout Sessions, exact link/price/quantity, a fixed acceptance player and the owner's email. It reuses the production `nfCoinTarget`, `nfVipUntil` and `nfRenderReceipt` functions but writes exclusively to private `SandboxAcceptance`; it cannot write Players, Ledger or Receipts. First execution verified two orders, added two records, test balance 50, annual VIP valid. Re-execution added zero, balance stayed 50. This validates isolated Stripe/payment rules and persistence, not a browser-to-production-wallet checkout.

`sendNanoFunSandboxReceipts` sends only to the private administration account, with a conspicuous sandbox/no-real-payment subject and banner; it claims before send and holds unknown outcomes. Both product messages were read back in the recipient INBOX via the official Gmail connector. Production sending stays off. Saving an old Script Properties form had removed receipt flags; `setupNanoFunReceipts` was run again successfully to restore the outbox configuration.

Public checkout and production receipt sending remain closed. Do not mistake a passing read-key check, an isolated test balance, or test email delivery for a public production release. No new schedule or production entitlement was created.


## Public release switch (v5)
The user explicitly authorized public release on November 7, 2026. `releaseNanoFunPublicBilling` validates the live link/pricing/redirect/read-access configuration, the real reconciliation trigger, two actual isolated sandbox orders and both sent test confirmations. It initializes/checks the private receipt schema, sets BILLING_ENABLED, VIP_CHECKOUT_ENABLED and RECEIPT_EMAIL_ENABLED true, then removes the acceptance-only restriction. It does not expose customer data or keys, change deployment access, transact, or enable advertising. The existing v4 handlers remain compatible; v5 additionally returns has_subscription for renewal help. The server always rejects test-mode orders in production fulfillment. Earlier disabled-state descriptions above are historical acceptance records, not the current release setting; use current health/config and the operations ledger for live state.

Release execution succeeded at 21:06 Los Angeles on November 7, 2026: public_checkout_enabled, annual_vip_enabled and receipt_delivery_enabled true; ads_enabled false. The initial trigger-inspection API requested an extra Google scope and was canceled. The check now uses the existing private trigger confirmation after reading the real Triggers table (Head, reconcileNanoFunBilling, 0% error rate). No extra scope was authorized. Deployment version 6 serves API schema 5/public-billing-5 on the same endpoint and access settings.


## Mandatory ee outbound identity (supersedes earlier sender records)
All customer-facing contact, login and purchase messages must use superpowergames.us@gmail.com. Internal administration identities are not published in this repository or page content. The mail gate defaults closed until OUTBOUND_IDENTITY_CONFIRMED equals the brand address, and it must only be confirmed after reading back an actual message From header from the correctly authorized ee sender. Missing identity holds login mail and receipt delivery and hides new checkout; existing balances and guest play remain available. No internal-sender fallback, blind resend, or cosmetic From spoofing is allowed. SANDBOX_RECIPIENT_EMAIL is private Script Properties configuration; historical internal test recipients are not embedded in source. Migration still requires the brand mailbox's own authorization.


## Narrow ee mail relay (prepared, awaiting owner authorization)
The wallet backend no longer needs to send customer mail itself. Its prepared transport signs HTTPS requests to the ee-owned, mail-only app in ee-mail-sender/. The relay requires its effective execution account to equal the brand address; it has no player-table/payment access. Two private Script Properties pair the services: MAIL_RELAY_URL and MAIL_RELAY_SECRET. The owner must create/copy/save the new secret privately. OUTBOUND_IDENTITY_CONFIRMED remains absent until actual sender acceptance. The active interim API is schema6/ee-sender-gate-6; the prepared relay API is schema7/ee-mail-relay-7, and the confirm helper refuses to reopen checkout against the old direct-mail deployment.
