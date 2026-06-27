# V3 循环执行 Goal 指令（喂给 GLM 5.2 的 /goal）

> 用法：把下面 `推荐执行版` 整段复制给执行 agent。它按 `PLAN-V3-WAZA-GLM5.2.md` 的任务 A1 → C1 → C2 → C3 → C4 → B1 → B2 → D1 顺序自驱动、每步验证、知道何时停止、何时暂停。

## 推荐执行版（中文，可直接复制）

```text
/goal 按同目录 PLAN-V3-WAZA-GLM5.2.md，在已有 Three.js 地球可视化上完成三项改进：去掉地形自发光高亮并改真实太阳日照加暗面柔光提亮、把单帧风场升级为多帧 ERA5 时间序列随时间演变、把地图做清晰并支持更深 zoom 加 3D 地形起伏加国界省界加国家城市省名标签其中中国显示中英文其他显示英文且不拥挤，按任务 A1 C1 C2 C3 C4 B1 B2 D1 顺序推进直到全部验收通过。
验证：每个任务做完先运行该任务的 Verify 命令并贴出真实命令输出；全局依次运行 npm install、npm run build、npx playwright install chromium、npm run test:visual，确认 tests/__screens__/ 下 desktop 与 mobile 与 desktop-zoom 与 desktop-t0 与 desktop-t1 截图真实存在且非空；只有命令真实通过才算该步完成，禁止无证据宣称完成。
约束：不重建已工作的渲染管线与验收与 window.__viz 钩子只做扩展，不接需要账号或 API key 的服务，ERA5 只用 keyless ARCO 匿名取数，地图与边界与高程只用 public-domain 数据 NASA 与 Natural Earth 与 GEBCO 或 ETOPO，运行时不依赖网络所有外部数据构建期预烘焙进 public 目录，不做 git push，不引入有版权素材，不读取或记录任何密钥 cookie token。
边界：只写入 /Volumes/vol1/3D 风场地球可视化/ 内与本计划相关的文件；新数据写入 public/ 与 scripts/；截图产物只写入 tests/__screens__/；不修改 /Volumes/vol1/codex/container-3d-tutor/。
迭代策略：一次只做一个任务，严格按 A1 C1 C2 C3 C4 B1 B2 D1 顺序；每个任务改动后重跑该任务 Verify，失败时先读 Playwright 输出与浏览器控制台日志再定位，单个任务最多 3 轮聚焦修复；保持风场与边界单 draw call、质量切换走 dispose 再 rebuild、标签走 declutter 防拥挤、所有新数据写 manifest 带 source 与 licenseNote 与 sha256 且取数失败时如实标注 fallback 绝不谎称真数据；该任务绿了才进入下一任务。
完成条件：任务 A1 到 D1 的 DoD 全部满足，npm run build 通过且 npm run test:visual 两个视口 1280x1280 与 390x844 全绿，五类截图已保存，请求一去高亮加真实日照断言通过，请求二多帧风场随时间演变断言通过，请求三深 zoom 加 3D 地形加国界省界加中国中英文其他英文且不拥挤的标签断言通过，所有新数据 manifest provenance 诚实无谎标 fallback，无回归，并已更新 TRANSFER_STATUS.md 写回截图路径与残余风险。
暂停条件：需要付费服务 账号凭证 API key 或 Copernicus CDS 或运行时强网络依赖 或破坏性操作 或 git push 或版权素材时暂停并请求人工确认；同一任务连续 3 轮聚焦修复仍无法通过验收时暂停，报告已做改动与真实测试输出与缺口，不再盲目重试。
```

## 默认选择理由

三项需求的范围、数据源、双语与防拥挤规则、验证命令和文件结构都已在 PLAN-V3-WAZA-GLM5.2.md 固化，属低风险既有项目的渐进增强，因此直接给可执行 Goal，把 keyless 数据源、public-domain 约束、运行时零网络、诚实 provenance 和暂停条件写死，避免 agent 引入账号依赖或谎标 fallback。

## Goal Draft (English-compatible)

```text
/goal Following PLAN-V3-WAZA-GLM5.2.md in the same directory, deliver three improvements on the existing Three.js earth visualization: remove the terrain self-illumination highlight and switch to realistic sun lighting with a softly-lit night side, upgrade the single wind frame into a multi-frame ERA5 time series that evolves over time, and make the map clearer with deeper zoom plus 3D terrain relief plus country and province borders plus country and city and province labels where China shows Chinese-and-English and others show English without crowding, advancing through tasks A1 C1 C2 C3 C4 B1 B2 D1 in order until every acceptance check passes.
Verification: after each task first run that task Verify command and paste the real output; globally run npm install, then npm run build, then npx playwright install chromium, then npm run test:visual, and confirm desktop and mobile and desktop-zoom and desktop-t0 and desktop-t1 screenshots really exist and are non-empty under tests/__screens__/; a step is done only when the command truly passes, never claim completion without evidence.
Constraints: do not rebuild the working render pipeline or acceptance or window.__viz hooks only extend them, do not use any service needing an account or API key, use only keyless anonymous ERA5 ARCO for wind, use only public-domain data NASA and Natural Earth and GEBCO or ETOPO for map and borders and elevation, keep zero runtime network dependency by pre-baking all external data into public at build time, do not git push, do not add copyrighted assets, do not read or record any secret cookie token.
Boundaries: write only inside /Volumes/vol1/3D 风场地球可视化/ for files related to this plan; new data goes into public/ and scripts/; screenshot artifacts go only into tests/__screens__/; do not modify /Volumes/vol1/codex/container-3d-tutor/.
Iteration policy: do one task at a time strictly in order A1 C1 C2 C3 C4 B1 B2 D1; rerun that task Verify after each change, on failure first read the Playwright output and browser console before fixing, at most 3 focused fix rounds per task; keep wind and borders at a single draw call, quality switching via dispose then rebuild, labels decluttered against crowding, and every new dataset written with a manifest carrying source and licenseNote and sha256 with honest fallback labeling that never claims real data; advance only after the current task is green.
Stop when: the DoD for tasks A1 through D1 are all met, npm run build passes and npm run test:visual is green for both viewports 1280x1280 and 390x844, the five screenshot classes are saved, request one realistic lighting without highlight passes, request two multi-frame evolving wind passes, request three deeper zoom and 3D terrain and borders and decluttered bilingual labels pass, all new dataset manifests are honest with no mislabeled fallback, there is no regression, and TRANSFER_STATUS.md is updated with screenshot paths and residual risks.
Pause if: paid services, account credentials, API keys, Copernicus CDS, hard runtime network dependency, destructive operations, git push, or copyrighted assets are required, then request human confirmation; or the same task fails acceptance after 3 focused fix rounds, then pause and report changes made and real test output and the gap instead of blind retries.
```
