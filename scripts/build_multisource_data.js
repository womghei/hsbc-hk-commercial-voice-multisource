#!/usr/bin/env node
/**
 * Build enhanced multi-source data.js from v2 小红书样本 XHS posts + web-informed + placeholders.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = '/workspace/hsbc-commercial-social-listening/v2/shared/data.js';

global.window = {};
eval(fs.readFileSync(SRC, 'utf8'));
const d = JSON.parse(JSON.stringify(window.HSBC_SL_DATA));

const PLATFORMS = ['小红书', '微博', '知乎', '新闻媒体', '官网/新闻稿', '论坛/社区', '网页其他'];
const CHANNELS = { '小红书': 'ugc', '微博': 'ugc', '知乎': 'ugc', '新闻媒体': 'news', '官网/新闻稿': 'official', '论坛/社区': 'forum', '网页其他': 'web' };

function credibilityFor(p) {
  if (p.source_channel === 'official' || p.platform === '官网/新闻稿') return 'high';
  if (p.source_channel === 'news' || p.platform === '新闻媒体') return 'high';
  if (p.is_intermediary || p.is_personal_noise) return 'low';
  if (p.source_status === 'web_informed' && (p.source_channel === 'official' || p.source_channel === 'news')) return 'high';
  if (p.source_status === 'xhs_sample_api') return 'medium';
  if (p.is_placeholder || p.source_status === 'placeholder') return 'low';
  if (p.source_channel === 'forum') return 'medium';
  if (p.source_channel === 'web') return 'medium';
  return 'medium';
}

d.posts.forEach((p) => {
  if (!p.platform || p.platform === '其他来源') {
    if (p.source_status === 'web_informed') p.platform = '网页其他';
    else p.platform = '小红书';
  }
  if (!PLATFORMS.includes(p.platform)) p.platform = '网页其他';
  p.source_channel = p.source_channel || CHANNELS[p.platform] || 'web';
  p.credibility = credibilityFor(p);
  p.is_intermediary = !!p.is_intermediary;
  p.is_personal_noise = !!p.is_personal_noise;
  p.is_placeholder = !!p.is_placeholder;
  if (!p.author_type) p.author_type = '不确定';
  if (!p.sentiment) p.sentiment = '中性';
  if (!p.category) p.category = '开户体验';
  if (p.url && /xiaohongshu\.com\/(explore|discovery)/i.test(p.url)) delete p.url;
  if (p.url && /xiaohongshu\.com/i.test(p.url) && /fake|placeholder|xxxx|000000/i.test(p.url)) delete p.url;
});

const webInformed = [
  {
    id: 'web-informed-sprint-bia',
    title: '官网：HSBC Sprint Account / Business Integrated Account',
    summary: '汇丰官网产品页介绍 Sprint Account（商业综合户口之一）：面向本地初创，线上申请最快约 3 个工作日；首 12 个月月费豁免，其后视 TRB 是否达 HK$50,000。商业监听可据此对照客户对「开户时效/费用门槛」的预期落差。',
    sentiment: '中性',
    themes: ['开户体验', '费用门槛', '数字银行'],
    category: '开户体验',
    author_type: '官方',
    platform: '官网/新闻稿',
    source_channel: 'official',
    source_status: 'web_informed',
    source_label: 'Web Informed·官网',
    published_at: '2026-08-15',
    url: 'https://www.business.hsbc.com.hk/en-gb/products/hsbc-sprint-account',
    related_urls: [
      'https://www.business.hsbc.com.hk/en-gb/products/business-integrated-account',
      'https://www.business.hsbc.com.hk/en-gb/products/bia-propositions'
    ],
    competitors: ['汇丰'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-account-fitness',
    title: '新闻稿：SME Account Fitness 教育系列上线',
    summary: '汇丰推出「户口健康管理 / Account Fitness」教育系列与数字指南，覆盖正确用户、支付管理、记录保存与银行沟通等习惯；并在中小企中心设立 Account Fitness Trainer。有助对冲「户口被限制/材料不清」负面叙事。',
    sentiment: '正面',
    themes: ['数字银行', '开户体验', '客户经理'],
    category: '数字银行',
    author_type: '官方',
    platform: '官网/新闻稿',
    source_channel: 'official',
    source_status: 'web_informed',
    source_label: 'Web Informed·新闻稿',
    published_at: '2025-07-01',
    url: 'https://www.about.hsbc.com.hk/news-and-media/hsbc-introduces-new-education-series-to-empower-smes-with-essential-knowledge',
    related_urls: [
      'https://www.business.hsbc.com.hk/en-gb/campaigns/account-fitness',
      'https://www.about.hsbc.com.hk/zh-hk/news-and-media/hsbc-introduces-new-education-series-to-empower-smes-with-essential-knowledge'
    ],
    competitors: ['汇丰'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-iads',
    title: '官网/新闻：IADS 跨行账户统一视图上线中小企',
    summary: '在 HKMA IADS 框架下，汇丰企业网银可经客户授权连接参与行（如恒生、中银香港、渣打）存款账户，查看实时结余与近 60 日交易并导出 CSV。强化「数字渠道便利」正面叙事，适合 CTO/数字条线跟踪采用率讨论。',
    sentiment: '正面',
    themes: ['数字银行', '竞品对比'],
    category: '数字银行',
    author_type: '官方',
    platform: '官网/新闻稿',
    source_channel: 'official',
    source_status: 'web_informed',
    source_label: 'Web Informed·官网',
    published_at: '2025-11-20',
    url: 'https://www.business.hsbc.com.hk/en-gb/products/iads',
    related_urls: [
      'https://www.about.hsbc.com.hk/news-and-media/hsbc-launches-consolidated-account-view-for-smes',
      'https://www.businessgo.hsbc.com/en/article/openbanking-en'
    ],
    competitors: ['汇丰', '恒生', '中银香港', '渣打'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-tariff-aug2026',
    title: '官网：2026年8月生效商业收费简介（Complete Tariffs）',
    summary: '汇丰工商金融公布 Aug 2026 Issue 完整收费简介（含中文 PDF），覆盖户口方案、一般服务、付款、贸易、商业卡等。社交讨论中「月费/TRB 门槛/柜面费」主题可与此官方口径交叉验证，避免把营销解读当成资费事实。',
    sentiment: '中性',
    themes: ['费用门槛'],
    category: '费用门槛',
    author_type: '官方',
    platform: '官网/新闻稿',
    source_channel: 'official',
    source_status: 'web_informed',
    source_label: 'Web Informed·资费',
    published_at: '2026-08-01',
    url: 'https://www.business.hsbc.com.hk/en-gb/regulations/commercial-tariffs',
    related_urls: [
      'https://www.business.hsbc.com.hk/-/media/media/hong-kong/pdfs/regulations/complete-tariffs-aug-2026-chi.pdf',
      'https://www.business.hsbc.com.hk/zh-hk/regulations/commercial-tariffs'
    ],
    competitors: ['汇丰'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-zhihu-compare',
    title: '知乎风格归纳：香港公司户选汇丰/渣打/中银/东亚对比（摘要）',
    summary: '公开专栏常见叙事：汇丰适合有海外业务与贸易材料者、审核偏严；中银亚洲偏中资跨境往来；渣打对实际办公地址要求较高；东亚/大新对新公司/无关联公司更友好。此条为 Web Informed 摘要，引用真实专栏 URL，非平台 API 公开样本。',
    sentiment: '中性',
    themes: ['竞品对比', '开户体验'],
    category: '竞品对比',
    author_type: '不确定',
    platform: '知乎',
    source_channel: 'ugc',
    source_status: 'web_informed',
    source_label: 'Web Informed·知乎摘要',
    published_at: '2025-12-10',
    url: 'https://zhuanlan.zhihu.com/p/1954541887538046140',
    related_urls: [
      'https://zhuanlan.zhihu.com/p/1966877061084845685',
      'https://zhuanlan.zhihu.com/p/1951309331233474302'
    ],
    competitors: ['汇丰', '渣打', '中银香港', '恒生'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-paypers-iads',
    title: '行业媒体：HSBC rolls out consolidated account view for SMEs',
    summary: 'The Paypers 报道汇丰为企业客户推出跨行账户统一视图（IADS），并提及与 CCRA/商业数据互通等中小企信贷相关能力。可作为「新闻媒体」高可信度补充样本。',
    sentiment: '正面',
    themes: ['数字银行'],
    category: '数字银行',
    author_type: '媒体',
    platform: '新闻媒体',
    source_channel: 'news',
    source_status: 'web_informed',
    source_label: 'Web Informed·新闻',
    published_at: '2025-11-21',
    url: 'https://thepaypers.com/fintech/news/hsbc-rolls-out-consolidated-account-view-capability-for-smes',
    competitors: ['汇丰'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  },
  {
    id: 'web-informed-bizgo-fitness',
    title: 'Business Go：Account Fitness 四大习惯文章',
    summary: 'HSBC Business Go 文章归纳中小企户口健康四大起步习惯，并链回 Account Fitness 活动页。官方内容侧「教育/防风险」叙事，与 UGC 开户吐槽形成对照。',
    sentiment: '正面',
    themes: ['数字银行', '开户体验'],
    category: '数字银行',
    author_type: '官方',
    platform: '官网/新闻稿',
    source_channel: 'official',
    source_status: 'web_informed',
    source_label: 'Web Informed·官网内容',
    published_at: '2026-01-15',
    url: 'https://www.businessgo.hsbc.com/en/article/account-fitness-overarching-2026-en',
    related_urls: [
      'https://www.business.hsbc.com.hk/en-gb/insights/managing-risk/business-account-fitness-series-tip-1-set-clear-boundaries-for-your-business-account-usage'
    ],
    competitors: ['汇丰'],
    segment: 'SME/Mid',
    commercial_related: true,
    is_intermediary: false,
    is_personal_noise: false,
    is_placeholder: false
  }
];

webInformed.forEach((p) => {
  p.note_id = p.id;
  p.engagement = p.engagement || { likes: 0, comments: 0, collects: 0 };
  p.search_keyword = p.search_keyword || 'HSBC commercial HK';
  p.credibility = credibilityFor(p);
});

const placeholders = [
  { id: 'sim-weibo-001', platform: '微博', source_channel: 'ugc', title: '【示意·模拟】创业群吐槽：商业户预约排到两周后', summary: '模拟微博讨论：中小企主反馈汇丰商业开户预约紧张，补件通知不及时。示意数据，非公开样本。', sentiment: '负面', category: '开户体验', themes: ['开户体验', '审批时效'], author_type: '真实客户', segment: 'SME/Mid', competitors: ['汇丰'] },
  { id: 'sim-weibo-002', platform: '微博', source_channel: 'ugc', title: '【示意·模拟】汇丰 Sprint 线上开户体验分享', summary: '模拟微博：用户称线上提交材料后约一周收到账户号，月费豁免期清楚。示意·模拟。', sentiment: '正面', category: '开户体验', themes: ['开户体验', '数字银行'], author_type: '真实客户', segment: 'SME/Mid', competitors: ['汇丰'] },
  { id: 'sim-weibo-003', platform: '微博', source_channel: 'ugc', title: '【示意·模拟】有人在问商业户 TRB 月费怎么算', summary: '模拟微博问答：讨论过去三个月平均 TRB 与月费豁免门槛。示意·模拟。', sentiment: '中性', category: '费用门槛', themes: ['费用门槛'], author_type: '真实客户', segment: 'SME/Mid', competitors: ['汇丰'] },
  { id: 'sim-zhihu-001', platform: '知乎', source_channel: 'ugc', title: '【示意·模拟】答主整理：中小企商业户开户材料清单对比', summary: '模拟知乎回答结构：汇丰 vs 渣打 vs 中银材料差异与见证方式。示意·模拟，非 API 公开样本。', sentiment: '中性', category: '竞品对比', themes: ['竞品对比', '开户体验'], author_type: '不确定', segment: 'SME/Mid', competitors: ['汇丰', '渣打', '中银香港'] },
  { id: 'sim-zhihu-002', platform: '知乎', source_channel: 'ugc', title: '【示意·模拟】企业网银双人授权值不值得开', summary: '模拟知乎讨论：安全感 vs 操作成本，提及 Business Express / HSBCnet。示意·模拟。', sentiment: '中性', category: '数字银行', themes: ['数字银行'], author_type: '真实客户', segment: 'Large', competitors: ['汇丰'] },
  { id: 'sim-zhihu-003', platform: '知乎', source_channel: 'ugc', title: '【示意·模拟】客户经理换人后跨境收款跟进断层', summary: '模拟知乎吐槽：换 RM 后外汇到账查询无人接手。示意·模拟。', sentiment: '负面', category: '客户经理', themes: ['客户经理', '贸易融资外汇'], author_type: '真实客户', segment: 'Large', competitors: ['汇丰'] },
  { id: 'sim-forum-001', platform: '论坛/社区', source_channel: 'forum', title: '【示意·模拟】V2EX 风格：香港公司户选哪家银行？', summary: '模拟论坛帖：程序员创业选银行，对比虚拟银行速度与传统行跨境能力。示意·模拟。', sentiment: '中性', category: '竞品对比', themes: ['竞品对比', '费用门槛'], author_type: '真实客户', segment: 'SME/Mid', competitors: ['汇丰', '虚拟银行', '渣打'] },
  { id: 'sim-forum-002', platform: '论坛/社区', source_channel: 'forum', title: '【示意·模拟】论坛：贸易融资额度审批慢于预期', summary: '模拟社区讨论：LC/保函时效与客户经理响应。示意·模拟。', sentiment: '负面', category: '贸易融资外汇', themes: ['贸易融资外汇'], author_type: '真实客户', segment: 'Large', competitors: ['汇丰'] },
  { id: 'sim-forum-003', platform: '论坛/社区', source_channel: 'forum', title: '【示意·模拟】有人推荐 Account Fitness 指南给新开户老板', summary: '模拟论坛：分享官方户口健康习惯，减少公私混用导致的户口风险。示意·模拟。', sentiment: '正面', category: '数字银行', themes: ['数字银行', '开户体验'], author_type: '真实客户', segment: 'SME/Mid', competitors: ['汇丰'] },
  { id: 'sim-news-001', platform: '新闻媒体', source_channel: 'news', title: '【示意·模拟】本地财经：银行竞逐中小企数字化开户', summary: '模拟新闻摘要：传统行与虚拟银行在 SME 开户便利度上的竞争升温。示意·模拟。', sentiment: '中性', category: '竞品对比', themes: ['竞品对比', '数字银行'], author_type: '媒体', segment: 'SME/Mid', competitors: ['汇丰', '虚拟银行', '中银香港'] },
  { id: 'sim-web-001', platform: '网页其他', source_channel: 'web', title: '【示意·模拟】企服博客转载：商业综合户口三种命题对比', summary: '模拟网页转载 Sprint / Business Direct / BusinessVantage 差异表。示意·模拟；正式口径请以官网为准。', sentiment: '中性', category: '开户体验', themes: ['开户体验', '费用门槛'], author_type: '企服推广', segment: 'SME/Mid', competitors: ['汇丰'], is_intermediary: true }
];

placeholders.forEach((p, i) => {
  p.note_id = p.id;
  p.engagement = { likes: 10 + i * 3, comments: 2 + i, collects: 5 + i };
  p.commercial_related = !p.is_intermediary;
  p.source_status = 'placeholder';
  p.source_label = '示意·模拟·' + p.platform;
  p.published_at = '2026-08-' + String(10 + (i % 18)).padStart(2, '0');
  p.is_intermediary = !!p.is_intermediary;
  p.is_personal_noise = !!p.is_personal_noise;
  p.is_placeholder = true;
  p.demo_badge = '示意·模拟';
  p.credibility = credibilityFor(p);
  p.search_keyword = '示意模拟';
});

const existingIds = new Set(d.posts.map((p) => p.id));
[...webInformed, ...placeholders].forEach((p) => {
  if (!existingIds.has(p.id)) {
    d.posts.push(p);
    existingIds.add(p.id);
  }
});

d.posts.forEach((p) => {
  p.source_channel = p.source_channel || CHANNELS[p.platform] || 'web';
  p.credibility = p.credibility || credibilityFor(p);
  if (!p.platform) p.platform = '网页其他';
  if (!p.sentiment) p.sentiment = '中性';
  if (!p.category) p.category = '开户体验';
  if (!p.author_type) p.author_type = '不确定';
});

function pct(n, t) { return t ? Math.round((n / t) * 1000) / 10 : 0; }
const all = d.posts;
const clean = all.filter((p) => !p.is_intermediary && !p.is_personal_noise);
function sentimentCounts(arr) {
  const s = { '正面': 0, '负面': 0, '中性': 0 };
  arr.forEach((p) => { s[p.sentiment] = (s[p.sentiment] || 0) + 1; });
  return s;
}
const sentClean = sentimentCounts(clean);
const sentAll = sentimentCounts(all);
const tClean = clean.length;
const tAll = all.length;
const xhs_sample = all.filter((p) => p.source_status === 'xhs_sample_api').length;
const ph = all.filter((p) => p.is_placeholder || p.source_status === 'placeholder').length;
const webInf = all.filter((p) => p.source_status === 'web_informed').length;
const intC = all.filter((p) => p.is_intermediary).length;
const persC = all.filter((p) => p.is_personal_noise).length;

d.kpis_all = {
  total_posts: tAll,
  positive_pct: pct(sentAll['正面'], tAll),
  negative_pct: pct(sentAll['负面'], tAll),
  neutral_pct: pct(sentAll['中性'], tAll),
  commercial_related_pct: pct(all.filter((p) => p.commercial_related).length, tAll),
  intermediary_count: intC,
  personal_noise_count: persC,
  xhs_sample_count: xhs_sample,
  placeholder_count: ph,
  web_informed_count: webInf
};
d.kpis_clean = {
  total_posts: tClean,
  positive_pct: pct(sentClean['正面'], tClean),
  negative_pct: pct(sentClean['负面'], tClean),
  neutral_pct: pct(sentClean['中性'], tClean),
  commercial_related_pct: pct(clean.filter((p) => p.commercial_related).length, tClean),
  xhs_sample_count: xhs_sample,
  placeholder_count: ph,
  intermediary_count: intC,
  personal_noise_count: persC,
  web_informed_count: webInf,
  hot_theme_count: 8,
  net_sentiment: Math.round((pct(sentClean['正面'], tClean) - pct(sentClean['负面'], tClean)) * 10) / 10,
  platform_count: new Set(all.map((p) => p.platform)).size
};
d.kpis = Object.assign({}, d.kpis_clean);
d.sentiment = sentClean;
d.sentiment_all = sentAll;

const platCounts = {};
all.forEach((p) => { platCounts[p.platform] = (platCounts[p.platform] || 0) + 1; });
d.platforms = PLATFORMS.filter((n) => platCounts[n]).map((n) => ({
  name: n, count: platCounts[n], pct: pct(platCounts[n], tAll), primary: n === '小红书', channel: CHANNELS[n]
}));

const chCounts = {};
all.forEach((p) => { chCounts[p.source_channel] = (chCounts[p.source_channel] || 0) + 1; });
d.source_channel_mix = Object.keys(chCounts).map((k) => ({
  name: k,
  label: ({ ugc: 'UGC', news: '新闻', official: '官方', forum: '论坛', web: '网页' })[k] || k,
  count: chCounts[k],
  pct: pct(chCounts[k], tAll)
})).sort((a, b) => b.count - a.count);

d.news_ugc_official = {
  news: chCounts.news || 0,
  ugc: chCounts.ugc || 0,
  official: chCounts.official || 0,
  forum: chCounts.forum || 0,
  web: chCounts.web || 0
};

const credCounts = { high: 0, medium: 0, low: 0 };
all.forEach((p) => { credCounts[p.credibility] = (credCounts[p.credibility] || 0) + 1; });
d.credibility_mix = [
  { name: 'high', label: '高可信', count: credCounts.high, pct: pct(credCounts.high, tAll) },
  { name: 'medium', label: '中可信', count: credCounts.medium, pct: pct(credCounts.medium, tAll) },
  { name: 'low', label: '低可信', count: credCounts.low, pct: pct(credCounts.low, tAll) }
];

const themeMap = {};
clean.forEach((p) => {
  const cat = p.category || '其他';
  if (!themeMap[cat]) themeMap[cat] = { name: cat, count: 0, pos: 0, neg: 0 };
  themeMap[cat].count++;
  if (p.sentiment === '正面') themeMap[cat].pos++;
  if (p.sentiment === '负面') themeMap[cat].neg++;
});
d.themes = Object.values(themeMap).sort((a, b) => b.count - a.count).map((t) => {
  let lean = 'neutral';
  if (t.neg > t.pos && t.neg > 0) lean = 'negative';
  else if (t.pos > t.neg && t.pos > 0) lean = 'positive';
  else if (t.pos > 0 && t.neg > 0) lean = 'mixed';
  return { name: t.name, count: t.count, sentiment_lean: lean };
});

const cross = {};
const themeNames = d.themes.map((t) => t.name);
const platNames = d.platforms.map((p) => p.name);
clean.forEach((p) => {
  const th = p.category || '其他';
  const pl = p.platform;
  if (!cross[th]) cross[th] = {};
  cross[th][pl] = (cross[th][pl] || 0) + 1;
});
d.cross_source_themes = {
  themes: themeNames,
  platforms: platNames,
  matrix: themeNames.map((th) => platNames.map((pl) => (cross[th] && cross[th][pl]) || 0))
};

d.voice_mix = {
  '真实商业相关': clean.filter((p) => p.commercial_related).length,
  '中介/企服': intC,
  '个人户噪声': persC
};

const segMap = {};
clean.forEach((p) => {
  let n = p.segment || '未标注';
  if (n === 'SME/Mid' || n === 'SME') n = '中型企业 / Mid';
  else if (n === 'Large') n = '大型企业 / Large';
  else n = '未标注';
  segMap[n] = (segMap[n] || 0) + 1;
});
d.segment_mix = Object.keys(segMap).map((n) => ({ name: n, count: segMap[n] })).sort((a, b) => b.count - a.count);

d.meta = Object.assign({}, d.meta, {
  title: '汇丰银行香港 · 商业银行多源客户声音监听',
  subtitle: '多源：小红书 小红书样本 + 官网/新闻 Web Informed + 微博/知乎/论坛示意',
  updated_at: '2026-09-16T19:50:00+08:00',
  updated_at_display: '2026-09-16 19:50 HKT',
  focus_platform: '多源（小红书为主）',
  version: 'multisource-v1',
  suite_title: '汇丰香港商业银行 · 多源社交聆听看板套件',
  disclaimer: '含 小红书公开内容检索 小红书公开样本样本、官网/新闻 Web Informed（真实 URL）、以及微博/知乎/论坛「示意·模拟」占位。第三方 API 非官方授权。请人工核对中介噪声。',
  data_gap_note: '消费社交平台上商业银行声量仍偏薄；官网与新闻稿可补齐产品/资费事实；微博/知乎/论坛条目多为示意结构，正式上线需替换为合规采集。',
  multi_source: true
});

d.filter_defaults = Object.assign({}, d.filter_defaults, { platform: '', source_channel: '' });

d.management_summary = Object.assign({}, d.management_summary, {
  executive_brief: '多源样本显示：小红书 UGC 仍主导开户痛点叙事（材料/预约/时效），而官网 Sprint/BIA、Account Fitness、IADS 与 Aug 2026 资费页提供可核对的产品事实；新闻与知乎竞品对比补充「门槛劝退 vs 数字化便利」双线。默认过滤中介与个人户噪声后，KPI 以清洗口径汇报；示意·模拟帖仅用于结构演示。'
});

if (d.personas && d.personas.head && d.personas.head.insights) {
  d.personas.head.insights = [
    '多源口径：UGC 痛点（开户/费用）与官网/新闻事实（Sprint、资费、IADS）需对照解读，避免只看小红书偏差。',
    ...d.personas.head.insights.slice(0, 5)
  ];
  d.personas.head.one_liner = '多源样本：开户透明度与客户经理连续性仍是核心声誉风险；官网 Sprint/IADS/资费可对冲 UGC 偏差，竞品对比活跃。';
}
if (d.personas && d.personas.cmo) {
  d.personas.cmo.one_liner = (d.personas.cmo.one_liner || '品牌声量与内容主题监测。') + ' 已纳入多源平台×渠道结构。';
}

d.insights_default = [
  '多源监听：小红书 UGC 仍是痛点主战场；官网/新闻提供高可信产品与资费事实；微博/知乎/论坛当前以示意结构补齐版图。',
  '开户与文件门槛是商业相关帖的高频痛点：预约难、材料清单不清、审批周期长被反复提及。',
  '客户经理响应质量分化明显——服务连续性是潜在声誉风险点。',
  'IADS 统一视图与 Account Fitness 教育系列可转化为数字条线与品牌内容的正向叙事。',
  '声音质量：中介/企服推广帖需默认过滤；KPI 以清洗后口径作为管理层汇报基准。'
];

const out = '/* HSBC Commercial Voice — multi-source dataset */\n' +
  '/* Built from v2 小红书样本 XHS + web_informed (real URLs) + 示意·模拟 placeholders */\n' +
  'window.HSBC_SL_DATA = ' + JSON.stringify(d, null, 2) + ';\n';
fs.writeFileSync(path.join(ROOT, 'shared', 'data.js'), out);
console.log('Wrote data.js posts', tAll, 'clean', tClean);
console.log('platforms', platCounts);
console.log('channels', chCounts);
console.log('credibility', credCounts);
console.log('web_informed', webInf);
