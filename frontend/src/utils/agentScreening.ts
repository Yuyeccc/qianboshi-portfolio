/**
 * Agent 研究交互页 —— 输入安检规则引擎（前端快筛层）
 *
 * 职责：对用户提交的研究目标做确定性分类，输出 pass / block / clarify。
 * 设计原则（fail-closed）：
 *  - 命中强违禁模式 → block（合规红线，不给 LLM）
 *  - 命中闲聊/范围外 → block（礼貌引导回投研类目）
 *  - 有分析意图但缺实体/时间 → clarify（引导补充）
 *  - 规则无法覆盖的模糊输入 → clarify（宁可多问一次，不误放行）
 * 后端 intent_gate（LLM 分诊）在 P1 接入，本模块是 P0 的第一道闸。
 */

export type ScreeningResult =
  | { verdict: "pass"; reason: string; suggestedCategory?: string }
  | { verdict: "block"; reason: string; category?: string }
  | { verdict: "clarify"; reason: string; category?: string };

/** 强违禁模式：直接给操作指令/要求买卖仓位目标价 —— 合规红线，一律拦截 */
const HARD_BLOCK_PATTERNS: RegExp[] = [
  /(现在|可以|应该|能不能|帮我|带我|推荐|建议).{0,6}(买入|买进|买点|建仓|加仓|满仓|梭哈|抄底|上车)/,
  /(现在|可以|应该|能不能|帮我|带我|推荐|建议).{0,6}(卖出|卖点|清仓|减仓|割肉|下车|止盈)/,
  /(该|要不要|能不能|可以|帮我|建议).{0,6}(买|卖|加|减).{0,4}(多少|几成|仓位|份额|股)/,
  /目标价|止盈价|止损价设|仓位(加到|减到|多少|比例)/,
  /(买|卖|加仓|清仓).{0,8}(哪个|什么股|什么板块|哪只|哪支)/,
  /(推荐|带(我|我们)|带我).{0,8}(买|卖|股票|基金|etf)/,
  /保证.{0,6}(涨|赚|收益)|稳赚|必涨|内幕|明天(会|必|一定)/,
  /帮我(操作|下单|交易|挂单|买入|卖出)/,
];

/** 闲聊/范围外：问候、非投研话题 */
const OFFTOPIC_PATTERNS: RegExp[] = [
  /^(你好|您好|hi|hello|hey|在吗|早上好|晚上好|下午好|哈喽|嗨)[!！。~\s]*$/i,
  /(讲个笑话|写首诗|写代码|翻译一下|你是谁|你叫什么|你会什么|你能做什么)$/,
  /(今天天气|帮我(点外卖|订机票|找房子))|(游戏|追星|娱乐八卦)/,
];

/** 明确投资研究意图的指示词（配合实体判断用） */
const RESEARCH_HINTS = [
  "怎么看", "怎么样", "如何", "最近", "走势", "复盘", "推演", "情景",
  "观点", "逻辑", "驱动", "风险", "情绪", "热度", "涨停", "板块", "仓位触发",
  "触发", "规则", "盈亏", "多空", "共识", "分歧", "分析", "影响", "展望",
  "信号", "异动", "轮动", "催化",
];

/** 买卖建议的弱信号（出现在查询自身规则/持仓场景时不算违规，仅提示） */
const WEAK_ADVICE_HINTS = ["止损", "止盈", "风险", "回调", "追高", "支撑", "压力"];

/** 常见实体前缀，帮助识别"有没有具体对象" */
const ENTITY_HINTS = [
  "黄金", "白银", "铜", "铝", "原油", "地产", "房地产", "半导体", "芯片", "光模块",
  "光通信", "机器人", "创新药", "医药", "医疗", "白酒", "消费", "新能源", "锂电",
  "电池", "光伏", "储能", "军工", "券商", "银行", "保险", "煤炭", "有色", "钢铁",
  "化工", "汽车", "整车", "智能驾驶", "AI", "人工智能", "算力", "游戏", "传媒",
  "纳指", "标普", "道指", "上证", "深证", "创业板", "恒生", "港股", "美股", "A股",
  "ETF", "板块", "大盘", "指数", "美联储", "降息", "加息", "CPI", "非农", "政策",
  "会议", "财报", "业绩", "减持", "增持", "重组", "PCB", "覆铜板", "存储", "面板",
  "核电", "电力", "航运", "猪肉", "农业", "地产链", "基建", "中字头", "科技",
  "半导体设备", "先进封装", "液冷", "电源", "铜缆", "交换机", "HBM", "PCB",
];

const STRIP = /[，。！？、,.!?;；:：""''「」()（）\s]/g;

function normalize(q: string): string {
  return q.replace(STRIP, "").toLowerCase();
}

/** 提取匹配到的强违禁原文片段（用于拦截说明） */
function matchPattern(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function classifyQuestion(raw: string): ScreeningResult {
  const q = raw.trim();
  if (q.length === 0) {
    return { verdict: "clarify", reason: "empty" };
  }
  if (q.length > 500) {
    return { verdict: "block", reason: "too_long" };
  }
  const text = q.toLowerCase();
  const norm = normalize(text);

  // 1) 强违禁：合规红线
  const hard = matchPattern(text, HARD_BLOCK_PATTERNS);
  if (hard) {
    return { verdict: "block", reason: "hard_advice", category: "compliance" };
  }

  // 2) 闲聊 / 范围外
  if (OFFTOPIC_PATTERNS.some((p) => p.test(text))) {
    return { verdict: "block", reason: "offtopic" };
  }

  // 3) 明显投研意图 + 有实体 → pass
  const hasEntity = hasAny(norm, ENTITY_HINTS);
  const hasIntent = hasAny(norm, RESEARCH_HINTS);

  if (hasEntity && hasIntent) {
    return {
      verdict: "pass",
      reason: "research_ok",
      suggestedCategory: suggestCategory(norm),
    };
  }

  // 4) 弱信号（含止损止盈等词，但无操作指令）→ 放行给 Agent 做查询/提示
  if (hasAny(norm, WEAK_ADVICE_HINTS) && hasEntity) {
    return { verdict: "pass", reason: "research_weak", suggestedCategory: "position" };
  }

  // 5) 有实体但意图不清 → clarify
  if (hasEntity) {
    return { verdict: "clarify", reason: "no_intent", category: suggestCategory(norm) };
  }

  // 6) 有意图但无实体 → clarify
  if (hasIntent) {
    return { verdict: "clarify", reason: "no_entity" };
  }

  // 7) 兜底：无法识别 → clarify（fail-closed，不误放行）
  return { verdict: "clarify", reason: "unrecognized" };
}

/** 根据关键词粗略建议问题类目（供引导/打标用） */
export function suggestCategory(norm: string): string | undefined {
  if (/(涨停|连板|情绪|热度|最热|龙虎榜|题材|异动)/.test(norm)) return "heat";
  if (/(复盘|推演|情景|政策|会议|降息|加息|如果|落地)/.test(norm)) return "scenario";
  if (/(持仓|盈亏|触发|规则|止损|止盈|我的)/.test(norm)) return "position";
  if (/(钱博士|李一恩|旗帜|任泽平|柏年|天哥|分析师|观点|直播|最新)/.test(norm))
    return "views";
  return "sector";
}
