# NanoFun Games 网站迁移

- 原仓：https://github.com/nanofungg/nanofungg.github.io
- 新仓：https://github.com/prompkami-hub/nanofun-games-site （Public）
- 配套源码仓：https://github.com/prompkami-hub/nanofun-games （Private）
- 输入 ZIP：nanofungg.github.io-main.zip
- ZIP SHA-256：c7bd4901ae81ed9b8d036678bd9159b6872ced645794fb913ba10ba036880335
- 基线提交：99dcdd58abcae3639936f2f9a082f78efbf5e21b

已克隆原仓完整 Git 历史。原仓 main 与 ZIP 基线提交一致，66 个原始文件在迁移改动前全部进行 SHA-256 对比并一致。本次仅补充迁移规范、忽略规则及仓库链接，不修改网站功能与游戏运行文件。

继续使用 docs/ 作为 GitHub Pages 静态目录。docs/CNAME 和 dist/CNAME 仍为 nanofungames.com。dist/ 不包含完整游戏，不能直接以其替代 docs/ 部署。继承的 .openai/hosting.json 为历史信息，本次未变更任何 Sites 部署。

本次只迁移 Git。新仓 Pages、域名切换和公网验收尚未完成，旧仓不能删除或关闭 Pages。切换顺序：验证新部署 → 协调旧自定义域名释放与新绑定 → 检查 HTTPS、主页和游戏资源 → 验证后归档旧仓。不要仅以推送成功判断域名已迁移。
