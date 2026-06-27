# ERA5 Data Provenance & Source Contract

阶段: 任务 2（waza-think）
日期: 2026-06-27

本文档固定 V2 风场的数据来源、变量、单位、访问方式、许可证与引用格式。所有 `era5-wind-frame-v1` 帧必须可追溯到本文档描述的来源。

## 1. 不使用 Windy API

**No Windy API.** 本项目不使用 Windy 的 API、瓦片、文案或品牌。原作者 @codetaur 明确说明 wind data 来自 Google 上的 ERA5，并用自研 wind visualization shader 渲染，不使用 Windy。Windy 会引入第三方 API、配额、授权与视觉抽象层，与本项目的"自研 shader + 可溯源气象数据"目标冲突。

## 2. 数据来源（首选 / 备选 / 权威源）

### 首选：ARCO-ERA5 on Google Cloud Public Datasets

- **bucket**: `gcp-public-data-arco-era5`（匿名可读，已探测 HTTP 200，见任务 2 transcript）。
- **Zarr 路径**: `gs://gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3`。
- **说明**: Google Research 的 ARCO-ERA5 是 ERA5 的 curated copy，hourly、全球、约 30 km（0.25°）、1979 至今。
- **访问**: anonymous storage（无需 Google 账号或认证材料）。
- **项目仓库**: https://github.com/google-research/arco-era5

### 备选：Google Earth Engine `ECMWF/ERA5/HOURLY`

- 仅当 ARCO-ERA5 public Zarr 无法访问时使用。
- Earth Engine 常需要账号授权；执行 agent 不得要求用户提供账号或认证材料，只能输出 GEE 导出脚本并在需要时暂停。
- 说明: https://developers.google.comearth-engine/datasets/catalog/ECMWF_ERA5_HOURLY

### 权威源：Copernicus CDS ERA5 single levels

- https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels
- ERA5 由 Copernicus Climate Change Service (C3S) at ECMWF 生产。引用与免责声明必须保留。

## 3. 变量与单位

- `10m_u_component_of_wind`（10 米高度东西向风分量，u）
- `10m_v_component_of_wind`（10 米高度南北向风分量，v）
- 单位：`m s**-1`（米/秒）。
- 风速 = `sqrt(u² + v²)`；风向由 u/v 决定。

## 4. `era5-wind-frame-v1` Schema

每个本地 frame JSON 必须包含以下字段（任务 3 loader + 任务 4 预处理脚本共同遵守）：

| 字段 | 类型 | 固定/示例 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | `era5-wind-frame-v1` | schema 版本，固定 |
| `source` | string | `ERA5 ARCO on Google Cloud Public Datasets` | 数据来源 |
| `producer` | string | `ECMWF / Copernicus Climate Change Service` | 数据生产者 |
| `access` | string | `Google Cloud Public Datasets` | 访问方式 |
| `variables` | string[] | `["10m_u_component_of_wind","10m_v_component_of_wind"]` | 变量名 |
| `units` | string | `m s**-1` | 单位 |
| `timeUtc` | string | `2024-01-15T00:00:00Z` | 数据对应 UTC 时间 |
| `grid` | object | `{ lon:[min,max,step], lat:[min,max,step], width, height, downsampled }` | 网格定义 |
| `u` | number[] | — | u 分量数值序列（width×height） |
| `v` | number[] | — | v 分量数值序列（width×height） |
| `speedStats` | object | `{ min, max, mean, p95, p5 }` | 风速统计 |
| `preprocess` | object | `{ downsample, source, command }` | 预处理说明 |
| `licenseNotice` | string | Copernicus/ECMWF disclaimer | 许可证免责声明 |

约束：
- 单个 frame JSON 默认 < 2 MB。
- `u`/`v` 必须可计算风速（长度一致、有限值）。
- 不得把 synthetic fallback 的 JSON 标记为 `source: ERA5...`。

## 5. 引用与免责声明（license notice）

> Results generated using ERA5 data. ERA5 is produced by the Copernicus Climate Change Service (C3S) at ECMWF. Contains modified Copernicus Climate Change Service information [2024]. Neither the European Commission nor ECMWF is responsible for any use of the downstream products.

固定引用格式：

> Hersbach, H., Bell, B., Berrisford, P., et al. (2020): The ERA5 global reanalysis. Quarterly Journal of the Royal Meteorological Society, 146(730), 1999–2049. https://doi.org/10.1002/qj.3803

数据集引用：

> Google Research. ARCO-ERA5: Analysis-Ready Cloud-Optimized ERA5 dataset. https://github.com/google-research/arco-era5

## 6. 下载与体积约束

- 仅下载一帧（固定 UTC 小时）的 10m u/v，下采样到约 2° 网格。
- 最大输出 JSON 2 MB；禁止提交原始 ERA5 巨型数据进仓库。
- 数据获取脚本在 `scripts/era5/`，产物在 `public/data/era5/frames/`。

## 7. 认证边界

- 不得读取、打印、复制或持久记录任何认证材料（API key、token、cookie、账号凭证）。
- ARCO-ERA5 走匿名读取；若需账号/认证/付费/2FA/代理，按任务 4 暂停条件停止并报告。
