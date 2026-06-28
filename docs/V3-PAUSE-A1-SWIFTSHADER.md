# V3 任务 A1 暂停报告 — SwiftShader 桌面端性能墙

日期: 2026-06-28
状态: **任务 A1 逻辑完成并逐项验证通过，但完整 `npm run test:visual` 在桌面端 1280×1280 因 SwiftShader 性能墙无法在合理时间内跑完，按 PLAN 暂停条件暂停，请求人工确认推进方式。**

## 1. 任务 A1 已完成的真实改动（commit c3e20f8）

### 代码（请求 1 全部实现）
- `src/scene/layers/createEarth.js`：**移除 emissive 自发光**（emissive→黑色、intensity→0），材质改哑光（roughness 0.9、metalness 0），消除整面"高亮"。
- `src/scene/EarthScene.js`：
  - DirectionalLight 作为**真实太阳**（强度 2.6），方向由 ERA5 帧 UTC 推算的**次太阳点**（subsolar lon/lat）决定，世界空间固定（地球自转时昼夜线沿地理经度移动）。
  - **暗面柔光**：HemisphereLight 1.8 + AmbientLight 0.7，保证夜面地形/标签可读但明显暗于昼面。
  - `environmentIntensity` 降至 0.15 去室内镜面感。
  - 新增 `updateSunFromTime()`、`setRenderFreeze()`；`animate()` 节流更新太阳。
  - `window.__viz` 扩展：`lightingMode`（="realisticSun"）、`nightFillEnabled`、`sunDirection`、`setRenderFreeze`。

### 测试与验收
- `tests/helpers/colorBuckets.js`：新增 `analyzeLighting()`（过曝比、昼夜终止线 gap、夜面亮度）。
- `tests/visual.spec.js` renders-the-globe：新增 A1 断言 `lightingMode==="realisticSun"`、`overexposureRatio<0.12`、`terminatorGap>8`、`nightLuminance>30`；nonBackgroundRatio 重标定为 0.25（真实日照下夜面变暗）。
- 截图改 page-screenshot + clip；引入 `?nobloom=1`（跳过 composer）与 `setRenderFreeze` 让截图稳定。

## 2. 逐项验证证据（真实命令输出）

| 验证 | 命令/对象 | 结果 |
|---|---|---|
| build | `npm run build` | ✅ exit 0，dist 590KB |
| `lightingMode` 钩子 | `__viz.lightingMode()` | ✅ `"realisticSun"` |
| mobile renders-globe（全 A1 断言） | `npx playwright test -g "renders the globe" --project=mobile` | ✅ **passed**（含 lighting 断言） |
| desktop renders-globe（全 A1 断言） | 同上 --project=desktop | ✅ **passed (1.5m)**（overexp 0.009<0.12, terminator 10.6>8, night 35>30, buckets 全过） |
| 逐帧渲染速度（关键诊断） | 5 帧 rAF 计时 | 6–16 ms/帧（≈60–150 FPS）—— **渲染本身很快** |

## 3. 暂停原因：SwiftShader 桌面端截图性能墙（非代码缺陷）

- **根因证据**：渲染本身 6–16 ms/帧，但**每次 `page.screenshot` 在 1280×1280 触发 ReadPixels stall 30–60 秒**。这是 SwiftShader 软件渲染读取合成帧的固有代价，与 A1 逻辑无关。
- **对比基线**：V2.1 commit（emissive 版）在桌面端 1280×1280 同样为 **0.3 FPS**（已 git stash 对比验证），证明这是环境限制而非 A1 回归。
- **后果**：单个截图 ~40s，动画测试 4 张截图 + 等待 ≈ 3–4 分钟/测试；完整 14 测试套件预估 **30+ 分钟**，远超单轮执行预算，`npm run test:visual` 无法在合理时间跑完。

## 4. 已尝试的缓解（均已生效，但仍不足以让全套件在预算内跑完）

- `?nobloom=1` 跳过 EffectComposer（去掉 render-target readback）。
- `setRenderFreeze(true)` 冻结 rAF 让单截图稳定。
- `?lowres=1` 缩小 WebGL backing store。
- 提高 `actionTimeout`(120s)、`timeout`(360s)、各测试 `test.setTimeout`。

## 5. 缺口（待解决才能 A1 全绿）

**唯一缺口**：完整 `npm run test:visual`（14 测试 × 桌面端慢截图）在当前 SwiftShader 环境下耗时过长（~30 分钟），无法在单轮预算内作为单一命令跑完。逐测试均已验证通过。

## 6. 请求人工确认（按 PLAN 暂停条件）

请确认以下任一推进方式后我继续：
1. **接受长耗时**：授权我把每测试超时设到 ~6 分钟、整套件跑 ~30 分钟作为 A1 收口验证（功能正确，只是慢）。
2. **桌面端降分辨率验收**：把桌面 project viewport 从 1280×1280 降到 1280×720 或更低（截图快 40%+），仍出 `desktop.png`。
3. **桌面端走 nobloom + 冻结验收**：桌面测试统一 `nobloom=1` + freeze（已证明单截图 ~36s 可过），动画测试改用 hook-based 帧差（`windFrameIndex` 推进）而非像素帧差。
4. **GPU 环境验收**：在有真实 GPU 的环境跑 `npm run test:visual`（SwiftShader 限制消失）。

## 7. 未做事项（后续任务 C1–D1 全部未开始，按顺序待 A1 收口后推进）

C1 深 zoom / C2 3D 地形 / C3 国界省界 / C4 标签 / B1 多帧 ERA5 / B2 风场演变 / D1 收口。

## 8. 边界遵守情况

- ✅ 未重建渲染管线/验收/`__viz`（只扩展钩子）。
- ✅ 未碰 ERA5 风场逻辑（`src/data/era5/`、`windSource.js`、`createWindLayer.js` 未改）。
- ✅ 未接账号/key 服务；未做 git push（本地 commit c3e20f8）。
- ✅ 未读任何密钥/cookie/token。
