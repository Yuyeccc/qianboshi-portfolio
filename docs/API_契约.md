# 钱博士Agent 作品集网页 — API 契约文档（v1.0）

> **给 AI 生成代码时的数据层唯一权威**。任何涉及数据获取/类型/映射的代码生成，必须先读本文档再动手。
> 与后端 repos 和前端 types/api-client 保持同步；改代码时同步更新本文档。

---

## 1. 全局约定（违反 = 返工）

| 约定 | 说明 |
|---|---|
| 后端返回 **snake_case** | `structured_views`、`hit_rate`、`generated_at` |
| 前端 TS 类型 **camelCase** | `structuredViews`、`hitRate`、`generatedAt` |
| **api-client.ts 内显式映射** | 禁止把后端 JSON 原样当 TS 类型返回；每个字段 `?? null` 兜底 |
| 失败降级 | 后端异常/非 2xx → 前端返回**全空结构**（null/[]），**禁止抛错** |
| 后端兜底 | 每个 repo 函数独立 try/except，单项失败返回 null/[]/空 dict，不拖垮整体 |
| SQLite 只读 | `sqlite3.connect("file:...?mode=ro", uri=True)`，禁止写 |
| 样式 | 组件只用 Tailwind 映射类（text-heading/bg-surface/border-line 等），**禁止硬编码色值/var(--x)** |
| 数据获取 | 页面用 `useContext(DataContext)`（from `@/app/providers`）拿 provider，**不存在 useData/DataProvider 模块** |
| 页面导出 | 页面组件 **default export**（router 用 default import） |

## 2. 后端端点清单（backend/app/main.py，FastAPI，端口 8010，prefix=/api/v1）

| Method | Path | 返回 | 数据源 | 状态 |
|---|---|---|---|---|
| GET | /health | `{status:"ok", version}` | - | ✅ 已实现 |
| GET | /api/v1/meta | `{data_mode, phase, status}` | - | ✅ |
| GET | /api/v1/overview | `{metrics, status, latest_brief}` | overview_repo | ✅ |
| GET | /api/v1/overview/metrics | `{metrics}` | overview_repo | ✅ |
| GET | /api/v1/assets | `{assets: {...}}` | assets_repo | ✅ |
| GET | /api/v1/decisions | `{decisions_data: {...}}` | decisions_repo | ✅ |
| GET | /api/v1/briefs | `{briefs: [...]}` | brief_repo | ✅ |
| GET | /api/v1/briefs/{filename} | `{brief: {...}}` 或 404 | brief_repo（路径穿越已防） | ✅ |

**未实现（Phase 2e+）**：/api/v1/architecture、/api/v1/discipline、/api/v1/about（前端 api-client 已有对应空骨架方法，后端加了端点后只需在 api-client 补映射）。

## 3. 端点返回结构 + 字段映射（snake_case → camelCase）

### 3.1 GET /api/v1/overview
```json
{
  "metrics": {"structured_views": 9727, "prediction_events": 31320, "notes": 987,
              "rag_chunks": 11011, "source_count": 6, "generated_at": "ISO"},
  "status": {"last_checked": "2026-08-22 22:39", "detected_today": 8,
             "source_count": 6, "pipeline_running": true},
  "latest_brief": {"filename": "日报_2026-08-22.md", "generated_at": "ISO",
                   "summary": "今日总览 - 主线：...", "section_count": 8}
}
```
映射：`structured_views→structuredViews`、`prediction_events→predictionEvents`、`rag_chunks→ragChunks`、`source_count→sourceCount`、`generated_at→generatedAt`、`last_checked→lastChecked`、`detected_today→detectedToday`、`pipeline_running→pipelineRunning`、`section_count→sectionCount`

### 3.2 GET /api/v1/assets
```json
{"assets": {
  "metrics": {"structured_views": 9727, "prediction_events": 31320, "notes": 987,
              "rag_chunks": 11011, "analysts": 11, "asset_cards": 8, "generated_at": "ISO"},
  "stance_dist": [{"name": "bullish", "label_zh": "看多", "value": 2465}, ...5项],
  "horizon_dist": [{"name": "short", "label_zh": "短期", "value": 2308}, ...5项],
  "source_contrib": [{"name": "钱博士直播", "views": 4441}, ...top10],
  "analyst_rank": [{"name": "任泽平", "hit_rate": 0.7941, "samples": 34}, ...top8],
  "debate_cards": [{"entity": "国产替代", "bullish": 98, "bearish": 76, "neutral": 130,
                    "consensus": "neutral", "disagreement": 0.4706, "updated": "ISO"}],
  "sample_views": [{"analyst": "钱博士直播", "date": "...", "stance": "neutral", "claim": "前80字"}]
}}
```
映射：`stance_dist→stanceDist`、`label_zh→labelZh`、`horizon_dist→horizonDist`、`source_contrib→sourceContrib`、`hit_rate→hitRate`、`samples→samples`、`debate_cards→debateCards`、`asset_cards→assetCards`、`sample_views→sampleViews`
（stance 取值：bullish 看多/bearish 看空/neutral 中性/watch 观察/risk 风险）

