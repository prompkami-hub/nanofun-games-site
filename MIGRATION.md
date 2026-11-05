# NanoFun Games 网站迁移

- 原仓：https://github.com/nanofungg/nanofungg.github.io
- 新仓：https://github.com/prompkami-hub/nanofun-games-site （Public）
- 配套源码仓：https://github.com/prompkami-hub/nanofun-games （Private）
- 输入 ZIP：nanofungg.github.io-main.zip
- ZIP SHA-256：c7bd4901ae81ed9b8d036678bd9159b6872ced645794fb913ba10ba036880335
- 基线提交：99dcdd58abcae3639936f2f9a082f78efbf5e21b

已克隆原仓完整 Git 历史。原仓 main 与 ZIP 基线提交一致，66 个原始文件在迁移改动前全部进行 SHA-256 对比并一致。本次仅补充迁移规范、忽略规则及仓库链接，不修改网站功能与游戏运行文件。

继续使用 docs/ 作为 GitHub Pages 静态目录。docs/CNAME 和 dist/CNAME 仍为 nanofungames.com。dist/ 不包含完整游戏，不能直接以其替代 docs/ 部署。继承的 .openai/hosting.json 为历史信息，本次未变更任何 Sites 部署。

## 线上切换完成：2026-11-05

先使用 pages-preview 分支部署无自定义域名的预览站，验证后由用户在旧仓移除自定义域名，再将 nanofungames.com 绑定到本仓。正式发布来源为 main /docs，HTTPS 证书 approved、https_enforced=true。旧仓 Pages 的 cname 已为 null。

验收结果：默认首页 HTTP 200，内容 SHA-256 与新仓一致；deployment.json 标识本仓；www.nanofungames.com 返回 301 至 HTTPS 主域名；32 个线上文件（合计 48,606,810 字节）SHA-256 与本仓一致，包含活动 WASM、PCK、网页脚本和音频。浏览器实际验证 2048 开局与移动、Snake 开局与方向和暂停、排球单人与双人开局及模拟币扣减，未观察到控制台错误。网页现有 9 项 Node 测试通过。

主页新增部署标识文件，页脚 GitHub 链接更新为本仓；除这些迁移改动外保留原网站和游戏内容。

旧仓不再承载正式域名，可以停用旧仓 Pages，并建议先归档源码保留历史。未执行旧仓下架或删除。检查时 www 的 DNS CNAME 仍为 nanofungg.github.io；当前跳转正常，建议用户在 DNS 提供商处改为 prompkami-hub.github.io（仅主机名，不含协议或仓库路径），清除旧账号引用。
