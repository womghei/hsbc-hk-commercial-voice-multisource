# 汇丰香港商业银行 · 多源社交聆听看板套件

相对 **v1 / v2（小红书单源）** 的增强版：合并 Just One 小红书实拉，并纳入官网/新闻 Web Informed、新闻媒体、知乎摘要，以及微博/论坛「示意·模拟」占位。

## 如何打开

```bash
cd /workspace/hsbc-commercial-voice-multisource
python3 -m http.server 8766
# 浏览器打开 http://127.0.0.1:8766/
```

或直接打开 `index.html` → 六角色看板。无 JS 预览：`dashboard-static-overview.html`。

## 多源 vs XHS-only（v1/v2）

| 能力 | v1/v2 小红书单源 | 本套件（multisource） |
|------|------------------|------------------------|
| 平台 | 几乎全为小红书 | 小红书 + 微博 + 知乎 + 新闻 + 官网 + 论坛 + 网页 |
| 渠道字段 | 无 | `source_channel`: ugc / news / official / forum / web |
| 可信度 | 无 | `credibility`: high / medium / low |
| Web Informed | 极少 | ≥5 条，官网/新闻允许真实 URL |
| 示意帖 | 小红书占位 | 微博/知乎/论坛明确「示意·模拟」徽章 |
| 第 1 页图 | KPI/情感/词云/主题/竞品 | + 平台分布、渠道环、N/U/O 份额、可信度、跨源热力 |
| 第 2 页过滤 | 中介/噪声/情感/分类 | + 平台 + 渠道；信息流平台胶囊 |

## 文件结构

| 路径 | 说明 |
|------|------|
| `index.html` | 多角色入口 |
| `head.html` 等 | 六套角色看板 |
| `shared/theme.css` | HSBC 商务红白灰（#DB0011） |
| `shared/data.js` | `window.HSBC_SL_DATA` 多源数据集 |
| `shared/dashboard.js` | 渲染引擎（byId + innerHTML 加固） |
| `dashboard-static-overview.html` | 管理层静态快照 |
| `tests/logic_check.js` | 逻辑校验（`node tests/logic_check.js`） |
| `scripts/build_multisource_data.js` | 从 v2 重建多源 data.js |

## 数据口径

- **Just One**：小红书实拉（保留 note id，**不编造** xiaohongshu.com/explore 假链）。
- **Web Informed**：Sprint Account / BIA、Account Fitness、IADS、Aug 2026 Commercial Tariffs、知乎竞品摘要等；新闻/官网带真实 URL。
- **示意·模拟**：微博/知乎/论坛结构占位，仅供版图演示。
- 默认隐藏中介/企服与个人户噪声；KPI 以 `kpis_clean` 汇报。

## 逻辑检查

```bash
node tests/logic_check.js
```

断言：posts > 80、必填字段、kpis_clean 与过滤帖对账、≥4 平台、web_informed ≥ 5、无假小红书 explore URL。

## 主题

对齐 business.hsbc.com.hk：主色 `#DB0011`，白/浅灰背景，红仅用于 CTA、激活页签与关键 KPI。
