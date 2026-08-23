# 钱博士Agent 作品集网页 — 交接文档（2026-08-23 凌晨写，睡醒从这里开始）

> 新会话第一步：读本文件 + `docs/API_契约.md`（AI 生成代码的数据层权威，杜绝接口失误）。

## 一、项目状态（全部实测通过 ✅）

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | 项目骨架（Vite+React+TS+Tailwind+FastAPI 双模式） | ✅ |
| 1 | 首页真实数据（9727 观点/31320 事件/987 笔记/11011 chunks） | ✅ |
| 2a | 简报列表页 + 详情页（react-markdown） | ✅ |
| 2b | 简报视觉美化（首页卡片/按月分组列表/TOC+进度条+分页） | ✅ |
| 2c | 数据资产页（ECharts×4：方向/周期/来源/命中率 + 多空表 + 观点样例） | ✅ |
| 2d | 决策台页（统计条/5 决策卡/8 资产卡白底卡/2 复盘） | ✅ |
| 2e | 架构页（暗色科技感：七层流水线/生命周期/MCP 工具/运行状态） | ✅ |
| 2f | 实盘纪律页（白底复盘风：原则/KPI带/框架4卡/决策日志5条/时间线，已脱敏） | ✅ |
| 2g | 简报行情区块（美股三大指数卡+AI链10chips+A股指数+持仓代理决策验证，SVG 5日走势） | ✅ |

**6 页完成 + 简报行情增强**。剩余：Phase 5（快照生成 + GitHub Pages 部署 + 打磨）、关于页 2h（AboutPage 还是占位）。

## 二、服务状态（写文档时在跑）

- 后端 FastAPI：**http://localhost:8010**（后台进程，8000 被别的服务占）
- 前端 Vite dev：**http://localhost:5173**
- 重启命令：
  - 后端：`cd E:\qianboshi-portfolio\backend && C:/Python314/python.exe -m uvicorn app.main:app --port 8010`（后台跑）
  - 前端：`cd E:\qianboshi-portfolio\frontend && npm run dev -- --port 5173`（后台跑）
- 若进程已死：直接跑上面命令；vite proxy 已指向 8010，无需改配置

## 三、待办（按序）

1. **Phase 5**：`backend/scripts/generate_snapshots.py`（调 repo 层生成 public/snapshots/*.json，含 market.json）+ snapshot-client 对接 + GitHub Actions 部署 Pages + 404 页 + SEO
2. **关于页 2h**：AboutPage 还是占位（求职向：技术栈/亮点/GitHub/联系方式）
3. **P0 管线升级（gpt 融合方案）**：行情快照接入 agent.py 日报（非交易时段显示最近收盘价而非 N/A）+ report_schema + 分章 Checkpoint——方案见 `webpage_design\16_refs_fusion_plan.md`（gpt-5.6-sol 评判 Turtle/OpenJury 的融合落地方案）

## 四、关键文件索引

- **API 契约**：`E:\qianboshi-portfolio\docs\API_契约.md`（生成代码前必读；2g 已加 /api/v1/market）
- **提示词/方案/审核**：`E:\qianboshi-agent\data\webpage_design\`（01-03 gpt 设计、04 架构 v0.2、06-17 各 phase 提示词、16_refs_fusion_plan.md、07 真实 schema 报告）
- **真实数据 schema**：`webpage_design\07_schema_report.md`（SQLite 表结构 + JSONL 字段）
- **验证脚本**：`frontend\verify_assets.cjs`/`verify_decisions.cjs`/`verify_decisions2.cjs`/`verify_architecture.cjs`/`verify_discipline.cjs`/`verify_market.cjs`
- **生成脚本**：`C:\tmp\qianboshi_phaseX_gen.py`（2g 版含非流式+524重试+离线声明；**注意 refs 超过 ~33K 字符必 524，大文件（如 api-client.ts）拆单独小批或手动改**）

## 五、工作流（已跑通 5 轮，勿改）

写提示词（含数据口径+验收标准+FILE 标记输出格式）→ 自审 → 调 gpt-5.6-sol 分批生成（≤3500 token/批，白名单防覆盖）→ 落盘剥围栏 → `npm run build` → 重启后端 → headless 实测 → 修 bug → 汇报。

**阶段编号规则**：临时插入需求 → 后续全部顺延一位（用户 8-23 明确要求）。

## 六、已知问题 / 坑

- **favicon 404**：index.html 引了不存在的图标，页面 console 报 404（无碍，可加 favicon 打磨）
- **chromadb 1.5.9 读旧 vector_db count=0**：qianboshi 主项目 RAG 检索疑似失效（网页回退 snapshot.json 显示 11011），**待用户拍板是否排查**（涉及主项目，降级 chromadb 或重建向量库）
- **浏览器工具（browser_navigate）外部会话会挂**：连 about:blank 都超时但本地 curl 正常时，直接用 verify_assets.cjs 实测
- **npm install 会删 devDeps**：Hermes 注入 NODE_ENV=production，frontend/.npmrc 已有 `omit=` 覆盖（勿删）
- **gpt 生成常见病**：造不存在的模块（useData/@/data/DataProvider）、import 删了还在用的符号、Tailwind 类名重复前缀、export 方式不匹配、字段不映射——全部列在 API_契约.md 第 6 节红线清单
- **fluxionai 流式调用会拿到空响应（2e 血泪坑 2026-08-23）**：`stream: True` 时 gpt-5.6-sol 只回 150 字符（模型"拒绝执行"式空话）。**必须用 `stream: False` 非流式**；提示词里加"你是离线代码生成器，不执行任何操作"声明可防拒绝。**批提示词超 ~33K 字符会 524**：拆小批（每批 ≤3 文件、refs 只带相关文件），call_gpt 里对 524 重试 3 次（等 20s）

## 七、用户偏好（合作方式）

- 先出方案/提示词 → 用户审核 → 再生成；不要一次全生成完（用户原话"方便有问题及时解决"）
- 每阶段实测通过再汇报，交付前自查
- 贵模型优先 gpt-5.6（fluxionai，key C:\tmp\fluxionai_key.txt），不行 fallback pro——qianboshi 主项目的 analysis 产出已接此机制
