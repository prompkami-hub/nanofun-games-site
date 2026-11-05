# NanoFun Games 独立网站

本仓为公开网站仓，运营板块为 matrix-ops-hub/05_superpower_games。GitHub Pages 的静态根目录是 docs/，dist/ 为首页编辑源；网页游戏运行文件在 docs/games/。保留 docs/CNAME、dist/CNAME、.nojekyll 以及全部 WASM/PCK/音频文件。

游戏工程源码属于私有 prompkami-hub/nanofun-games，不放入公开网站仓。修改网页首页后按 README 同步 dist/ 与 docs/，运行原有 Node 测试。不要向本仓加入账户、.env、Cookie、运营排期或内部账号矩阵。

.openai/hosting.json 是继承的历史部署元数据。本次目标为 GitHub 仓库迁移，不应把它当成新授权去更新旧 Sites 项目。新仓 Pages 尚未启用；旧仓和域名切换属于独立部署步骤，只有完成新站验证后才可停用旧部署。

改动前检查 git status；提交采用 Conventional Commits，禁止未经授权强制推送或删除旧仓。
