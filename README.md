# NanoFun Arcade

网站仓：https://github.com/prompkami-hub/nanofun-games-site 。配套游戏源码：https://github.com/prompkami-hub/nanofun-games （Private）。2026-11-05 已将 nanofungames.com 切换到本仓 GitHub Pages（main /docs），HTTPS 及游戏运行验收通过，详情参见 [MIGRATION.md](MIGRATION.md)。

GitHub Pages serves `docs/` at https://nanofungames.com/ with enforced HTTPS. The www subdomain and the original nanofungg.github.io address redirect to this canonical domain. Keep docs/CNAME and dist/CNAME when publishing.

## Development
Edit the homepage files in `dist/`, copy them to `docs/`, then run `node preview.mjs` for a localhost preview. Run `node --test tests/*.test.cjs` from this directory.

The Godot source is maintained separately in the private `prompkami-hub/nanofun-games` repository under `pikachu-volleyball/`. Only web exports belong in `docs/games/pikachu-volleyball/`. Use a new pack filename and update the HTML mainPack and cache versions when deploying an export.

## Demo wallet
Email identifies a browser-local demo wallet; no email is verified or sent. Daily grants are 10 simulated coins, each full match/restart costs 1, and a simulated reward adds 10 only at zero balance. No real ads, payments, backend ledger or anti-cheat protection are connected.

## Phone controls
`mobile.js` provides independent multi-pointer buttons outside the court. Portrait places controls below the court; short landscape places them beside it. Single player shows P1; local two-player shows P1 and P2. Move, jump and smash can be held/tapped together. Rotation or hiding the page pauses play; the large pause/resume button resumes it. The Touch Controls toggle can also expose these controls on desktop.

The web game polls the host touch bridge for movement and one-shot actions. Existing WASD/R and arrow/Enter keyboard controls remain available. The earlier `.openai/hosting.json` is not the GitHub Pages deployment configuration.

## 2048 and Snake
Three playable cabinets share the simulated wallet. New games keep independent sources in the games repository; only index.html, style.css, engine.js and app.js are deployed under docs/games. Each explicit start costs one coin; pause and continue are free. Leaving the cabinet ends the run. Both games support keyboard and mobile gestures; Snake also has direction buttons. Scores are browser-local.


Guest session: sessionStorage grants five coins per tab session. Refresh preserves the count. Guest coins are spent before the existing email balance. Cabinet entry is free even at zero; the next actual start opens the wallet when both balances are empty. Existing daily and simulated-ad rewards remain available after email entry.


## Languages
Auto-detects ordered browser languages and supports zh-CN, en, ja, es-MX and ko. Manual preference is browser-local and persists. No geolocation or external translation service is used. Translation source: dist/locales.tsv. Run node build-i18n.cjs to regenerate dist/i18n.js and docs/i18n.js. DOM text and accessibility labels are localized, including same-origin game frames; Godot's canvas HUD now polls the same selected language without restarting the match. New dynamic phrases must be added to the catalog.

