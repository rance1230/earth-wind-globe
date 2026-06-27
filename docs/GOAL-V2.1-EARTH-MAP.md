# V2.1 地球地图 — /goal 循环提示词（可直接复制）

完整执行步骤见 `docs/PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2.md`。

## 推荐执行版（中文，可直接复制）

```text
/goal 将 `/Volumes/vol1/3D 风场地球可视化/` 的地球纹理从程序化 canvas 替换为 NASA Blue Marble 无云真彩 equirectangular 本地静态纹理，使首屏能清楚识别非洲、阿拉伯半岛、印度洋、马达加斯加、南美；保留 ERA5 风线、玻璃大气壳、bloom、controls 和 windSource 等于 era5 不变；纹理加载失败时诚实降级为 proceduralFallback，绝不谎称高精度图。严格按 docs/PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2.md 的任务 0 到 8 顺序执行。
Verification: 先运行 git status --short --branch -uall、npm run build、npm run test:visual 记录基线；实现后运行 node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json、node scripts/era5/validate_frame.mjs public/data/era5/manifest.json、npm run build、npm run test:visual，并保存 desktop、mobile 截图；Playwright 必须断言 earthMapReady 为 true、earthMapSource 为 nasaBlueMarble、windSource 为 era5，并在替换纹理后重标定 colorBuckets 阈值。
Constraints: 不使用 Windy 或任何运行时网络请求；不引入新 npm 依赖，资产校验脚本只用 Node 内置 fs 和 crypto；不触碰 ERA5 风场逻辑 src/data/era5/、src/data/windSource.js、src/scene/layers/createWindLayer.js；不把 proceduralFallback 描述成高精度图；NASA 官方下载不可达时暂停报告，禁止用第三方镜像替代；不读取或记录任何认证材料。
Boundaries: 只写入 src/scene/layers/createEarth.js、src/scene/EarthScene.js、src/main.js、src/styles.css、index.html、public/assets/earth/、scripts/earth/、tests/visual.spec.js、tests/helpers/colorBuckets.js、README.md、TRANSFER_STATUS.md、docs/；禁止触碰 .git/、node_modules/、dist/、ERA5 风场文件、认证材料、浏览器 profile、LaunchAgent、全局 skill 和无关文件。
Iteration policy: 按文档任务顺序，每个任务开头写五行任务卡，目标、完成条件、验证器、安全边界、产物位置，每次有意义改动后重跑该任务的最小验证命令；视觉微调最多 2 轮；同一错误连续 2 次失败必须停止试错，读日志或换证据来源；最多 3 轮聚焦改进后报告剩余风险。
Stop when: NASA 纹理本地资产存在且 validate_earth_assets.mjs 通过；earthMapSource 返回 nasaBlueMarble 且 earthMapReady 为 true；windSource 仍为 era5 且 era5 validator 通过；npm run build 和 npm run test:visual 全绿，含重标定后的 colorBuckets；desktop、mobile 截图存在且首屏可识别非洲和印度洋、移动端无控件重叠；README、TRANSFER_STATUS、docs 声明与代码真实状态一致。
Pause if: NASA 官方下载不可达或需要账号或付费、单文件或总资产超过 12 MB、需要安装新依赖、纹理许可证不清、2 轮视觉微调后仍不达标、需要 commit 或 push 或发布或外发、需要破坏性清理，或发现任务必须重构超过 2 个核心文件或触碰风场逻辑。
```

## Goal Draft (English-compatible)

```text
/goal Replace the earth texture in the project from a procedural canvas to a local static NASA Blue Marble cloud-free true-color equirectangular texture so the first screen clearly shows Africa, the Arabian Peninsula, the Indian Ocean, Madagascar, and South America; keep ERA5 wind streamlines, the glass atmosphere, bloom, controls, and windSource equals era5 unchanged; on texture load failure degrade honestly to proceduralFallback and never claim it is a high-precision map. Follow docs/PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2.md tasks 0 through 8 strictly in order.
Verification: first run git status --short --branch -uall, npm run build, npm run test:visual as baseline; after implementation run node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json, node scripts/era5/validate_frame.mjs public/data/era5/manifest.json, npm run build, npm run test:visual, and save desktop and mobile screenshots; Playwright must assert earthMapReady is true, earthMapSource is nasaBlueMarble, and windSource is era5, and recalibrate the colorBuckets thresholds after swapping the texture.
Constraints: no Windy or any runtime network request; no new npm dependency, the asset validator uses only Node built-in fs and crypto; do not touch ERA5 wind logic src/data/era5/, src/data/windSource.js, src/scene/layers/createWindLayer.js; never describe proceduralFallback as a high-precision map; pause and report if the official NASA download is unreachable and do not substitute third-party mirrors; do not read or persist any credentials.
Boundaries: write only src/scene/layers/createEarth.js, src/scene/EarthScene.js, src/main.js, src/styles.css, index.html, public/assets/earth/, scripts/earth/, tests/visual.spec.js, tests/helpers/colorBuckets.js, README.md, TRANSFER_STATUS.md, docs/; do not touch .git/, node_modules/, dist/, ERA5 wind files, credentials, browser profiles, LaunchAgents, global skills, or unrelated files.
Iteration policy: follow the document task order, write a five-line task card at the start of each task covering goal, done, verifier, boundary, artifact, rerun the task smallest verify command after each meaningful change, cap visual tuning at 2 rounds, stop retrying after the same error fails twice and gather new evidence, and make at most 3 focused improvement rounds before reporting remaining risks.
Stop when: the local NASA texture asset exists and validate_earth_assets.mjs passes; earthMapSource returns nasaBlueMarble with earthMapReady true; windSource stays era5 and the era5 validator passes; npm run build and npm run test:visual are green including recalibrated colorBuckets; desktop and mobile screenshots exist with recognizable Africa and Indian Ocean and no mobile control overlap; README, TRANSFER_STATUS, and docs match the actual code state.
Pause if: the official NASA download is unreachable or needs an account or payment, a single file or total assets exceed 12 MB, a new dependency is required, texture licensing is unclear, two rounds of visual tuning still fail, commit or push or release or external send is requested, destructive cleanup is needed, or the task would require refactoring more than 2 core files or touching wind logic.
```
