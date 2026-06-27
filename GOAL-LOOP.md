# 循环执行 Goal 指令（喂给 GLM 5.2 / Codex 的 /goal）

> 用法：把下面 `推荐执行版` 整段复制给执行 agent。它会按 `PLAN-GLM5.2.md` 的任务 0 到 7 顺序自驱动、每步验证、知道何时停止、何时暂停。

## 推荐执行版（中文，可直接复制）

```text
/goal 按同目录 PLAN-GLM5.2.md，把已存在的 Three.js 占位 shell 升级为 V1 风场地球可视化：保留现有渲染管线，只升级占位层并补齐 UI 控件、质量切换和真实像素验收，按任务 0 到任务 7 顺序推进，直到全部验收通过。
验证：每个任务做完先运行该任务的 Verify 命令并贴出真实命令输出；全局依次运行 npm install、npm run build、npx playwright install chromium、npm run test:visual，并确认 tests/__screens__/ 下 desktop.png 与 mobile.png 真实存在且非空；只有命令真实通过才算该步完成，禁止无证据宣称完成。
约束：不重新脚手架、不整体重写 EarthScene 渲染管线，不接 ERA5 或 Copernicus 或 TLE 或 API key 或外部账号或实时服务，不引入有版权纹理或 HDRI，不把原视频帧入库，不做 git push，不读取或记录任何密钥 cookie token。
边界：只写入 /Volumes/vol1/3D 风场地球可视化/ 内与本计划相关的文件；只读不改 /Volumes/vol1/codex/container-3d-tutor/；截图产物只写入 tests/__screens__/。
迭代策略：一次只做一个任务，严格按 0 1 2 3 4 5 6 7 顺序；每个任务改动后重跑该任务 Verify，失败时先读 Playwright 测试输出和浏览器控制台日志再定位，单个任务最多 3 轮聚焦修复；保持风场与卫星单 draw call、质量切换走 dispose 再 rebuild；该任务绿了才进入下一任务。
完成条件：任务 0 到 7 的 DoD 全部满足，npm run build 通过且 npm run test:visual 两个视口 1280x1280 与 390x844 全绿，desktop.png 与 mobile.png 已保存，pause 与 reset 与 quality 三控件经 Playwright 实测驱动通过，无占位视觉层残留，并已更新 TRANSFER_STATUS.md 写回截图路径与残余风险。
暂停条件：需要付费服务 账号凭证 API key 外部数据源 破坏性操作 git push 或版权素材时暂停并请求人工确认；同一任务连续 3 轮聚焦修复仍无法通过验收时暂停，报告已做改动、真实测试输出与缺口，不再盲目重试。
```

## 默认选择理由

任务范围、约束、验证命令和文件结构都已在 PLAN-GLM5.2.md 固化，属于低风险既有项目升级，因此直接给出可执行 Goal，把验证命令和暂停条件写死，避免 agent 自行发明领域规则或覆盖已工作的渲染管线。

## Goal Draft (English-compatible)

```text
/goal Following PLAN-GLM5.2.md in the same directory, upgrade the existing Three.js placeholder shell into the V1 wind-field earth visualization: preserve the existing render pipeline, only upgrade placeholder layers and add UI controls, quality switching, and real pixel acceptance, advancing through Task 0 to Task 7 in order until every acceptance check passes.
Verification: after each task, first run that task's Verify command and paste the real command output; globally run npm install, then npm run build, then npx playwright install chromium, then npm run test:visual, and confirm desktop.png and mobile.png really exist and are non-empty under tests/__screens__/; a step is done only when the command truly passes, never claim completion without evidence.
Constraints: do not re-scaffold or rewrite the EarthScene render pipeline, do not connect ERA5 or Copernicus or TLE or API keys or external accounts or live services, do not add copyrighted textures or HDRI, do not vendor original video frames, do not git push, do not read or record any secret cookie token.
Boundaries: write only inside /Volumes/vol1/3D 风场地球可视化/ for files related to this plan; read but never modify /Volumes/vol1/codex/container-3d-tutor/; write screenshot artifacts only into tests/__screens__/.
Iteration policy: do one task at a time strictly in order 0 1 2 3 4 5 6 7; rerun that task's Verify after each change, on failure first read the Playwright output and browser console logs before fixing, at most 3 focused fix rounds per task; keep wind and satellites at a single draw call and quality switching via dispose then rebuild; advance only after the current task is green.
Stop when: the DoD for Task 0 through Task 7 are all met, npm run build passes and npm run test:visual is green for both viewports 1280x1280 and 390x844, desktop.png and mobile.png are saved, the pause and reset and quality controls are exercised and pass under Playwright, no placeholder visual layer remains, and TRANSFER_STATUS.md is updated with screenshot paths and residual risks.
Pause if: paid services, account credentials, API keys, external data sources, destructive operations, git push, or copyrighted assets are required, then request human confirmation; or the same task fails acceptance after 3 focused fix rounds, then pause and report changes made, real test output, and the gap instead of blind retries.
```
