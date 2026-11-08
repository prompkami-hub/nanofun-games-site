# NanoFun Arcade

网站仓：https://github.com/prompkami-hub/nanofun-games-site 。配套游戏源码：https://github.com/prompkami-hub/nanofun-games （Private）。2026-11-05 已将 nanofungames.com 切换到本仓 GitHub Pages（main /docs），HTTPS 及游戏运行验收通过，详情参见 [MIGRATION.md](MIGRATION.md)。

GitHub Pages serves `docs/` at https://nanofungames.com/ with enforced HTTPS. The www subdomain and the original nanofungg.github.io address redirect to this canonical domain. Keep docs/CNAME and dist/CNAME when publishing.

## Development
Edit the homepage files in `dist/`, copy them to `docs/`, then run `node preview.mjs` for a localhost preview. Run `node --test tests/*.test.cjs` from this directory.

The Godot source is maintained separately in the private `prompkami-hub/nanofun-games` repository under `pikachu-volleyball/`. Only web exports belong in `docs/games/pikachu-volleyball/`. Use a new pack filename and update the HTML mainPack and cache versions when deploying an export.

## Server wallet
The homepage uses the dedicated private NanoFun Google Sheet and Apps Script Web App. Guests receive five welcome coins, tracked by a random browser ID and a server ledger. Email sign-in uses a ten-minute one-time code and carries only unspent guest coins to a new verified account. Verified accounts can claim ten coins once per Los Angeles calendar day. No email address is accepted as authentication by itself.

All three game cabinets await server authorization before starting or restarting. Each request has a durable operation UUID, so retries recover a pending round without charging twice. Opening a cabinet, pausing and resuming are free. Verified-email wallets support the 50-coin pack ($0.99 one-time), annual VIP ($9.99/year until canceled), restore purchases and transactional email confirmations. Rewarded ads remain disabled pending provider approval and durable reward verification. See [backend setup](apps-script/README.md).

## Phone controls
`mobile.js` provides independent multi-pointer buttons outside the court. Portrait places controls below the court; short landscape places them beside it. Single player shows P1; local two-player shows P1 and P2. Move, jump and smash can be held/tapped together. Rotation or hiding the page pauses play; the large pause/resume button resumes it. The Touch Controls toggle can also expose these controls on desktop.

The web game polls the host touch bridge for movement and one-shot actions. Existing WASD/R and arrow/Enter keyboard controls remain available. The earlier `.openai/hosting.json` is not the GitHub Pages deployment configuration.

## 2048 and Snake
Three playable cabinets share the server wallet. New games keep independent sources in the games repository; only index.html, style.css, engine.js and app.js are deployed under docs/games. Each explicit start costs one coin; pause and continue are free. Leaving the cabinet ends the run. Both games support keyboard and mobile gestures; Snake also has direction buttons. Scores are browser-local.


Guest access survives refresh while browser data is retained. Clearing storage or using another profile can create a new guest; this is not strong anti-abuse protection. Server quotas and verified email are the current limits. Existing browser-local demo balances are not paid funds and are not imported as server credit.

## Languages
Auto-detects ordered browser languages and supports zh-CN, en, ja, es-MX and ko. Manual preference is browser-local and persists. No geolocation or external translation service is used. Translation source: dist/locales.tsv. Run node build-i18n.cjs to regenerate dist/i18n.js and docs/i18n.js. DOM text and accessibility labels are localized, including same-origin game frames; Godot's canvas HUD now polls the same selected language without restarting the match. New dynamic phrases must be added to the catalog.


## Rewarded-ad integration (not enabled)
The optional `rewarded-ads.js` adapter covers the Google H5 callback lifecycle and is not loaded by the homepage. Fake timer rewards have been removed. AdSense and AdMob applications are under review; H5 Games Ads approval and durable server reward integration are still required. Target reward: +3 coins, up to eight daily, only after explicit consent and a completed rewarded ad. No advertising revenue is claimed.


## Public billing release
The homepage includes three clear options (free coins, coin pack, Annual VIP), five-language purchase messages, and separate help/billing and privacy pages. Existing annual subscriptions cannot accidentally start a second subscription; the wallet provides the support cancellation/renewal link. Stripe verifies orders before credit, uses the exact NanoFun links, and never accepts a success query flag as proof. Real-card live-mode self-testing is not used.

`releaseNanoFunPublicBilling` in the editor-only AdminChecks.gs requires live read checks, exact product/redirect checks, the installed reconciliation trigger, two verified isolated sandbox orders and both sent test receipts. It enables coin packs, annual VIP and the production transactional outbox together. It does not enable ads, change secrets, create transactions, add schedules or widen deployment access. Public Web App deployment remains execute-as-owner/Anyone on the existing endpoint; the underlying Sheet stays private.

Customer information: [billing help](https://nanofungames.com/help.html#billing), [renewal/cancellation](https://nanofungames.com/help.html#cancel), [privacy](https://nanofungames.com/privacy.html). Advertising status must be read from the current Google dashboard, not inferred from ads.txt or a publisher ID. AdSense review and H5 Games Ads access are separate gates; the homepage does not load an advertising SDK while pending.
