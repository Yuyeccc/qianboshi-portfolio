# 钱博士Agent 求职作品集

钱博士Agent 是一个真实运行的 AI 金融投研系统，覆盖 B 站多 UP 主内容采集、GPU 转写、ASR 纠错、LLM 结构化、ChromaDB RAG、盘前简报和飞书推送。

本项目是其独立的作品集展示站，采用 Vite + React + TypeScript 构建，支持中英文路由和三套主题。

## 数据模式

前端通过 `VITE_DATA_MODE` 切换数据访问实现：

- `live`：通过 FastAPI API 获取数据
- `snapshot`：读取 `frontend/public/snapshots/` 下的静态 JSON 快照

默认配置：

```env
VITE_DATA_MODE=live
VITE_API_BASE_URL=/api
```

快照模式：

```env
VITE_DATA_MODE=snapshot
VITE_API_BASE_URL=/snapshots
```

## 启动前端

```bash
cd frontend
npm install
npm run dev
```

开发服务器默认地址：

```text
http://localhost:5173
```

构建生产版本：

```bash
cd frontend
npm run build
```

构建快照模式版本：

```bash
cd frontend
npm run build:snapshot
```

## 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端默认地址：

```text
http://localhost:8000
```

健康检查：

```text
http://localhost:8000/health
```

## 目录结构

```text
qianboshi-portfolio/
├── docs/                 # 项目技术文档
├── frontend/             # Vite + React 前端
│   ├── public/
│   │   └── snapshots/    # snapshot 模式静态数据
│   └── src/
└── backend/              # FastAPI 只读 API
```

## 页面路由

- `/zh`
- `/zh/architecture`
- `/zh/agent`             # 研究 Agent 工单台（P0/P1 真接，安检+提交+实时报告）
- `/zh/assets`
- `/zh/decisions`
- `/zh/discipline`
- `/zh/about`
- `/en`
- `/en/architecture`
- `/en/agent`
- `/en/assets`
- `/en/decisions`
- `/en/discipline`
- `/en/about`

> 路由带 `/:locale/` 前缀：/agent 页真实 URL 是 `#/zh/agent`（`#/agent` 会把 agent
> 当 locale 落到 overview，非 bug）。

## 研究 Agent API（P1-C/D，2026-09-03）

前端 `/agent` 工单台真实提交研究任务，后端以「job 文件状态机 + 子进程解耦」调用
qianboshi-agent 的 research_agent（详见 qianboshi-agent 仓 README/架构文档 §3）：

```text
POST /api/v1/research/jobs
     body: {"goal": "黄金 9 月情景推演"}
     202  -> {"job": {job_id, status: queued, ...}}          # 安检放行，后台执行
     422  -> {"detail": {"error": "intent_blocked", "gate": {...}}}   # block/clarify 拒收

GET  /api/v1/research/jobs/{job_id}    # 轮询：queued→running→done(附报告)/failed
GET  /api/v1/research/jobs?limit=20    # 最近任务列表
```

要点：

- 安检 fail-closed：后端 `intent_gate`（agent 仓移植版）与前端 agentScreening.ts
  双层同规则，`RULE_VERSION` 对账防漂移
- 研究产物落 `DATA_DIR/research/`，job 状态机文件落 `DATA_DIR/research_jobs/`，
  按 `_meta.job_id` 精确关联；done 后 GET 直接附完整报告（协议 v2，schema 共享）
- 运行环境：后端需可访问 agent 仓（默认 `E:\qianboshi-agent`，Mac 用
  `QIANBOSHI_AGENT_DIR/QIANBOSHI_DATA_DIR/QIANBOSHI_NOTES_DIR` 注入）；子进程
  python 优先级 `QIANBOSHI_RESEARCH_PYTHON → C:/Python314/python.exe → sys.executable`
- 前端降级：无后端/网络失败时 `/agent` 自动走演示报告（demo 徽标明示，非真实）

Phase 0 仅提供页面骨架、数据访问接口、主题系统和国际化资源结构。