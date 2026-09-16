/* HSBC Commercial Voice — multi-source dashboard engine */
(function () {
  'use strict';

  var DATA = window.HSBC_SL_DATA;
  if (!DATA) {
    console.error('HSBC_SL_DATA missing');
    return;
  }

  var personaId = (document.body && document.body.getAttribute('data-persona')) || 'head';
  var persona = (DATA.personas && (DATA.personas[personaId] || DATA.personas.head)) || {};
  var chartInstances = [];
  var ChartOK = typeof window.Chart !== 'undefined';

  var CHANNEL_LABEL = { ugc: 'UGC', news: '新闻', official: '官方', forum: '论坛', web: '网页' };
  var PLATFORM_CLASS = {
    '小红书': 'plat-xhs', '微博': 'plat-weibo', '知乎': 'plat-zhihu',
    '新闻媒体': 'plat-news', '官网/新闻稿': 'plat-official',
    '论坛/社区': 'plat-forum', '网页其他': 'plat-web'
  };

  /* ---------- utils ---------- */
  function byId(id) {
    if (!id) return null;
    try { return document.getElementById(id); } catch (e) { return null; }
  }
  function $(sel, root) {
    if (!sel) return null;
    if (!root && sel.charAt(0) === '#' && sel.indexOf(' ') < 0 && sel.indexOf('.') < 0 && sel.indexOf('[') < 0) {
      return byId(sel.slice(1));
    }
    try { return (root || document).querySelector(sel); } catch (e) { return null; }
  }
  function $$(sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function setHTML(node, html) {
    if (!node || !('innerHTML' in node)) return false;
    node.innerHTML = html == null ? '' : html;
    return true;
  }
  function setText(node, text) {
    if (!node || !('textContent' in node)) return false;
    node.textContent = text == null ? '' : String(text);
    return true;
  }
  function safe(name, fn) {
    try { fn(); }
    catch (e) { console.error('[dashboard] ' + name + ' failed', e); }
  }
  function leanClass(lean) {
    var map = { negative: 'neg', positive: 'pos', mixed: 'mixed', neutral: 'neutral', neg: 'neg', pos: 'pos' };
    return map[lean] || 'neutral';
  }

  function filterPosts(opts) {
    opts = opts || {};
    var hideInt = !!opts.hideIntermediaries;
    var hidePers = !!opts.hidePersonalNoise;
    var sent = opts.sentiment || '';
    var cat = opts.category || '';
    var plat = opts.platform || '';
    var ch = opts.source_channel || '';
    var q = (opts.q || '').trim().toLowerCase();
    var posts = DATA.posts || [];
    return posts.filter(function (p) {
      if (hideInt && p.is_intermediary) return false;
      if (hidePers && p.is_personal_noise) return false;
      if (sent && p.sentiment !== sent) return false;
      if (cat && p.category !== cat) return false;
      if (plat && p.platform !== plat) return false;
      if (ch && p.source_channel !== ch) return false;
      if (q) {
        var hay = ((p.title || '') + ' ' + (p.summary || '') + ' ' + (p.author_nickname || '') + ' ' + (p.platform || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function initTabs() {
    $$('.page-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-page');
        $$('.page-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        $$('.page').forEach(function (p) { p.classList.toggle('active', p.id === id); });
      });
    });
  }

  function renderHeader() {
    var meta = DATA.meta || {};
    setText(byId('personaTitle'), persona.title || '');
    setText(byId('personaAudience'), persona.audience || '');
    var upd = byId('updatedAt');
    if (upd) setText(upd, '更新 ' + (meta.updated_at_display || ''));
    $$('.persona-nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === personaId);
    });
  }

  var KPI_DEFS = [
    { key: 'total_posts', label: '可见帖数', hint: '噪声过滤后', fmt: function (v) { return v; } },
    { key: 'positive_pct', label: '正面占比', hint: '情感正向', cls: 'pos', fmt: function (v) { return v + '%'; } },
    { key: 'negative_pct', label: '负面占比', hint: '情感负向', cls: 'neg', fmt: function (v) { return v + '%'; } },
    { key: 'neutral_pct', label: '中性占比', hint: '情感中性', cls: 'neu', fmt: function (v) { return v + '%'; } },
    { key: 'net_sentiment', label: '净情感', hint: '正面−负面 pp', fmt: function (v) { return (v > 0 ? '+' : '') + v + 'pp'; } },
    { key: 'commercial_related_pct', label: '商业相关', hint: '可见样本内', fmt: function (v) { return v + '%'; } },
    { key: 'intermediary_count', label: '中介/企服', hint: '全量样本', fmt: function (v) { return v; } },
    { key: 'justone_count', label: 'Just One 实拉', hint: '小红书 API', fmt: function (v) { return v; } },
    { key: 'web_informed_count', label: 'Web Informed', hint: '官网/新闻等', fmt: function (v) { return v; } },
    { key: 'placeholder_count', label: '示意·模拟', hint: '占位补齐', fmt: function (v) { return v; } },
    { key: 'platform_count', label: '平台数', hint: '多源覆盖', fmt: function (v) { return v; } },
    { key: 'hot_theme_count', label: '热点主题', hint: '主题条数目', fmt: function (v) { return v; } }
  ];

  function renderKPIs() {
    var box = byId('kpiStrip');
    if (!box) return;
    var kpis = DATA.kpis_clean || DATA.kpis || {};
    var hi = persona.kpi_highlight || [];
    var cards = [];
    KPI_DEFS.forEach(function (def) {
      var v = kpis[def.key];
      if (v == null && def.key === 'net_sentiment') v = 0;
      if (v == null) return;
      if ((def.key === 'placeholder_count' || def.key === 'hot_theme_count' || def.key === 'platform_count') && hi.indexOf(def.key) < 0 && def.key !== 'web_informed_count' && def.key !== 'platform_count') {
        if (def.key === 'placeholder_count' || def.key === 'hot_theme_count') return;
      }
      cards.push(
        '<div class="kpi' + (def.cls ? ' ' + def.cls : '') + (hi.indexOf(def.key) >= 0 ? ' highlight' : '') + '">' +
          '<div class="k-label">' + esc(def.label) + '</div>' +
          '<div class="k-value">' + esc(String(def.fmt(v))) + '</div>' +
          '<div class="k-hint">' + esc(def.hint) + '</div>' +
        '</div>'
      );
    });
    setHTML(box, cards.join(''));
  }

  function renderSentiment() {
    var s = DATA.sentiment || {};
    var total = (s['正面'] || 0) + (s['负面'] || 0) + (s['中性'] || 0);
    var canvas = byId('sentimentDonut');
    var host = canvas && canvas.parentNode;
    if (host && 'innerHTML' in host) {
      setHTML(host, fallbackDonut(s, total) + '<canvas id="sentimentDonut" class="hidden"></canvas>');
    }
    var hiddenCanvas = byId('sentimentDonut');
    if (hiddenCanvas && hiddenCanvas.classList) hiddenCanvas.classList.add('hidden');

    var leg = byId('sentimentLegend');
    if (leg) {
      setHTML(leg,
        '<span class="l-pos">正面 ' + (s['正面'] || 0) + '</span>' +
        '<span class="l-neg">负面 ' + (s['负面'] || 0) + '</span>' +
        '<span class="l-neu">中性 ' + (s['中性'] || 0) + '</span>'
      );
    }

    var trend = DATA.sentiment_trend;
    var spark = byId('sentimentSpark');
    if (spark && ChartOK && trend) {
      try {
        chartInstances.push(new Chart(spark.getContext('2d'), {
          type: 'line',
          data: {
            labels: trend.labels,
            datasets: [
              { label: '正面%', data: trend.positive, borderColor: '#0a7a3e', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 },
              { label: '负面%', data: trend.negative, borderColor: '#DB0011', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } } },
            scales: {
              x: { ticks: { font: { size: 9 } }, grid: { display: false } },
              y: { ticks: { font: { size: 9 } }, min: 0, suggestedMax: 30, grid: { color: '#f0f0f0' } }
            }
          }
        }));
      } catch (err) {
        console.warn('[dashboard] Chart.js sparkline failed', err);
        sparkTextFallback(spark, trend);
      }
    } else if (spark && trend) {
      sparkTextFallback(spark, trend);
    }
  }

  function sparkTextFallback(spark, trend) {
    var host = spark && spark.parentNode;
    if (host && 'innerHTML' in host) {
      setHTML(host, '<p class="card-muted">周趋势（示意）：正面 ' + (trend.positive || []).join('/') + ' · 负面 ' + (trend.negative || []).join('/') + '</p>');
    }
  }

  function fallbackDonut(s, total) {
    var p = total ? Math.round(((s['正面'] || 0) / total) * 100) : 0;
    var n = total ? Math.round(((s['负面'] || 0) / total) * 100) : 0;
    var u = Math.max(0, 100 - p - n);
    return '<div class="css-donut-wrap" style="display:flex;align-items:center;justify-content:center;height:200px;gap:16px;font-size:0.85rem;">' +
      '<div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(#0a7a3e 0 ' + p + '%,#DB0011 ' + p + '% ' + (p + n) + '%,#bbb ' + (p + n) + '% 100%);position:relative;">' +
      '<div style="position:absolute;inset:28px;background:#fff;border-radius:50%;"></div></div>' +
      '<div style="line-height:1.7"><div><strong>正</strong> ' + p + '%</div><div><strong>负</strong> ' + n + '%</div><div><strong>中</strong> ' + u + '%</div></div></div>';
  }

  function renderWordCloud() {
    var box = byId('wordCloud');
    if (!box) return;
    var words = (DATA.word_cloud || []).slice(0, 36);
    if (!words.length) { setText(box, '暂无词云'); return; }
    var maxW = words[0].weight || 1;
    var minW = words[words.length - 1].weight || 1;
    var parts = [];
    words.forEach(function (w, i) {
      var t = (w.weight - minW) / (maxW - minW || 1);
      var size = 11 + Math.round(t * 22);
      var colors = ['#1e1e1e', '#333', '#DB0011', '#666', '#444', '#b4000e'];
      var color = i < 3 ? '#DB0011' : colors[i % colors.length];
      var angle = i * 2.4;
      var radius = 8 + i * 3.2;
      var cx = 50 + Math.cos(angle) * Math.min(radius, 42) * (0.7 + (i % 3) * 0.1);
      var cy = 50 + Math.sin(angle) * Math.min(radius, 38) * 0.75;
      var h = ((w.text && w.text.charCodeAt(0)) || 0) * 17 + i * 31;
      h = h % 100;
      cx += (h % 7) - 3;
      cy += ((h * 3) % 7) - 3;
      cx = Math.max(6, Math.min(94, cx));
      cy = Math.max(8, Math.min(92, cy));
      parts.push(
        '<span style="left:' + cx.toFixed(1) + '%;top:' + cy.toFixed(1) + '%;font-size:' + size +
        'px;color:' + color + ';opacity:' + (0.55 + t * 0.45).toFixed(2) +
        '" title="' + esc(w.text) + ' · 权重 ' + esc(w.weight) + '">' + esc(w.text) + '</span>'
      );
    });
    setHTML(box, parts.join(''));
  }

  function renderThemes() {
    var box = byId('themeBars');
    if (!box) return;
    var themes = DATA.themes || [];
    var max = themes.reduce(function (m, t) { return Math.max(m, t.count || 0); }, 1);
    setHTML(box, themes.map(function (t) {
      var lean = leanClass(t.sentiment_lean);
      var pct = Math.round(((t.count || 0) / max) * 100);
      return '<div class="bar-row">' +
        '<div class="name" title="' + esc(t.name) + '">' + esc(t.name) + '</div>' +
        '<div class="bar-track"><div class="bar-fill ' + esc(lean) + ' ' + esc(t.sentiment_lean || '') + '" style="width:' + pct + '%"></div></div>' +
        '<div class="cnt">' + (t.count || 0) + '</div></div>';
    }).join(''));
  }

  function renderCompetitors() {
    var box = byId('compTable');
    if (!box) return;
    var rows = DATA.competitors || [];
    var html = '<table class="comp-table"><thead><tr>' +
      '<th>机构</th><th>声量份额</th><th>情感倾向</th><th>说明</th></tr></thead><tbody>';
    rows.forEach(function (c) {
      var cls = c.name === '汇丰' ? 'hsbc' : '';
      var badge = c.placeholder ? ' <span class="pill demo">示意数据</span>' : '';
      var sov = Number(c.sov) || 0;
      html += '<tr class="' + cls + '"><td>' + esc(c.name) + badge + '</td>' +
        '<td><div class="bar-track" style="display:inline-block;width:80px;vertical-align:middle;margin-right:6px">' +
        '<div class="bar-fill' + (c.name === '汇丰' ? ' neg' : '') + '" style="width:' + sov + '%"></div></div>' +
        sov + '%</td>' +
        '<td><span class="lean-pill ' + esc(c.sentiment_lean) + '">' + leanZh(c.sentiment_lean) + '</span></td>' +
        '<td>' + esc(c.note || '') + '</td></tr>';
    });
    html += '</tbody></table>';
    setHTML(box, html);
  }

  function leanZh(l) {
    return ({ positive: '偏正', negative: '偏负', mixed: '分化', neutral: '中性' })[l] || l || '—';
  }

  function renderIssues() {
    var box = byId('issueGrid');
    if (!box) return;
    var risks = DATA.risks || [];
    var opps = DATA.opportunities || [];
    var html = '';
    risks.forEach(function (r) {
      html += '<div class="issue risk"><span class="sev">' + esc(r.severity) + '</span>' +
        '<div class="itag">风险</div><div class="ititle">' + esc(r.title) + '</div>' +
        '<div class="idetail">' + esc(r.detail) + '</div></div>';
    });
    opps.forEach(function (o) {
      html += '<div class="issue opp"><span class="sev">' + esc(o.severity) + '</span>' +
        '<div class="itag">机会</div><div class="ititle">' + esc(o.title) + '</div>' +
        '<div class="idetail">' + esc(o.detail) + '</div></div>';
    });
    setHTML(box, html || '<p class="card-muted">暂无风险/机会条目</p>');
  }

  function renderMix() {
    var vm = DATA.voice_mix || {};
    var total = (vm['真实商业相关'] || 0) + (vm['中介/企服'] || 0) + (vm['个人户噪声'] || 0) || 1;
    var colors = { '真实商业相关': '#1e1e1e', '中介/企服': '#DB0011', '个人户噪声': '#999' };
    var bar = byId('voiceMixBar');
    if (bar) {
      setHTML(bar, Object.keys(vm).map(function (k) {
        var pct = ((vm[k] / total) * 100).toFixed(1);
        return '<div class="mix-seg" style="width:' + pct + '%;background:' + (colors[k] || '#ccc') + '" title="' + esc(k) + ' ' + vm[k] + '">' +
          (Number(pct) > 12 ? pct + '%' : '') + '</div>';
      }).join(''));
    }
    var leg = byId('voiceMixLegend');
    if (leg) {
      setHTML(leg, Object.keys(vm).map(function (k) {
        return '<span><i style="background:' + (colors[k] || '#ccc') + '"></i>' + esc(k) + ' ' + vm[k] + '</span>';
      }).join(''));
    }

    var segBox = byId('segmentMix');
    if (segBox && DATA.segment_mix) {
      var max = DATA.segment_mix.reduce(function (m, s) { return Math.max(m, s.count || 0); }, 1);
      setHTML(segBox, DATA.segment_mix.map(function (s) {
        var w = Math.round(((s.count || 0) / max) * 100);
        return '<div class="bar-row"><div class="name">' + esc(s.name) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:#333"></div></div>' +
          '<div class="cnt">' + (s.count || 0) + '</div></div>';
      }).join(''));
    }
  }

  /* ---------- NEW: multi-source figures ---------- */
  var PLAT_COLORS = {
    '小红书': '#DB0011', '微博': '#ff8200', '知乎': '#0084ff',
    '新闻媒体': '#333', '官网/新闻稿': '#0a7a3e', '论坛/社区': '#6b4fbb', '网页其他': '#999'
  };
  var CH_COLORS = { ugc: '#DB0011', news: '#333', official: '#0a7a3e', forum: '#6b4fbb', web: '#999' };
  var CRED_COLORS = { high: '#0a7a3e', medium: '#b36b00', low: '#999' };

  function renderSourceMix() {
    var box = byId('sourceMixBars');
    if (!box) return;
    var plats = DATA.platforms || [];
    var max = plats.reduce(function (m, p) { return Math.max(m, p.count || 0); }, 1);
    setHTML(box, plats.map(function (p) {
      var w = Math.round(((p.count || 0) / max) * 100);
      var col = PLAT_COLORS[p.name] || '#666';
      return '<div class="bar-row"><div class="name" title="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:' + col + '"></div></div>' +
        '<div class="cnt">' + (p.count || 0) + '<span class="card-muted"> (' + (p.pct || 0) + '%)</span></div></div>';
    }).join(''));

    var donutHost = byId('channelDonut');
    if (donutHost) {
      var mix = DATA.source_channel_mix || [];
      var total = mix.reduce(function (s, m) { return s + (m.count || 0); }, 0) || 1;
      var acc = 0;
      var stops = [];
      mix.forEach(function (m) {
        var pct = (m.count / total) * 100;
        var col = CH_COLORS[m.name] || '#ccc';
        stops.push(col + ' ' + acc + '% ' + (acc + pct) + '%');
        acc += pct;
      });
      var legend = mix.map(function (m) {
        return '<span><i style="background:' + (CH_COLORS[m.name] || '#ccc') + '"></i>' + esc(m.label || m.name) + ' ' + m.count + '</span>';
      }).join('');
      setHTML(donutHost,
        '<div class="css-donut-wrap" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<div style="width:100px;height:100px;border-radius:50%;background:conic-gradient(' + stops.join(',') + ');position:relative;flex-shrink:0">' +
        '<div style="position:absolute;inset:26px;background:#fff;border-radius:50%"></div></div>' +
        '<div class="mix-legend" style="flex:1">' + legend + '</div></div>'
      );
    }
  }

  function renderNewsUgcOfficial() {
    var box = byId('channelShareBars');
    if (!box) return;
    var n = DATA.news_ugc_official || {};
    var rows = [
      { key: 'ugc', label: 'UGC（小红书/微博/知乎）', color: CH_COLORS.ugc },
      { key: 'official', label: '官方（官网/新闻稿）', color: CH_COLORS.official },
      { key: 'news', label: '新闻媒体', color: CH_COLORS.news },
      { key: 'forum', label: '论坛/社区', color: CH_COLORS.forum },
      { key: 'web', label: '网页其他', color: CH_COLORS.web }
    ];
    var max = rows.reduce(function (m, r) { return Math.max(m, n[r.key] || 0); }, 1);
    setHTML(box, rows.map(function (r) {
      var c = n[r.key] || 0;
      var w = Math.round((c / max) * 100);
      return '<div class="bar-row"><div class="name" style="min-width:140px">' + esc(r.label) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:' + r.color + '"></div></div>' +
        '<div class="cnt">' + c + '</div></div>';
    }).join(''));
  }

  function renderCredibility() {
    var box = byId('credibilityMix');
    if (!box) return;
    var rows = DATA.credibility_mix || [];
    var total = rows.reduce(function (s, r) { return s + (r.count || 0); }, 0) || 1;
    setHTML(box,
      '<div class="mix-bars" style="margin-bottom:8px">' + rows.map(function (r) {
        var pct = ((r.count / total) * 100).toFixed(1);
        return '<div class="mix-seg" style="width:' + pct + '%;background:' + (CRED_COLORS[r.name] || '#ccc') + '" title="' + esc(r.label) + '">' +
          (Number(pct) > 10 ? pct + '%' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="mix-legend">' + rows.map(function (r) {
        return '<span><i style="background:' + (CRED_COLORS[r.name] || '#ccc') + '"></i>' + esc(r.label) + ' ' + r.count + ' (' + r.pct + '%)</span>';
      }).join('') + '</div>'
    );
  }

  function renderCrossSource() {
    var box = byId('crossSourceHeat');
    if (!box) return;
    var cs = DATA.cross_source_themes;
    if (!cs || !cs.themes || !cs.platforms) {
      setHTML(box, '<p class="card-muted">暂无跨源主题矩阵</p>');
      return;
    }
    var max = 1;
    (cs.matrix || []).forEach(function (row) {
      row.forEach(function (v) { if (v > max) max = v; });
    });
    var html = '<div class="heat-wrap"><table class="heat-table"><thead><tr><th>主题 \\ 平台</th>';
    cs.platforms.forEach(function (pl) {
      html += '<th title="' + esc(pl) + '">' + esc(pl.length > 4 ? pl.slice(0, 4) : pl) + '</th>';
    });
    html += '</tr></thead><tbody>';
    cs.themes.forEach(function (th, i) {
      html += '<tr><td class="heat-label">' + esc(th) + '</td>';
      (cs.matrix[i] || []).forEach(function (v) {
        var intensity = max ? v / max : 0;
        var bg = v === 0 ? '#f7f7f7' : 'rgba(219,0,17,' + (0.12 + intensity * 0.75).toFixed(2) + ')';
        var color = intensity > 0.55 ? '#fff' : '#1e1e1e';
        html += '<td class="heat-cell" style="background:' + bg + ';color:' + color + '" title="' + esc(th) + ' × ' + esc(cs.platforms[(cs.matrix[i] || []).indexOf(v)] || '') + ': ' + v + '">' + (v || '·') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    // Fix titles properly
    html = '<div class="heat-wrap"><table class="heat-table"><thead><tr><th>主题 \\ 平台</th>';
    cs.platforms.forEach(function (pl) {
      html += '<th title="' + esc(pl) + '">' + esc(pl.length > 5 ? pl.slice(0, 5) + '…' : pl) + '</th>';
    });
    html += '</tr></thead><tbody>';
    cs.themes.forEach(function (th, i) {
      html += '<tr><td class="heat-label">' + esc(th) + '</td>';
      (cs.matrix[i] || []).forEach(function (v, j) {
        var intensity = max ? v / max : 0;
        var bg = v === 0 ? '#f7f7f7' : 'rgba(219,0,17,' + (0.12 + intensity * 0.75).toFixed(2) + ')';
        var color = intensity > 0.55 ? '#fff' : '#1e1e1e';
        html += '<td class="heat-cell" style="background:' + bg + ';color:' + color + '" title="' + esc(th) + ' × ' + esc(cs.platforms[j]) + ': ' + v + '">' + (v || '·') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table><p class="card-muted" style="margin-top:8px">清洗后样本 · 单元格=帖数 · 颜色越深声量越高</p></div>';
    setHTML(box, html);
  }

  function renderPersonaBits() {
    setText(byId('oneLiner'), persona.one_liner || '');
    var focus = byId('focusWeek');
    if (focus) {
      setHTML(focus, (persona.focus_week || []).map(function (f) {
        return '<div class="focus-card"><div class="flabel">本周关注 · ' + esc(f.label) + '</div>' +
          '<div class="ftext">' + esc(f.text) + '</div></div>';
      }).join(''));
    }
    var ins = byId('insightList');
    if (ins) {
      setHTML(ins, (persona.insights || []).map(function (t) {
        return '<li>' + esc(t) + '</li>';
      }).join(''));
    }
  }

  var fd = DATA.filter_defaults || {};
  var filterState = {
    hideIntermediaries: !!fd.hideIntermediaries,
    hidePersonalNoise: !!fd.hidePersonalNoise,
    sentiment: '',
    category: '',
    platform: '',
    source_channel: '',
    q: ''
  };

  function initFilters() {
    var fInt = byId('fHideInt');
    var fPers = byId('fHidePers');
    var fSent = byId('fSentiment');
    var fCat = byId('fCategory');
    var fPlat = byId('fPlatform');
    var fCh = byId('fChannel');
    var fQ = byId('fSearch');
    if (fInt) {
      fInt.checked = filterState.hideIntermediaries;
      fInt.addEventListener('change', function () { filterState.hideIntermediaries = !!fInt.checked; renderFeed(); });
    }
    if (fPers) {
      fPers.checked = filterState.hidePersonalNoise;
      fPers.addEventListener('change', function () { filterState.hidePersonalNoise = !!fPers.checked; renderFeed(); });
    }
    if (fSent) {
      setHTML(fSent, '<option value="">全部情感</option><option>正面</option><option>负面</option><option>中性</option>');
      fSent.addEventListener('change', function () { filterState.sentiment = fSent.value; renderFeed(); });
    }
    if (fCat) {
      setHTML(fCat, '<option value="">全部分类</option>' + (DATA.categories || []).map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
      }).join(''));
      fCat.addEventListener('change', function () { filterState.category = fCat.value; syncTopicChips(); renderFeed(); });
    }
    if (fPlat) {
      var plats = (DATA.platforms || []).map(function (p) { return p.name; });
      setHTML(fPlat, '<option value="">全部平台</option>' + plats.map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
      }).join(''));
      fPlat.addEventListener('change', function () { filterState.platform = fPlat.value; renderFeed(); });
    }
    if (fCh) {
      setHTML(fCh, '<option value="">全部渠道</option>' +
        ['ugc', 'news', 'official', 'forum', 'web'].map(function (c) {
          return '<option value="' + c + '">' + esc(CHANNEL_LABEL[c] || c) + '</option>';
        }).join(''));
      fCh.addEventListener('change', function () { filterState.source_channel = fCh.value; renderFeed(); });
    }
    if (fQ) {
      var t;
      fQ.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { filterState.q = fQ.value; renderFeed(); }, 200);
      });
    }

    var topics = byId('topicChips');
    if (topics) {
      var chips = '<button type="button" class="topic-chip active" data-cat="">全部</button>' +
        (DATA.categories || []).map(function (c) {
          return '<button type="button" class="topic-chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('');
      setHTML(topics, chips);
      topics.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.topic-chip') : null;
        if (!btn) return;
        var cat = btn.getAttribute('data-cat') || '';
        if (filterState.category === cat && cat) { cat = ''; }
        filterState.category = cat;
        if (fCat) fCat.value = cat;
        syncTopicChips();
        renderFeed();
      });
    }
  }

  function syncTopicChips() {
    var topics = byId('topicChips');
    if (!topics) return;
    $$('.topic-chip', topics).forEach(function (b) {
      b.classList.toggle('active', (b.getAttribute('data-cat') || '') === (filterState.category || ''));
    });
  }

  function platformPill(p) {
    var plat = p.platform || '—';
    var cls = PLATFORM_CLASS[plat] || 'plat-web';
    return '<span class="pill platform ' + cls + '">' + esc(plat) + '</span>';
  }

  function renderFeed() {
    var posts = filterPosts(filterState);
    var countEl = byId('filterCount');
    var total = (DATA.posts || []).length;
    if (countEl) setText(countEl, '显示 ' + posts.length + ' / 共 ' + total + ' 条');

    var tbody = byId('postBody');
    if (!tbody) return;
    if (!posts.length) {
      setHTML(tbody, '<tr><td colspan="7" class="card-muted">无匹配帖子</td></tr>');
      return;
    }
    setHTML(tbody, posts.slice(0, 120).map(function (p) {
      var demo = (p.is_placeholder || p.demo_badge) ? '<span class="pill demo">示意·模拟</span> ' : '';
      var src;
      if (p.source_status === 'justone_api') src = '<span class="pill src">Just One</span>';
      else if (p.source_status === 'web_informed') src = '<span class="pill src web">Web Informed</span>';
      else src = '<span class="pill demo">示意·模拟</span>';
      var ch = '<span class="pill channel">' + esc(CHANNEL_LABEL[p.source_channel] || p.source_channel || '—') + '</span>';
      var cred = '<span class="pill cred-' + esc(p.credibility || 'medium') + '">' + esc(({ high: '高可信', medium: '中可信', low: '低可信' })[p.credibility] || p.credibility || '') + '</span>';
      var comps = (p.competitors && p.competitors.length) ? p.competitors.join('、') : '—';
      var link = '';
      if (p.url && !/xiaohongshu\.com\/(explore|discovery)/i.test(p.url)) {
        link = ' <a href="' + esc(p.url) + '" target="_blank" rel="noopener">链接</a>';
      }
      return '<tr>' +
        '<td><div class="title">' + demo + esc(p.title || '（无标题）') + '</div>' +
        '<div class="summary">' + esc(p.summary || '') + link + '</div>' +
        '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">' + platformPill(p) + ch + cred + '</div>' +
        '<div class="card-muted" style="margin-top:4px">' + esc(p.id || '') + '</div></td>' +
        '<td><span class="pill ' + esc(p.sentiment) + '">' + esc(p.sentiment) + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td>' + esc(p.author_type || '—') + '<div class="card-muted">' + esc(p.segment || '') + '</div></td>' +
        '<td>' + src + '<div class="card-muted">' + esc(p.published_at || '') + '</div></td>' +
        '<td class="card-muted">' + esc(comps) + '</td>' +
        '</tr>';
    }).join(''));
  }

  function renderMethod() {
    var box = byId('methodBody');
    if (!box) return;
    var m = DATA.meta || {};
    var ms = DATA.management_summary || {};
    var k = DATA.kpis_clean || {};
    var plats = (DATA.platforms || []).map(function (p) { return p.name + ' ' + p.count; }).join(' · ');
    setHTML(box,
      '<h3>数据来源与口径（多源）</h3>' +
      '<ul>' +
      '<li><strong>版本：</strong>' + esc(m.version || 'multisource') + ' · 相对 v1/v2 小红书单源，本套件扩展官网/新闻/微博/知乎/论坛</li>' +
      '<li><strong>样本：</strong>Just One ' + (k.justone_count || 0) + ' · Web Informed ' + (k.web_informed_count || 0) + ' · 示意·模拟 ' + (k.placeholder_count || 0) + '（合计 ' + ((DATA.posts || []).length) + '）</li>' +
      '<li><strong>平台分布：</strong>' + esc(plats) + '</li>' +
      '<li><strong>更新：</strong>' + esc(m.updated_at_display || '') + '</li>' +
      '<li><strong>默认过滤：</strong>隐藏中介/公司秘书/企服推广 + 隐藏个人户噪声；KPI 以清洗后口径汇报</li>' +
      '<li><strong>可信度：</strong>官网/新闻=高；Just One UGC=中；示意·模拟/中介噪声=低</li>' +
      '<li><strong>免责声明：</strong>' + esc(m.disclaimer || '') + '</li>' +
      '<li><strong>数据缺口：</strong>' + esc(m.data_gap_note || '') + '</li>' +
      '</ul>' +
      '<h3>声音质量说明</h3>' +
      '<p>' + esc(ms.voice_quality_note || '') + '</p>' +
      '<h3>示意数据标记</h3>' +
      '<p>竞品 SOV、周情感趋势、微博/知乎/论坛占位帖标有 <span class="pill demo">示意·模拟</span>。Web Informed 条目允许真实官网/新闻 URL；<strong>不编造</strong>小红书 explore/note 假链接。</p>' +
      '<h3>推荐管理层行动</h3>' +
      '<ul>' + (ms.recommended_actions || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
    );
  }

  function boot() {
    safe('header', renderHeader);
    safe('tabs', initTabs);
    safe('kpis', renderKPIs);
    safe('sentiment', renderSentiment);
    safe('wordcloud', renderWordCloud);
    safe('themes', renderThemes);
    safe('competitors', renderCompetitors);
    safe('issues', renderIssues);
    safe('mix', renderMix);
    safe('sourceMix', renderSourceMix);
    safe('channelShare', renderNewsUgcOfficial);
    safe('credibility', renderCredibility);
    safe('crossSource', renderCrossSource);
    safe('persona', renderPersonaBits);
    safe('filters', initFilters);
    safe('feed', renderFeed);
    safe('method', renderMethod);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