### 3.3 GET /api/v1/decisions
```json
{"decisions_data": {
  "stats": {"total": 5, "open": 3, "reviewed": 2, "hit": 0, "wrong": 2, "generated_at": "ISO"},
  "decisions": [{"decision_id": "...", "asset_name": "黄金", "asset_type": "commodity",
                 "decision_date": "2026-08-06", "horizon": "medium", "direction": "bullish",
                 "conviction": 0.7, "thesis": "前120字", "status": "open", "review_result": null}],
  "asset_cards": [{"asset_id": "GOLD", "asset_name": "黄金", "asset_type": "commodity",
                   "description": "...", "factors": [{"factor_name": "美元指数",
                   "current_state": "近5日走弱-1.07%", "impact_direction": "positive",
                   "impact_strength": "high"}]}],
  "reviews": [{"decision_id": "...", "asset_name": "科技股", "direction": "bearish",
               "review_date": "2026-08-11", "result_label": "wrong", "outcome_return": 1.9048,
               "horizon_days": 5, "new_rule_learned": null}]
}}
```
映射：`decision_id→decisionId`、`asset_name→assetName`、`asset_type→assetType`、`decision_date→decisionDate`、`review_result→reviewResult`、`factor_name→factorName`、`current_state→currentState`、`impact_direction→impactDirection`、`impact_strength→impactStrength`、`result_label→resultLabel`、`outcome_return→outcomeReturn`、`horizon_days→horizonDays`、`new_rule_learned→newRuleLearned`、`decisions_data→(getDecisions 返回 DecisionSummary 本体)`

### 3.4 GET /api/v1/briefs
```json
{"briefs": [{"filename": "日报_2026-08-22.md", "date": "2026-08-22",
             "generated_at": "ISO", "size_bytes": 8902}]}
```
映射：`size_bytes→sizeBytes`

### 3.5 GET /api/v1/briefs/{filename}
```json
{"brief": {"filename": "日报_2026-08-22.md", "content": "md原文", "generated_at": "ISO"}}
```
前端调用：`encodeURIComponent(filename)`；404 时前端返回 null

## 4. 前端类型（frontend/src/types/index.ts，已存在，勿重复定义）

核心类型：`OverviewData`（metrics/status/latestBrief）、`AssetsData`（metrics/stanceDist/horizonDist/sourceContrib/analystRank/debateCards/sampleViews）、`DecisionSummary`（stats/decisions/assetCards/reviews）、`BriefItem`、`BriefDetail`、`LatestBrief`（含 summary/sectionCount）。详情以 types/index.ts 为准（生成代码前先读该文件）。

## 5. DataProvider 接口（frontend/src/data/provider.ts）

```ts
export interface DataProvider {
  getOverview(): Promise<OverviewData>;
  getArchitecture(): Promise<ArchitectureData>;
  getAssets(): Promise<AssetsData>;
  getDecisions(): Promise<DecisionSummary>;
  getDiscipline(): Promise<DisciplineData>;
  getAbout(): Promise<AboutData>;
  getBriefs(): Promise<BriefItem[]>;
  getBrief(filename: string): Promise<BriefDetail | null>;
}
```
实现：`ApiClient`（fetch `${apiBaseUrl}/v1/...`，失败返回空结构）+ `SnapshotClient`（读 `public/snapshots/*.json`，Phase 5 才有文件，现在返回空）。页面拿 provider：`const provider = useContext(DataContext)`，直接 `provider.getXxx()`。

## 6. AI 生成代码红线清单（每一条都是踩过的坑）

1. **不要发明不存在的模块**：`@/data/DataProvider`、`useData` hook、`@/data/context` 都不存在 → 用 `@/app/providers` 的 `DataContext` + `useContext`
2. **不要改 import 后删掉仍在用的符号**（lucide 图标、useState/useEffect 等）
3. **字段必须显式映射**：后端 snake_case → 前端 camelCase，逐字段 `?? null`
4. **Tailwind 类名**：`border-line`/`bg-surface`/`text-heading`/`text-muted`/`text-brand`/`bg-surfaceSubtle`/`shadow-card`（不是 border-border-line / text-text-muted）
5. **页面 default export**；`export function` 与 `import X from` 要匹配
6. **i18n**：所有 UI 文案走 `t("key")`，zh.ts/en.ts 成对补 key；数据内容（分析师名/简报正文）不翻译
7. **ECharts**：MutationObserver 禁止 `subtree: true`（无限循环卡死）；主题切换监听 `documentElement` 的 `data-theme/class` 属性即可
8. **输出格式**：文件用 `<<<FILE: 路径>>> 内容 <<<END>>>` 标记，只输出清单内文件（白名单），禁止带 ``` 代码围栏
9. **详情页/列表页**数据获取模式参照 OverviewPage（useContext + useEffect + loading/error/empty 三态）
10. 新增后端端点后，**前端 4 处要同步**：types/index.ts、api-client.ts（映射）、snapshot-client.ts（读快照）、页面
