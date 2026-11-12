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
Three playable cabinets share the server wallet. New games keep independent sources in the games repository; only index.html, style.css, engine.js and app.js are deployed under docs/games. Each explicit start costs one coin; pause and continue are free. Leaving the cabinet ends the run. Both games support keyboard and mobile gestures; Snake uses the same one-swipe-on-release control as 2048, without direction buttons. Scores are browser-local.


Guest access survives refresh while browser data is retained. Clearing storage or using another profile can create a new guest; this is not strong anti-abuse protection. Server quotas and verified email are the current limits. Existing browser-local demo balances are not paid funds and are not imported as server credit.

## Languages
Auto-detects ordered browser languages and supports zh-CN, en, ja, es-MX and ko. Manual preference is browser-local and persists. No geolocation or external translation service is used. Translation source: dist/locales.tsv. Run node build-i18n.cjs to regenerate dist/i18n.js and docs/i18n.js. DOM text and accessibility labels are localized, including same-origin game frames; Godot's canvas HUD now polls the same selected language without restarting the match. New dynamic phrases must be added to the catalog.


## Rewarded-ad integration (not enabled)
The optional `rewarded-ads.js` adapter covers the Google H5 callback lifecycle and is not loaded by the homepage. Fake timer rewards have been removed. AdSense and AdMob applications are under review; H5 Games Ads approval and durable server reward integration are still required. Target reward: +3 coins, up to eight daily, only after explicit consent and a completed rewarded ad. No advertising revenue is claimed.


## Public billing release
The homepage includes three clear options (free coins, coin pack, Annual VIP), five-language purchase messages, and separate help/billing and privacy pages. Existing annual subscriptions cannot accidentally start a second subscription; the wallet provides the support cancellation/renewal link. Stripe verifies orders before credit, uses the exact NanoFun links, and never accepts a success query flag as proof. Real-card live-mode self-testing is not used.

`releaseNanoFunPublicBilling` in the editor-only AdminChecks.gs requires live read checks, exact product/redirect checks, the installed reconciliation trigger, two verified isolated sandbox orders and both sent test receipts. It enables coin packs, annual VIP and the production transactional outbox together. It does not enable ads, change secrets, create transactions, add schedules or widen deployment access. Public Web App deployment remains execute-as-owner/Anyone on the existing endpoint; the underlying Sheet stays private.

Customer information: [billing help](https://nanofungames.com/help.html#billing), [renewal/cancellation](https://nanofungames.com/help.html#cancel), [privacy](https://nanofungames.com/privacy.html). Advertising status must be read from the current Google dashboard, not inferred from ads.txt or a publisher ID. AdSense review and H5 Games Ads access are separate gates; the homepage does not load an advertising SDK while pending.


## EE brand mail verified; billing restored

The ee-owned mail relay is authorized, privately paired and deployed. An actual inbox test verified both From and Reply-To as superpowergames.us@gmail.com (NanoFun Games), signed by gmail.com. Wallet deployment 8 / schema7 ee-mail-relay-7 uses brand_relay; paid_enabled=true and ads_enabled=false. The production coin-pack and annual-VIP controls are enabled. Existing private player/Stripe administration remains separate from public sender identity. No real-money self-purchase was performed. Secret values are absent from source and logs.

## Public content and crawler checks

The arcade links to public, script-free game guides at `/2048.html`, `/snake.html` and `/volleyball.html`. They describe real controls, rules, coin use and troubleshooting without requiring a wallet or login. Canonical URLs and sitemap entries use the HTTPS production domain. Advertising remains disabled until actual approval and reward verification.

Run `python3 scripts/check_public_site.py --base http://127.0.0.1:4173/` for the local preview, or omit `--base` for production. This read-only smoke check requests public pages with both AdSense crawler User-Agent strings; it does not impersonate a verified Google-origin request, access customer wallets, activate ads or predict approval. The live AdSense result remains authoritative.

## Drift Coast

Original 3D arcade racing is the fourth cabinet. Runtime at `docs/games/drift-coast/`, private source in the games repository. Its one/three lap race awaits the existing NanoArcade round gate; pause/resume do not create a new paid start. Five AI opponents, coastal and alpine circuits, drift charge, nitro and mini turbo; keyboard and phone controls. WebGL is required. Procedural original visuals and synthesized sound; vendored Three.js 0.160.1 retains its MIT notice. Public rules at `/drift-coast.html`. No source or assets copied from the supplied reference game.

## Signal Breaker

Original first-person robot-combat fifth cabinet, runtime `docs/games/signal-breaker/`, private source in nanofun-games. Three relays plus extraction, solid cover/ray occlusion, flying drones/ground crawlers, rechargeable24-shot magazine, sprint, Explorer mode, mouse and independent touch controls. New/restarted mission awaits existing NanoArcade round gate; pause/resume free. Original procedural visuals/synth audio; no Saltline game source/assets copied. Vendored Three.js MIT license retained. Public rules `/signal-breaker.html`. Source mirrors list their original game license as unverified.

## Shadow Grove upgrade

The fifth cabinet retains signal-breaker game ID / public URL and now runs an original rainy bamboo village/shrine variant with spinning swept-collision shuriken, finite12+48pouch/supply caches, timed facing seal interactions, capped reinforcement waves, jump, crouch and focused aim. New cache revision shadow2 invalidates the previous carbine runtime. Public controls/guide and cover reflect the new gameplay. Original independently implemented code/assets; no claim of complete Saltline equivalence. Wallet/payments/ads backend unchanged.
