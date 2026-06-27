# ERA5 V2 — Root Cause Report

阶段: 任务 1（waza-hunt，写于任何 V2 实现之前）
日期: 2026-06-27

## 症状（Symptoms）

1. **风线是随机短直线，缺少真实气象连续性。** 当前 `src/data/windSynthetic.js` 用 `seededRandom(seed)` 生成 lat/lon 起点与 speed，再围绕 3 个硬编码涡旋中心弯曲，整体观感是"均匀分布的程序化流线"，而非真实的全球风场（信风带、西风带、热带辐合带等结构缺失）。
2. **README 声称复现 @codetaur 视频核心观感，但 V2 真实 ERA5 数据未接。** README 第 3 行写"动态风场流线"，路线图把 ERA5 列为"V2 未接"。原作者明确说明 wind data 来自 Google 上的 ERA5，但当前实现是 synthetic。
3. **Playwright 10/10 全绿只证明有颜色、有动画、有控件，不证明风场来自 ERA5。** `tests/visual.spec.js` 的颜色桶断言（oceanBlue/warmLand/brightWhite）与动画帧差断言无法区分"synthetic 流线"与"ERA5 流线"——两者都能让同样的颜色桶通过。
4. **移动端截图中 HUD 与控件可能在窄视口挤压。** 当前 `.controls` 在 ≤480px 移到底部，`.hud` 在左上，需确认两者不重叠。

## 根因句（Root cause）

> I believe the root cause is that the current wind layer is synthetic seeded streamline data rather than ERA5-driven wind vectors, because `src/data/windSynthetic.js` generates random lat/lon seeds and `createWindLayer.js` only animates a shader bright band over those synthetic segments.

**Root cause:** the wind field direction and speed are produced by `seededRandom` in `src/data/windSynthetic.js`, not by any ERA5 10m u/v vector field; the shader only animates a bright band over those synthetic segments.

该根因能解释上述全部症状：症状 1 直接由 synthetic 数据导致；症状 2 是该事实的文档化；症状 3 是因为验收层无法区分数据源；症状 4 与本根因无关（是 UI 排版问题，独立修复，不影响"是否 ERA5"判断）。

## 代码证据（Evidence）

- `src/data/windSynthetic.js:16` — `const rand = seededRandom(seed);`，全部随机性来自 mulberry32 种子。
- `src/data/windSynthetic.js:28-29` — `const lat = -70 + rand() * 140; const lon = rand() * 360 - 180;`，起点是均匀随机分布，非真实风场结构。
- `src/data/windSynthetic.js:18-23` — 3 个涡旋中心是硬编码 `{lat, lon, strength}`，非气象数据。
- `src/scene/layers/createWindLayer.js` — 消费 `syntheticWind()` 输出的 segments，shader 只用 `uTime` 推动 bright band，方向完全由 synthetic points 决定。
- `src/scene/EarthScene.js:177-189` — `window.__viz` 没有 `windSource()` 字段，前端无法向测试报告当前风场来源。

## 测试证据（Evidence from tests）

- `npm run test:visual` 基线：10 passed（desktop + mobile 各 5）。
- 但断言集合（颜色桶、动画帧差、控件驱动、drawCalls）中**没有任何一项**能证明风场方向来自真实气象数据——synthetic 流线同样满足全部断言。
- 因此"测试全绿"与"风场是 synthetic"之间不矛盾：测试覆盖了视觉存在性与交互，未覆盖数据真实性。

## 当前测试不能证明的事项（Not proven by current tests）

- 风场方向是否来自 ERA5 10m u/v。
- `window.__viz` 是否能向外部暴露真实的数据源标识。
- 风速分布是否符合真实气象统计（speedStats 的 min/max/mean/p95）。
- 数据是否带有可追溯的 source/producer/license provenance。
- UI 在 missing frame 时是否能如实显示"ERA5 data missing"而非伪装成 ERA5。

## 改进方向（Fix direction）

1. 引入 `era5-wind-frame-v1` schema 与 `public/data/era5/` 数据目录（任务 2-4）。
2. 新增 `src/data/windSource.js` 与 loader/validator，`window.__viz.windSource()` 暴露真实来源（任务 3）。
3. 用 ARCO-ERA5 公开 Zarr 匿名读一帧 10m u/v，下采样成 <2MB JSON（任务 4，受 Python 依赖可用性约束）。
4. `traceWindStreamlines.js` 在 ERA5 网格上积分生成方向真实的流线，seeded 只控制采样种子与相位（任务 5）。
5. `createWindLayer.js` 消费 ERA5 streamlines，shader 颜色/方向/密度由 ERA5 决定（任务 6）。
6. 新增 Playwright 断言：`windSource() === "era5"`，并验证风场方向非随机（任务 5-6 验收）。

> 不使用 Windy API（原作者明确不用）。不把 synthetic fallback 描述成 ERA5。
