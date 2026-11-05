# NanoFun Games 独立网站

本仓为公开网站仓，运营板块为 matrix-ops-hub/05_superpower_games。GitHub Pages 的静态根目录是 docs/，dist/ 为首页编辑源；网页游戏运行文件在 docs/games/。保留 docs/CNAME、dist/CNAME、.nojekyll 以及全部 WASM/PCK/音频文件。

游戏工程源码属于私有 prompkami-hub/nanofun-games，不放入公开网站仓。修改网页首页后按 README 同步 dist/ 与 docs/，运行原有 Node 测试。不要向本仓加入账户、.env、Cookie、运营排期或内部账号矩阵。

.openai/hosting.json 是继承的历史部署元数据，不应把它当成新授权去更新旧 Sites 项目。nanofungames.com 已于 2026-11-05 切换到本仓 GitHub Pages（main /docs），HTTPS 已启用。后续发布需核对首页、三个游戏及 deployment.json，并保留域名配置。未经用户明确要求不删除旧仓。

改动前检查 git status；提交采用 Conventional Commits，禁止未经授权强制推送或删除旧仓。
