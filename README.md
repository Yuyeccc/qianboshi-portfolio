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
- `/zh/assets`
- `/zh/decisions`
- `/zh/discipline`
- `/zh/about`
- `/en`
- `/en/architecture`
- `/en/assets`
- `/en/decisions`
- `/en/discipline`
- `/en/about`

Phase 0 仅提供页面骨架、数据访问接口、主题系统和国际化资源结构。