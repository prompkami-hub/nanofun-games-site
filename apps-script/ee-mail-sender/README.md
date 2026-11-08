# NanoFun brand-only mail sender

This is a separate Apps Script project owned and executed by **superpowergames.us@gmail.com**, using the dedicated ee browser profile. It has only send-mail and own-email-identity permissions. It has no wallet Sheet, payment API key, Gmail read permission or cross-brand source. The wallet administration identity remains private.

The mail-only endpoint verifies an HMAC-SHA256 signature over a fresh timestamp, nonce and the exact payload before accepting a request. It enforces the ee effective Google identity on every send, fixes the display name/Reply-To, validates recipient/size, and persists delivery claims keyed by operation hash. It never stores/logs recipients, OTPs, bodies or the shared secret. Known quota exhaustion is not-sent; interrupted/uncertain sending is held for reconciliation, never blindly retried. Sent operation hashes expire after seven days; ambiguous claims do not expire automatically. The wallet's durable receipt ledger remains authoritative across longer periods.

## Owner handoff

1. Review and authorize `verifyEeSenderAccess` in the ee-owned project. This checks the account/quota; it sends nothing and creates no secret. If Google presents an unverified-app warning, the owner must personally review and decide whether to continue.
2. The owner personally runs `initializeEeMailSender` to create MAIL_RELAY_SECRET privately. It is never logged. Copy it from this project's Script Properties to the same property in the wallet backend, and save both privately; do not paste it into chat or Git.
3. After explicit deployment authorization, publish the mail-only Web App as the ee account, Anyone access, with HMAC authentication enforced in Code.gs. Set its exec URL as MAIL_RELAY_URL in the wallet backend. No other file sharing or payment permissions are needed.
4. Deploy the prepared wallet relay transport before confirming identity. `probeEeMailSender` sends only to the ee address. Read back the real From/Reply-To in that mailbox, then run `confirmEeSenderAfterAcceptance`. This checks the live relay backend version before reopening login/checkout and customer receipt delivery.

The standalone appsscript.json documents the two minimal scopes. No Google identity-token service, additional recurring task, SMTP password or Gmail-wide read access is needed. The shared secret permits only this narrow mail relay; it is independent of wallet signing/payment secrets.
