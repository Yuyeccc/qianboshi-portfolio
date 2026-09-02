/**
 * P0 演示研究报告（v2：含分析层）
 *
 * 报告叙事结构（研究流，非陈列）：
 *   核心矛盾（问题定义）→ 结论摘要 → 事实基础 → 观点光谱+交叉验证
 *   → 预期差（已定价 vs 超预期变量）→ 情景推演（每情景带论证依据）
 *   → 观察清单 → 证据链 → 合规
 *
 * 结构对齐研究报告协议 v2；P1 由后端 agent.py 真实报告替换。
 */

export interface ReportFact {
  text: string;
  source: string;
  date: string;
}
export interface ReportOpinion {
  text: string;
  analyst: string;
  date: string;
  side?: "bull" | "bear" | "neutral";
}
export interface ReportScenario {
  name: string;
  condition: string;
  outcome: string;
  probability: number; // 0-1
  rationale: string; // 论证：为什么给这个概率
  invalidation: string;
}
export interface ReportEvidence {
  id: string;
  source: string;
  date: string;
  claim: string;
}
export interface DemoReport {
  /** 匹配键：输入含这些词时选中该报告 */
  matchKeywords: string[];
  goal: string;
  generatedAt: string;
  /** 核心矛盾：一句话定义研究问题 */
  coreIssue: string;
  summary: string;
  facts: ReportFact[];
  /** 观点光谱交叉验证 */
  opinions: ReportOpinion[];
  crossCheck: {
    consensus: string[];
    disagreements: string[];
  };
  /** 预期差：已定价 vs 超预期变量 */
  expectations: {
    pricedIn: string[];
    upsideVars: string[];
    downsideVars: string[];
  };
  scenarios: ReportScenario[];
  watchlist: string[];
  evidence: ReportEvidence[];
}

/* ───────────────────────── 黄金报告（内容基于真实观点库证据） ───────────────────────── */

const GOLD_REPORT: DemoReport = {
  matchKeywords: ["黄金", "金价", "贵金属", "白银"],
  goal: "黄金最近怎么看？",
  generatedAt: "2026-09-03 08:50",
  coreIssue:
    "9/2 现货黄金单日大跌超 5%——这是避险叙事的破坏，还是急涨后的正常去杠杆？当前价格与降息预期的距离，决定中期方向。",
  summary:
    "短期：大跌后多空分歧加大，动量受损但避险逻辑未破坏，技术支撑 4300 是分水岭。中期：9/17 议息与美元/实际利率仍是主变量，降息预期（约 65% 定价）未破坏。综合判断：中性偏多（0.58，5 日维度），跌破 4300 失效。",
  facts: [
    {
      text: "9/2 现货黄金单日大跌超 5%，跌破 4400 关口，创阶段最大单日跌幅；同期美股科技回调，呈流动性收缩特征而非单纯避险退潮。",
      source: "新浪 7×24 财经快讯",
      date: "2026-09-02",
    },
    {
      text: "518880 华安黄金ETF 9/2 收盘 9.118，较持仓成本 9.1895 浮亏 -0.78%（用户持仓）。",
      source: "portfolio.json / market_snapshot",
      date: "2026-09-02",
    },
    {
      text: "美联储 9/17 议息：市场定价降息 25bp 概率约 65%；美债 10Y 实际利率近一周上行约 12bp——利率是本次回调的直接推手。",
      source: "财联社电报",
      date: "2026-09-02",
    },
  ],
  opinions: [
    {
      text: "黄金盯加息、降息、美元指数；黄金股涨得过分，但回调不破心理位置就可以。短线中性偏多。",
      analyst: "钱博士直播",
      date: "2026-07-19",
      side: "bull",
    },
    {
      text: "短期涨幅已透支部分降息预期，等回调企稳信号再评估，不追高。",
      analyst: "李一恩",
      date: "2026-07-20",
      side: "bear",
    },
    {
      text: "九月多重风险（美债回购/美联储决议/中东/非农），短线关注 4475-4396 区间打破情况。",
      analyst: "指尖金汇（B站外部观点）",
      date: "2026-09-01",
      side: "neutral",
    },
  ],
  crossCheck: {
    consensus: [
      "降息方向确定，黄金中期逻辑（实际利率下行+央行购金）未被质疑",
      "短期位置偏高、需要消化，是两派共识",
    ],
    disagreements: [
      "钱博士：回调不破位即持（偏多）vs 李一恩：等企稳信号再评估（偏空）",
      "分歧本质：这次 5% 大跌是『上车窗口』还是『趋势拐点前兆』",
    ],
  },
  expectations: {
    pricedIn: [
      "9 月降息 25bp 大概率已 price-in（大跌前金价已计入）",
      "央行持续购金的慢变量已部分定价",
    ],
    upsideVars: [
      "降息 50bp / 点阵图大幅下移（超预期鸽派）",
      "中东/贸易冲突升级触发避险跳升",
    ],
    downsideVars: [
      "非农超预期强 → 降息预期回撤，实际利率继续上行",
      "跌破 4300 引发程序化止损踩踏",
    ],
  },
  scenarios: [
    {
      name: "情景 A：降息兑现 + 美元走弱",
      condition: "9/17 降息落地 + 点阵图偏鸽 + 地缘避险延续",
      outcome: "黄金重拾升势，阻力看 4600 一线；回调视为窗口。",
      probability: 0.6,
      rationale:
        "降息方向确定且购金慢变量未变，历史上『预期兑现+利率见顶』组合对金价胜率最高；60% 高于定价概率 65% 打折扣，保留流动性尾部风险。",
      invalidation: "非农超预期强 / 点阵图鹰派",
    },
    {
      name: "情景 B：利率反弹压制",
      condition: "通胀反弹、实际利率快速上行或流动性事件",
      outcome: "跌破 4300 支撑后回调加深，进入中期震荡（参考 4 月回撤形态）。",
      probability: 0.4,
      rationale:
        "本次大跌由利率驱动而非基本面，若利率不回头则动量交易者继续离场；40% 已计入此风险。",
      invalidation: "央行购金放量 / 实际利率见顶回落",
    },
  ],
  watchlist: [
    { text: "现货黄金 4300 支撑位", trigger: "跌破 → 情景 B 概率上调，观点失效" },
    { text: "美债 10Y 实际利率与美元指数", trigger: "利率再上 15bp → 警惕 B" },
    { text: "9/17 议息与非农数据", trigger: "结果落地 → 重估概率" },
    { text: "518880 是否触发 my_views 规则", trigger: "涨投 100 / 大跌约 -10% 投 500" },
  ],
  evidence: [
    {
      id: "view_20260719_drqian_gold_0142",
      source: "钱博士 7.19 直播转写 → reasoning_unit",
      date: "2026-07-19",
      claim: "黄金短线中性偏多，回调不破心理位可持（置信 0.91）",
    },
    {
      id: "view_20260720_liyien_gold_0037",
      source: "李一恩 7.20 短视频转写",
      date: "2026-07-20",
      claim: "黄金短期涨幅透支，等回调企稳，不追高",
    },
    {
      id: "news_sina_20260902_gold_crash",
      source: "新浪 7×24 快讯",
      date: "2026-09-02",
      claim: "现货黄金单日大跌超 5%，跌破 4400",
    },
  ],
};

