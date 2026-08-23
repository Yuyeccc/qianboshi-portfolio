import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  ChevronRight,
  FileText,
  FlaskConical,
  Library,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { DataContext } from "@/app/providers";
import {
  ListNotesParams,
  NotesListData,
  RagData,
  RagSuggestionItem,
  VaultAssetsIndex,
  VaultNoteDetail,
  VaultNoteItem,
  VaultSummary,
} from "@/types";

const MODES = ["notes", "search", "assets"] as const;
type VaultMode = (typeof MODES)[number];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-surfaceBrand px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function ResearchVaultPage() {
  const { t } = useTranslation();
  const provider = useContext(DataContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: VaultMode = MODES.includes(modeParam as VaultMode)
    ? (modeParam as VaultMode)
    : (localStorage.getItem("vault-mode") as VaultMode) || "notes";

  const [mode, setMode] = useState<VaultMode>(initialMode);
  const [summary, setSummary] = useState<VaultSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // 笔记模式状态
  const [notesData, setNotesData] = useState<NotesListData | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesQuery, setNotesQuery] = useState("");
  const [notesSort, setNotesSort] = useState("date_desc");
  const [notesPage, setNotesPage] = useState(1);
  const [activeNote, setActiveNote] = useState<VaultNoteDetail | null>(null);
  const [activeNoteLoading, setActiveNoteLoading] = useState(false);

  // 检索模式状态
  const [ragQuery, setRagQuery] = useState("");
  const [ragData, setRagData] = useState<RagData | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragTopK, setRagTopK] = useState(10);
  const [ragMaxDays, setRagMaxDays] = useState<string>("");
  const [suggestions, setSuggestions] = useState<RagSuggestionItem[]>([]);

  useEffect(() => {
    if (!provider) return;
    let active = true;
    provider
      .getVaultSummary()
      .then((data) => active && setSummary(data))
      .catch(() => active && setSummary(null))
      .finally(() => active && setLoadingSummary(false));
    provider
      .getRagSuggestions()
      .then((items) => active && setSuggestions(items))
      .catch(() => active && setSuggestions([]));
    return () => {
      active = false;
    };
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("vault-mode", mode);
    const next = new URLSearchParams(searchParams);
    if (mode === "notes") next.delete("mode");
    else next.set("mode", mode);
    setSearchParams(next, { replace: true });
  }, [mode, searchParams, setSearchParams]);

  const loadNotes = useMemo(
    () => (params: ListNotesParams) => {
      if (!provider) return;
      setNotesLoading(true);
      provider
        .listNotes(params)
        .then((data) => setNotesData(data))
        .catch(() => setNotesData(null))
        .finally(() => setNotesLoading(false));
    },
    [provider],
  );

  useEffect(() => {
    loadNotes({ page: notesPage, pageSize: 20, sort: notesSort });
  }, [notesPage, notesSort, loadNotes]);

  const applyNotesFilter = () => {
    setNotesPage(1);
    loadNotes({
      page: 1,
      pageSize: 20,
      sort: notesSort,
      query: notesQuery.trim() || undefined,
    });
  };

  const openNote = (noteId: string) => {
    if (!provider) return;
    setActiveNoteLoading(true);
    setActiveNote(null);
    provider
      .getNoteDetail(noteId)
      .then((detail) => setActiveNote(detail))
      .catch(() => setActiveNote(null))
      .finally(() => setActiveNoteLoading(false));
  };

  const runRag = (queryText?: string) => {
    const text = (queryText ?? ragQuery).trim();
    if (!text || !provider) return;
    setRagLoading(true);
    provider
      .ragQuery({
        text,
        topK: ragTopK,
        maxDays: ragMaxDays ? Number(ragMaxDays) : undefined,
      })
      .then((data) => setRagData(data))
      .catch(() => setRagData(null))
      .finally(() => setRagLoading(false));
  };

  const summaryItems = summary
    ? [
        { label: t("vault.notes"), value: summary.notesCount },
        { label: t("vault.views"), value: summary.viewsCount },
        { label: t("vault.chunks"), value: summary.chunksCount },
        { label: t("vault.assets"), value: summary.assetsCount },
      ]
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      {/* 标题区 */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-brand">
            <Library size={18} aria-hidden="true" />
            <span className="font-mono text-xs uppercase tracking-[0.18em]">
              Research Vault
            </span>
          </div>
          <h1 className="display-title mt-3 text-4xl text-heading sm:text-5xl">
            {t("vault.title", "研究档案库")}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">
            {t("vault.subtitle", "Obsidian 笔记、资产证据包与 RAG 检索的统一研究入口")}
          </p>
        </div>
        {summary && (
          <dl className="grid grid-cols-4 gap-4 rounded-lg border border-line bg-surface px-5 py-4 shadow-card">
            {summaryItems.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted">{item.label}</dt>
                <dd className="mt-1 text-xl font-medium tabular-nums text-heading">
                  {item.value == null ? "—" : item.value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {/* 模式切换 */}
      <div className="mt-10 flex flex-wrap gap-2 border-b border-line pb-px" role="tablist">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              mode === m
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-heading"
            }`}
          >
            {m === "notes" && <BookOpen size={15} aria-hidden="true" />}
            {m === "search" && <Search size={15} aria-hidden="true" />}
            {m === "assets" && <FlaskConical size={15} aria-hidden="true" />}
            {t(
              m === "notes"
                ? "vault.modeNotes"
                : m === "search"
                  ? "vault.modeSearch"
                  : "vault.modeAssets",
            )}
          </button>
        ))}
      </div>

      {/* 笔记浏览模式 */}
      {mode === "notes" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="space-y-4 rounded-lg border border-line bg-surface p-5">
            <label className="block text-sm font-medium text-heading">
              {t("vault.keyword", "筛选")}
            </label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                value={notesQuery}
                onChange={(e) => setNotesQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyNotesFilter()}
                placeholder={t("vault.searchPlaceholder", "搜索标题 / 正文关键词…")}
                className="w-full rounded-md border border-line bg-surfaceSubtle py-2 pl-9 pr-3 text-sm text-text outline-none transition focus:border-brand"
              />
            </div>
            <select
              value={notesSort}
              onChange={(e) => setNotesSort(e.target.value)}
              className="w-full rounded-md border border-line bg-surfaceSubtle px-3 py-2 text-sm text-text outline-none focus:border-brand"
            >
              <option value="date_desc">{t("vault.sortDateDesc", "日期从新到旧")}</option>
              <option value="date_asc">{t("vault.sortDateAsc", "日期从旧到新")}</option>
              <option value="title">{t("vault.sortTitle", "按标题")}</option>
            </select>
            <button
              type="button"
              onClick={applyNotesFilter}
              className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brandStrong"
            >
              {t("vault.clearFilters", "应用筛选")}
            </button>
          </aside>

          <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
            <div>
              {notesLoading && !notesData ? (
                <div className="flex items-center gap-2 py-16 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("vault.loading", "加载中…")}
                </div>
              ) : !notesData || notesData.data.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">{t("vault.notesEmpty", "暂无笔记")}</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                  {notesData.data.map((note: VaultNoteItem) => (
                    <li key={note.noteId}>
                      <button
                        type="button"
                        onClick={() => openNote(note.noteId)}
                        className={`flex w-full flex-col gap-1.5 px-5 py-4 text-left transition hover:bg-surfaceSubtle ${
                          activeNote?.noteId === note.noteId ? "bg-surfaceBrand/30" : ""
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-medium text-heading">{note.title || note.filename}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">{formatDate(note.noteDate)}</span>
                        </span>
                        <span className="line-clamp-2 text-sm text-muted">{note.excerpt}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {note.tags?.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-surfaceSubtle px-2 py-0.5 text-[11px] text-muted">
                              #{tag}
                            </span>
                          ))}
                          {note.structuredViewCount ? (
                            <span className="ml-auto text-[11px] tabular-nums text-brand">
                              {note.structuredViewCount} {t("vault.relatedViewsCount", "条关联观点")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {notesData && notesData.pagination.hasMore && (
                <button
                  type="button"
                  onClick={() => setNotesPage((p) => p + 1)}
                  className="mt-4 w-full rounded-md border border-line bg-surface py-2.5 text-sm text-muted transition hover:border-brand hover:text-brand"
                >
                  {t("vault.loadMore", "加载更多")}
                </button>
              )}
            </div>

            {/* 笔记详情面板 */}
            <aside className="max-h-[80vh] overflow-y-auto rounded-lg border border-line bg-surface p-5">
              {activeNoteLoading ? (
                <div className="flex items-center gap-2 py-16 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("vault.notesLoading", "加载笔记…")}
                </div>
              ) : !activeNote ? (
                <p className="py-16 text-center text-sm text-muted">
                  {t("vault.detail", "从左侧选择一篇笔记查看详情")}
                </p>
              ) : (
                <article>
                  <h2 className="text-lg font-semibold text-heading">{activeNote.title || activeNote.filename}</h2>
                  <p className="mt-1 font-mono text-xs text-muted">{activeNote.filename}</p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    {activeNote.noteDate && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">{t("vault.noteDate", "日期")}</dt>
                        <dd className="text-text">{formatDate(activeNote.noteDate)}</dd>
                      </div>
                    )}
                    {activeNote.source && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">{t("vault.source", "来源")}</dt>
                        <dd className="text-text">{activeNote.source}</dd>
                      </div>
                    )}
                    {activeNote.tags && activeNote.tags.length > 0 && (
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-muted">{t("vault.tags", "标签")}</dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {activeNote.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-surfaceSubtle px-2 py-0.5 text-[11px] text-muted">
                              #{tag}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="prose-sm mt-5 max-w-none border-t border-line pt-4 text-sm leading-6 text-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeNote.content}
                    </ReactMarkdown>
                  </div>
                  {activeNote.relatedViews && activeNote.relatedViews.length > 0 && (
                    <section className="mt-6 border-t border-line pt-4">
                      <h3 className="text-sm font-medium text-heading">
                        {t("vault.relatedViews", "关联结构化观点")}
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {activeNote.relatedViews.map((view) => (
                          <li key={view.viewId} className="rounded-md border border-line bg-surfaceSubtle p-3">
                            <p className="text-sm text-text">{view.claim}</p>
                            <p className="mt-2 text-xs text-muted">
                              {view.analyst} · {formatDate(view.date)} · {view.stance}
                              {view.confidence != null ? ` · ${Math.round(view.confidence * 100)}%` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </article>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* RAG 检索模式 */}
      {mode === "search" && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runRag()}
                  placeholder={t("vault.searchPlaceholder", "输入问题，检索知识库，如：黄金后市怎么看…")}
                  className="w-full rounded-md border border-line bg-surfaceSubtle py-2.5 pl-10 pr-4 text-sm text-text outline-none transition focus:border-brand"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ragTopK}
                  onChange={(e) => setRagTopK(Number(e.target.value))}
                  className="rounded-md border border-line bg-surfaceSubtle px-2.5 py-2.5 text-sm text-text outline-none focus:border-brand"
                >
                  {[5, 10, 20, 50].map((k) => (
                    <option key={k} value={k}>
                      top-{k}
                    </option>
                  ))}
                </select>
                <select
                  value={ragMaxDays}
                  onChange={(e) => setRagMaxDays(e.target.value)}
                  className="rounded-md border border-line bg-surfaceSubtle px-2.5 py-2.5 text-sm text-text outline-none focus:border-brand"
                >
                  <option value="">{t("vault.allTime", "全部时间")}</option>
                  <option value="7">7 {t("vault.days", "天")}</option>
                  <option value="30">30 {t("vault.days", "天")}</option>
                  <option value="90">90 {t("vault.days", "天")}</option>
                  <option value="365">365 {t("vault.days", "天")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => runRag()}
                  className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brandStrong"
                >
                  <Sparkles size={15} aria-hidden="true" />
                  {t("vault.search", "检索")}
                </button>
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.query}
                    type="button"
                    onClick={() => {
                      setRagQuery(s.query);
                      runRag(s.query);
                    }}
                    className="rounded-full border border-line bg-surfaceSubtle px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {ragLoading ? (
            <div className="flex items-center gap-2 py-16 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("vault.searchLoading", "检索中…")}
            </div>
          ) : ragData?.snapshotLimited ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
              {t("vault.snapshotLimited", "快照模式仅支持预设查询，完整检索请使用本地 API 环境。")}
            </div>
          ) : ragData?.degraded ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
              {t("vault.degraded", "检索服务暂不可用")}
              {ragData.reason ? `：${ragData.reason}` : ""}
            </div>
          ) : ragData && ragData.data.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">{t("vault.searchEmpty", "没有检索结果")}</p>
          ) : ragData ? (
            <ul className="space-y-3">
              {ragData.data.map((hit) => (
                <li key={`${hit.rank}-${hit.source}`} className="rounded-lg border border-line bg-surface p-5 shadow-card">
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="rounded bg-surfaceSubtle px-1.5 py-0.5 font-mono tabular-nums text-brand">#{hit.rank}</span>
                    <span className="truncate font-mono">{hit.source}</span>
                    {hit.section && <span className="truncate">{hit.section}</span>}
                    <span className="ml-auto shrink-0 rounded-full bg-surfaceSubtle px-2 py-0.5">{hit.type}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text">
                    {highlightText(hit.content, ragQuery)}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                    <span>
                      {t("vault.relevanceScore", "相关度")}: {hit.score.toFixed(3)}
                    </span>
                    <span>
                      {t("vault.rawScore", "原始相似度")}: {hit.rawScore.toFixed(3)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-sm text-muted">
              {t("vault.searchEmpty", "输入问题开始检索，或点击上方快捷问题")}
            </p>
          )}
        </div>
      )}

      {/* 资产研究模式 */}
      {mode === "assets" && (
        <AssetGrid />
      )}
    </main>
  );
}

function AssetGrid() {
  const { t } = useTranslation();
  const provider = useContext(DataContext);
  const [assets, setAssets] = useState<VaultAssetsIndex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!provider) return;
    let active = true;
    provider
      .getVaultAssets()
      .then((data) => active && setAssets(data))
      .catch(() => active && setAssets(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [provider]);

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 py-16 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("vault.loading", "加载中…")}
      </div>
    );
  }

  if (!assets || assets.data.length === 0) {
    return <p className="mt-8 py-16 text-center text-sm text-muted">{t("vault.assetsEmpty", "暂无资产数据")}</p>;
  }

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {assets.data.map((asset) => (
        <Link
          key={asset.assetId}
          to={`/vault/assets/${asset.assetId}`}
          className="group rounded-lg border border-line bg-surface p-5 shadow-card transition hover:border-brand hover:shadow-cardHover"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-heading">{asset.assetName}</h3>
            <span className="font-mono text-[11px] text-muted">{asset.assetId}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{asset.description}</p>
          <dl className="mt-4 flex items-center gap-4 text-xs text-muted">
            <div>
              <dt className="text-[11px]">{t("vault.factorCount", { count: asset.factorCount ?? 0 })}</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-heading">{asset.factorCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px]">{t("vault.bullish", "看多")}</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-market-positive">{asset.bullishCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px]">{t("vault.bearish", "看空")}</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-market-negative">{asset.bearishCount ?? "—"}</dd>
            </div>
          </dl>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">
            {t("vault.assetResearch", "进入研究")}
            <ChevronRight size={13} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