/* ───────────────────── 地产报告（政策推演，演示数据） ───────────────────── */

const PROPERTY_REPORT: DemoReport = {
  matchKeywords: ["地产", "房地产", "楼市", "政策情景", "复盘", "推演"],
  goal: "复盘 8 月地产板块，推演 9 月政策情景",
  generatedAt: "2026-09-03 08:50",
  coreIssue:
    "8 月底政策预期升温推动板块提前反应——当前价格交易的是『预期』还是『兑现』？9 月政策力度与基本面之间的 gap 决定板块是 Beta 修复还是新一轮趋势。",
  summary:
    "复盘：8/26-8/30 地产板块 +4.2% 显著跑赢，属政策预期驱动的抢跑行情，基本面（销售）尚未跟上。推演：9 月强政策（收储扩围+限购调整）概率 0.45、温和加码 0.40、空窗 0.15。板块已计入『有政策』这一共识，赔率取决于『超预期变量』——收储规模与一线政策力度。",
  facts: [
    {
      text: "8/26-8/30 申万房地产指数累计 +4.2%，跑赢沪深 300 约 3.5pct，成交额放大至月内最高（演示口径：东财行业板块）。",
      source: "东财 push2 行业板块数据（演示）",
      date: "2026-08-30",
    },
    {
      text: "8 月底住建部/央行会议释放『稳楼市』信号，市场传闻 9 月或出台收储扩围与限购调整（未证实，待官方文件）。",
      source: "财联社电报 / 新浪 7×24（演示）",
      date: "2026-08-28",
    },
    {
      text: "8 月 30 城新房成交环比约 -3%，二手房以价换量延续——基本面尚未出现拐点证据。",
      source: "克而瑞口径（演示）",
      date: "2026-09-01",
    },
  ],
  opinions: [
    {
      text: "政策底预期升温，板块具备 Beta 修复空间，但持续性取决于收储落地规模，不宜线性外推。",
      analyst: "多家机构（演示摘要）",
      date: "2026-09-02",
      side: "bull",
    },
    {
      text: "销售与新开工未验证前，反弹是政策博弈而非基本面反转；若政策低于预期，涨幅回吐风险大。",
      analyst: "谨慎派机构（演示摘要）",
      date: "2026-09-02",
      side: "bear",
    },
    {
      text: "历史看：政策行情第一波普涨，第二波分化——受益确定性排序：收储标的 > 核心城市土储 > 产业链。",
      analyst: "卖方策略（演示摘要）",
      date: "2026-08-29",
      side: "neutral",
    },
  ],
  crossCheck: {
    consensus: [
      "『9 月必有增量政策』是市场一致预期（8 月底抢跑已反映）",
      "政策方向为托底而非刺激，无人预期强刺激",
    ],
    disagreements: [
      "政策工具组合与力度：收储大规模扩围+一线限购放开（强）vs 存量工具温和加码（弱）",
      "板块空间：Beta 修复 10-15% vs 已提前透支、利好兑现即出货",
    ],
  },
  expectations: {
    pricedIn: [
      "『9 月有政策』已 price-in：8/26-8/30 +4.2% 即为抢跑代价",
      "温和托底是底线共识，无政策冲击已被排除",
    ],
    upsideVars: [
      "收储规模显著超预期（>5000 亿）或一线限购全面放开",
      "房贷利率大幅下调（>50bp）",
    ],
    downsideVars: [
      "政策力度弱于 2024 年同期（只有表态无工具）",
      "『金九』销售数据证伪：政策落地后两周内成交不升反降",
    ],
  },
  scenarios: [
    {
      name: "情景 A：强政策落地",
      condition: "9 月收储扩围+一线限购调整+房贷利率下调组合拳",
      outcome: "板块脉冲 +15~20%，扩散至地产链（建材/家电/物业），进入趋势行情。",
      probability: 0.45,
      rationale:
        "政策空间真实存在（收储资金池未用满、一线限购仍有放松余地），且板块估值仍在近 5 年低位分位；45% 高于市场对强政策的隐含定价。",
      invalidation: "会议仅重申旧表述，无新工具",
    },
    {
      name: "情景 B：温和加码",
      condition: "存量工具加码（收储城市扩容+利率小降）",
      outcome: "冲高回落震荡，板块 +3~8%，结构性行情（收储受益标的跑赢）。",
      probability: 0.4,
      rationale:
        "与 8 月底已反应幅度（+4.2%）相当，获利盘在兑现日离场；符合『利好落地即出货』的板块惯例。",
      invalidation: "配套政策超预期出现",
    },
    {
      name: "情景 C：政策空窗",
      condition: "9 月无增量政策，仅口头表态",
      outcome: "预期落空，板块回落补跌 -5~8%，回到 8 月中旬位置。",
      probability: 0.15,
      rationale:
        "抢跑行情完全依赖预期，空窗期 beta 回吐最快；15% 对应『传闻证伪』的尾部概率。",
      invalidation: "国务院级别会议临时加开",
    },
  ],
  watchlist: [
    { text: "9 月政治局会议 / 国常会地产表述", trigger: "新工具出现 → 情景 A 概率上调" },
    { text: "收储规模公告与首批落地城市", trigger: "规模 >5000 亿 → A；仅扩容 → B" },
    { text: "30 城新房周成交（金九验证）", trigger: "政策后两周不升 → 下调评级" },
    { text: "板块量能：冲高是否放量滞涨", trigger: "放量滞涨 → 兑现信号" },
  ],
  evidence: [
    {
      id: "demo_news_cls_20260828_property",
      source: "财联社电报（演示）",
      date: "2026-08-28",
      claim: "住建部/央行会议释放稳楼市信号，市场传闻收储扩围",
    },
    {
      id: "demo_quote_bk_20260830_property",
      source: "东财 push2 行业板块（演示）",
      date: "2026-08-30",
      claim: "申万房地产 8/26-8/30 +4.2%，成交放量",
    },
    {
      id: "demo_view_institutions_20260902",
      source: "机构观点（演示摘要）",
      date: "2026-09-02",
      claim: "政策底预期升温 vs 基本面未验证，多空分歧",
    },
  ],
};

export const DEMO_REPORTS: DemoReport[] = [GOLD_REPORT, PROPERTY_REPORT];

/** 按用户输入关键词选择最匹配的演示报告（P0 占位，P1 由真实 Agent 输出替换） */
export function matchDemoReport(input: string): DemoReport {
  const norm = input.toLowerCase();
  // 全文匹配打分：命中关键词数最多者胜
  let best = GOLD_REPORT;
  let bestScore = 0;
  for (const report of DEMO_REPORTS) {
    const score = report.matchKeywords.reduce(
      (acc, kw) => acc + (norm.includes(kw.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = report;
    }
  }
  return best;
}
