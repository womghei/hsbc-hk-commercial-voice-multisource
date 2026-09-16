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
  var I18N = window.HSBC_I18N;
  var filtersBound = false;
  function t(key) { return I18N ? I18N.t(key) : key; }
  function L(zh) { return I18N ? I18N.label(zh) : zh; }
  function Sent(zh) { return I18N ? I18N.sentiment(zh) : zh; }
  function isEn() { return !!(I18N && I18N.isEn()); }
  function livePersona() {
    var base = (DATA.personas && (DATA.personas[personaId] || DATA.personas.head)) || {};
    return I18N ? I18N.persona(personaId, base) : base;
  }
  function destroyCharts() {
    chartInstances.forEach(function (c) {
      try { if (c && c.destroy) c.destroy(); } catch (e) {}
    });
    chartInstances = [];
  }

  function channelLabel(ch) {
    return ({ ugc: t('ch.ugc'), news: t('ch.news'), official: t('ch.official'), forum: t('ch.forum'), web: t('ch.web') })[ch] || ch;
  }
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
    var persona = livePersona();
    setText(byId('personaTitle'), persona.title || '');
    setText(byId('personaAudience'), persona.audience || '');
    var upd = byId('updatedAt');
    if (upd) setText(upd, t('updated') + ' ' + (meta.updated_at_display || ''));
    $$('.persona-nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === personaId);
    });
  }

  function kpiDefs() {
    return [
      { key: 'total_posts', label: t('kpi.total_posts'), hint: t('kpi.total_posts_h'), fmt: function (v) { return v; } },
      { key: 'positive_pct', label: t('kpi.positive_pct'), hint: t('kpi.positive_pct_h'), cls: 'pos', fmt: function (v) { return v + '%'; } },
      { key: 'negative_pct', label: t('kpi.negative_pct'), hint: t('kpi.negative_pct_h'), cls: 'neg', fmt: function (v) { return v + '%'; } },
      { key: 'neutral_pct', label: t('kpi.neutral_pct'), hint: t('kpi.neutral_pct_h'), cls: 'neu', fmt: function (v) { return v + '%'; } },
      { key: 'net_sentiment', label: t('kpi.net_sentiment'), hint: t('kpi.net_sentiment_h'), fmt: function (v) { return (v > 0 ? '+' : '') + v + 'pp'; } },
      { key: 'commercial_related_pct', label: t('kpi.commercial_related_pct'), hint: t('kpi.commercial_related_pct_h'), fmt: function (v) { return v + '%'; } },
      { key: 'intermediary_count', label: t('kpi.intermediary_count'), hint: t('kpi.intermediary_count_h'), fmt: function (v) { return v; } },
      { key: 'xhs_sample_count', label: t('kpi.xhs_sample_count'), hint: t('kpi.xhs_sample_count_h'), fmt: function (v) { return v; } },
      { key: 'web_informed_count', label: t('kpi.web_informed_count'), hint: t('kpi.web_informed_count_h'), fmt: function (v) { return v; } },
      { key: 'placeholder_count', label: t('kpi.placeholder_count_ms'), hint: t('kpi.placeholder_count_h_ms'), fmt: function (v) { return v; } },
      { key: 'platform_count', label: t('kpi.platform_count'), hint: t('kpi.platform_count_h'), fmt: function (v) { return v; } },
      { key: 'hot_theme_count', label: t('kpi.hot_theme_count'), hint: t('kpi.hot_theme_count_h'), fmt: function (v) { return v; } }
    ];
  }

  function renderKPIs() {
    var box = byId('kpiStrip');
    if (!box) return;
    var kpis = DATA.kpis_clean || DATA.kpis || {};
    var persona = livePersona();
    var baseP = (DATA.personas && (DATA.personas[personaId] || DATA.personas.head)) || {};
    var hi = baseP.kpi_highlight || [];
    var cards = [];
    kpiDefs().forEach(function (def) {
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
        '<span class="l-pos">' + t('sent.pos') + ' ' + (s['正面'] || 0) + '</span>' +
        '<span class="l-neg">' + t('sent.neg') + ' ' + (s['负面'] || 0) + '</span>' +
        '<span class="l-neu">' + t('sent.neu') + ' ' + (s['中性'] || 0) + '</span>'
      );
    }

    var trend = DATA.sentiment_trend;
    var spark = byId('sentimentSpark');
    if (spark && ChartOK && trend) {
      try {
        chartInstances.push(new Chart(spark.getContext('2d'), {
          type: 'line',
          data: {
            labels: (trend.labels || []).map(function (lb) { return L(lb); }),
            datasets: [
              { label: t('sent.pos') + '%', data: trend.positive, borderColor: '#0a7a3e', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 },
              { label: t('sent.neg') + '%', data: trend.negative, borderColor: '#DB0011', backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 }
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
      setHTML(host, '<p class="card-muted">' + t('trend.fallback') + ' ' + (trend.positive || []).join('/') + ' · ' + t('trend.neg') + ' ' + (trend.negative || []).join('/') + '</p>');
    }
  }

  function fallbackDonut(s, total) {
    var p = total ? Math.round(((s['正面'] || 0) / total) * 100) : 0;
    var n = total ? Math.round(((s['负面'] || 0) / total) * 100) : 0;
    var u = Math.max(0, 100 - p - n);
    return '<div class="css-donut-wrap" style="display:flex;align-items:center;justify-content:center;height:200px;gap:16px;font-size:0.85rem;">' +
      '<div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(#0a7a3e 0 ' + p + '%,#DB0011 ' + p + '% ' + (p + n) + '%,#bbb ' + (p + n) + '% 100%);position:relative;">' +
      '<div style="position:absolute;inset:28px;background:#fff;border-radius:50%;"></div></div>' +
      '<div style="line-height:1.7"><div><strong>' + t('sent.pos_short') + '</strong> ' + p + '%</div><div><strong>' + t('sent.neg_short') + '</strong> ' + n + '%</div><div><strong>' + t('sent.neu_short') + '</strong> ' + u + '%</div></div></div>';
  }

  function renderWordCloud() {
    var box = byId('wordCloud');
    if (!box) return;
    var words = (DATA.word_cloud || []).slice(0, 36);
    if (!words.length) { setText(box, t('empty.cloud')); return; }
    var maxW = words[0].weight || 1;
    var minW = words[words.length - 1].weight || 1;
    var parts = [];
    words.forEach(function (w, i) {
      var ratio = (w.weight - minW) / (maxW - minW || 1);
      var size = 11 + Math.round(ratio * 22);
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
        'px;color:' + color + ';opacity:' + (0.55 + ratio * 0.45).toFixed(2) +
        '" title="' + esc(w.text) + ' · ' + t('weight') + ' ' + esc(w.weight) + '">' + esc(w.text) + '</span>'
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
        '<div class="name" title="' + esc(L(t.name)) + '">' + esc(L(t.name)) + '</div>' +
        '<div class="bar-track"><div class="bar-fill ' + esc(lean) + ' ' + esc(t.sentiment_lean || '') + '" style="width:' + pct + '%"></div></div>' +
        '<div class="cnt">' + (t.count || 0) + '</div></div>';
    }).join(''));
  }

  function renderCompetitors() {
    var box = byId('compTable');
    if (!box) return;
    var rows = DATA.competitors || [];
    var html = '<table class="comp-table"><thead><tr>' +
      '<th>' + t('comp.org') + '</th><th>' + t('comp.sov') + '</th><th>' + t('comp.lean') + '</th><th>' + t('comp.note') + '</th></tr></thead><tbody>';
    rows.forEach(function (c) {
      var cls = c.name === '汇丰' ? 'hsbc' : '';
      var badge = c.placeholder ? ' <span class="pill demo">' + t('badge.demo') + '</span>' : '';
      var sov = Number(c.sov) || 0;
      html += '<tr class="' + cls + '"><td>' + esc(c.name) + badge + '</td>' +
        '<td><div class="bar-track" style="display:inline-block;width:80px;vertical-align:middle;margin-right:6px">' +
        '<div class="bar-fill' + (c.name === '汇丰' ? ' neg' : '') + '" style="width:' + sov + '%"></div></div>' +
        sov + '%</td>' +
        '<td><span class="lean-pill ' + esc(c.sentiment_lean) + '">' + leanZh(c.sentiment_lean) + '</span></td>' +
        '<td>' + esc((I18N ? I18N.compNote(c.note) : c.note) || '') + '</td></tr>';
    });
    html += '</tbody></table>';
    setHTML(box, html);
  }

  function leanZh(l) {
    return (I18N ? I18N.lean(l) : ({ positive: '偏正', negative: '偏负', mixed: '分化', neutral: '中性' })[l]) || l || '—';
  }

  function renderIssues() {
    var box = byId('issueGrid');
    if (!box) return;
    var risks = DATA.risks || [];
    var opps = DATA.opportunities || [];
    var html = '';
    risks.forEach(function (r0) {
      var r = I18N ? I18N.risk(r0) : r0;
      html += '<div class="issue risk"><span class="sev">' + esc(r.severity) + '</span>' +
        '<div class="itag">' + t('issue.risk') + '</div><div class="ititle">' + esc(r.title) + '</div>' +
        '<div class="idetail">' + esc(r.detail) + '</div></div>';
    });
    opps.forEach(function (o0) {
      var o = I18N ? I18N.opp(o0) : o0;
      html += '<div class="issue opp"><span class="sev">' + esc(o.severity) + '</span>' +
        '<div class="itag">' + t('issue.opp') + '</div><div class="ititle">' + esc(o.title) + '</div>' +
        '<div class="idetail">' + esc(o.detail) + '</div></div>';
    });
    setHTML(box, html || '<p class="card-muted">' + t('empty.issues') + '</p>');
  }

  function renderMix() {
    var vm = DATA.voice_mix || {};
    var total = (vm['真实商业相关'] || 0) + (vm['中介/企服'] || 0) + (vm['个人户噪声'] || 0) || 1;
    var colors = { '真实商业相关': '#1e1e1e', '中介/企服': '#DB0011', '个人户噪声': '#999' };
    var bar = byId('voiceMixBar');
    if (bar) {
      setHTML(bar, Object.keys(vm).map(function (k) {
        var pct = ((vm[k] / total) * 100).toFixed(1);
        return '<div class="mix-seg" style="width:' + pct + '%;background:' + (colors[k] || '#ccc') + '" title="' + esc(L(k)) + ' ' + vm[k] + '">' +
          (Number(pct) > 12 ? pct + '%' : '') + '</div>';
      }).join(''));
    }
    var leg = byId('voiceMixLegend');
    if (leg) {
      setHTML(leg, Object.keys(vm).map(function (k) {
        return '<span><i style="background:' + (colors[k] || '#ccc') + '"></i>' + esc(L(k)) + ' ' + vm[k] + '</span>';
      }).join(''));
    }

    var segBox = byId('segmentMix');
    if (segBox && DATA.segment_mix) {
      var max = DATA.segment_mix.reduce(function (m, s) { return Math.max(m, s.count || 0); }, 1);
      setHTML(segBox, DATA.segment_mix.map(function (s) {
        var w = Math.round(((s.count || 0) / max) * 100);
        return '<div class="bar-row"><div class="name">' + esc(L(s.name)) + '</div>' +
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
      return '<div class="bar-row"><div class="name" title="' + esc(L(p.name)) + '">' + esc(L(p.name)) + '</div>' +
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
        return '<span><i style="background:' + (CH_COLORS[m.name] || '#ccc') + '"></i>' + esc(channelLabel(m.name) || m.label || m.name) + ' ' + m.count + '</span>';
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
      { key: 'ugc', label: t('share.ugc'), color: CH_COLORS.ugc },
      { key: 'official', label: t('share.official'), color: CH_COLORS.official },
      { key: 'news', label: t('share.news'), color: CH_COLORS.news },
      { key: 'forum', label: t('share.forum'), color: CH_COLORS.forum },
      { key: 'web', label: t('share.web'), color: CH_COLORS.web }
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
        return '<div class="mix-seg" style="width:' + pct + '%;background:' + (CRED_COLORS[r.name] || '#ccc') + '" title="' + esc(t('cred.' + r.name) || r.label) + '">' +
          (Number(pct) > 10 ? pct + '%' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="mix-legend">' + rows.map(function (r) {
        return '<span><i style="background:' + (CRED_COLORS[r.name] || '#ccc') + '"></i>' + esc(t('cred.' + r.name) || r.label) + ' ' + r.count + ' (' + r.pct + '%)</span>';
      }).join('') + '</div>'
    );
  }

  function renderCrossSource() {
    var box = byId('crossSourceHeat');
    if (!box) return;
    var cs = DATA.cross_source_themes;
    if (!cs || !cs.themes || !cs.platforms) {
      setHTML(box, '<p class="card-muted">' + t('empty.cross') + '</p>');
      return;
    }
    var max = 1;
    (cs.matrix || []).forEach(function (row) {
      row.forEach(function (v) { if (v > max) max = v; });
    });
    var html = '<div class="heat-wrap"><table class="heat-table"><thead><tr>' + '<th>' + t('cross.theme_plat') + '</th>' + '';
    cs.platforms.forEach(function (pl) {
      html += '<th title="' + esc(pl) + '">' + esc(pl.length > 4 ? pl.slice(0, 4) : pl) + '</th>';
    });
    html += '</tr></thead><tbody>';
    cs.themes.forEach(function (th, i) {
      html += '<tr><td class="heat-label">' + esc(L(th)) + '</td>';
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
    html = '<div class="heat-wrap"><table class="heat-table"><thead><tr>' + '<th>' + t('cross.theme_plat') + '</th>' + '';
    cs.platforms.forEach(function (pl) {
      html += '<th title="' + esc(L(pl)) + '">' + esc((L(pl).length > 5 ? L(pl).slice(0, 5) + '…' : L(pl))) + '</th>';
    });
    html += '</tr></thead><tbody>';
    cs.themes.forEach(function (th, i) {
      html += '<tr><td class="heat-label">' + esc(L(th)) + '</td>';
      (cs.matrix[i] || []).forEach(function (v, j) {
        var intensity = max ? v / max : 0;
        var bg = v === 0 ? '#f7f7f7' : 'rgba(219,0,17,' + (0.12 + intensity * 0.75).toFixed(2) + ')';
        var color = intensity > 0.55 ? '#fff' : '#1e1e1e';
        html += '<td class="heat-cell" style="background:' + bg + ';color:' + color + '" title="' + esc(th) + ' × ' + esc(cs.platforms[j]) + ': ' + v + '">' + (v || '·') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table><p class="card-muted" style="margin-top:8px">' + t('cross.note') + '</p></div>';
    setHTML(box, html);
  }

  function renderPersonaBits() {
    var persona = livePersona();
    setText(byId('oneLiner'), persona.one_liner || '');
    var focus = byId('focusWeek');
    if (focus) {
      setHTML(focus, (persona.focus_week || []).map(function (f) {
        return '<div class="focus-card"><div class="flabel">' + t('sec.focus_prefix') + ' · ' + esc(f.label) + '</div>' +
          '<div class="ftext">' + esc(f.text) + '</div></div>';
      }).join(''));
    }
    var ins = byId('insightList');
    if (ins) {
      setHTML(ins, (persona.insights || []).map(function (line) {
        return '<li>' + esc(line) + '</li>';
      }).join(''));
    }
    var ih = byId('insightHeading');
    if (ih) setText(ih, t('sec.insight_prefix') + ' · ' + (persona.title || ''));
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
      if (!filtersBound) fInt.addEventListener('change', function () { filterState.hideIntermediaries = !!fInt.checked; renderFeed(); });
    }
    if (fPers) {
      fPers.checked = filterState.hidePersonalNoise;
      if (!filtersBound) fPers.addEventListener('change', function () { filterState.hidePersonalNoise = !!fPers.checked; renderFeed(); });
    }
    if (fSent) {
      setHTML(fSent, '<option value="">' + t('filter.all_sent') + '</option><option value="正面">' + t('sent.pos') + '</option><option value="负面">' + t('sent.neg') + '</option><option value="中性">' + t('sent.neu') + '</option>');
      fSent.value = filterState.sentiment || '';
      if (!filtersBound) fSent.addEventListener('change', function () { filterState.sentiment = fSent.value; renderFeed(); });
    }
    if (fCat) {
      setHTML(fCat, '<option value="">' + t('filter.all_cat') + '</option>' + (DATA.categories || []).map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(L(c)) + '</option>';
      }).join(''));
      fCat.value = filterState.category || '';
      if (!filtersBound) fCat.addEventListener('change', function () { filterState.category = fCat.value; syncTopicChips(); renderFeed(); });
    }
    if (fPlat) {
      var plats = (DATA.platforms || []).map(function (p) { return p.name; });
      setHTML(fPlat, '<option value="">' + t('filter.all_plat') + '</option>' + plats.map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(L(c)) + '</option>';
      }).join(''));
      fPlat.value = filterState.platform || '';
      if (!filtersBound) fPlat.addEventListener('change', function () { filterState.platform = fPlat.value; renderFeed(); });
    }
    if (fCh) {
      setHTML(fCh, '<option value="">' + t('filter.all_ch') + '</option>' +
        ['ugc', 'news', 'official', 'forum', 'web'].map(function (c) {
          return '<option value="' + c + '">' + esc(channelLabel(c)) + '</option>';
        }).join(''));
      fCh.value = filterState.source_channel || '';
      if (!filtersBound) fCh.addEventListener('change', function () { filterState.source_channel = fCh.value; renderFeed(); });
    }
    if (fQ) {
      fQ.setAttribute('placeholder', t('filter.search_ph'));
      var searchTimer;
      if (!filtersBound) fQ.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { filterState.q = fQ.value; renderFeed(); }, 200);
      });
    }

    var topics = byId('topicChips');
    if (topics) {
      var chips = '<button type="button" class="topic-chip active" data-cat="">' + t('filter.all') + '</button>' +
        (DATA.categories || []).map(function (c) {
          return '<button type="button" class="topic-chip" data-cat="' + esc(c) + '">' + esc(L(c)) + '</button>';
        }).join('');
      setHTML(topics, chips);
      if (!filtersBound) topics.addEventListener('click', function (e) {
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
    syncTopicChips();
    filtersBound = true;
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
    return '<span class="pill platform ' + cls + '">' + esc(L(plat)) + '</span>';
  }

  function renderFeed() {
    var posts = filterPosts(filterState);
    var countEl = byId('filterCount');
    var total = (DATA.posts || []).length;
    if (countEl) setText(countEl, t('feed.show') + ' ' + posts.length + ' ' + t('feed.of') + ' ' + t('feed.total') + ' ' + total + ' ' + t('feed.items'));

    var tbody = byId('postBody');
    if (!tbody) return;
    if (!posts.length) {
      setHTML(tbody, '<tr><td colspan="7" class="card-muted">' + t('empty.posts') + '</td></tr>');
      return;
    }
    setHTML(tbody, posts.slice(0, 120).map(function (p) {
      var demo = (p.is_placeholder || p.demo_badge) ? '<span class="pill demo">' + t('badge.demo_ms') + '</span> ' : '';
      var src;
      if (p.source_status === 'xhs_sample_api' || p.source_status === 'xhs_public') src = '<span class="pill src">' + (isEn() ? 'XHS sample' : '小红书样本') + '</span>';
      else if (p.source_status === 'web_informed') src = '<span class="pill src web">Web Informed</span>';
      else src = '<span class="pill demo">' + t('badge.demo_ms') + '</span>';
      var ch = '<span class="pill channel">' + esc(channelLabel(p.source_channel) || p.source_channel || '—') + '</span>';
      var cred = '<span class="pill cred-' + esc(p.credibility || 'medium') + '">' + esc(({ high: t('cred.high'), medium: t('cred.medium'), low: t('cred.low') })[p.credibility] || p.credibility || '') + '</span>';
      var comps = (p.competitors && p.competitors.length) ? p.competitors.join('、') : '—';
      var link = '';
      if (p.url && !/xiaohongshu\.com\/(explore|discovery)/i.test(p.url)) {
        link = ' <a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + t('link') + '</a>';
      }
      return '<tr>' +
        '<td><div class="title">' + demo + esc((isEn() ? (p.title_en || p.title) : (p.title || p.title_en)) || t('no_title')) + '</div>' +
        '<div class="summary">' + esc((isEn() ? (p.summary_en || p.summary) : (p.summary || p.summary_en)) || '') + link + '</div>' +
        (isEn() ? '<div class="card-muted" style="margin-top:4px;font-style:italic">' + t('feed.orig_note') + '</div>' : '') +
        '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">' + platformPill(p) + ch + cred + '</div>' +
        '<div class="card-muted" style="margin-top:4px">' + esc(p.id || '') + '</div></td>' +
        '<td><span class="pill ' + esc(p.sentiment) + '">' + esc(Sent(p.sentiment)) + '</span></td>' +
        '<td>' + esc(L(p.category) || '—') + '</td>' +
        '<td>' + esc(L(p.author_type) || '—') + '<div class="card-muted">' + esc(L(p.segment) || '') + '</div></td>' +
        '<td>' + src + '<div class="card-muted">' + esc(p.published_at || '') + '</div></td>' +
        '<td class="card-muted">' + esc(comps) + '</td>' +
        '</tr>';
    }).join(''));
  }

  function renderMethod() {
    var box = byId('methodBody');
    if (!box) return;
    var m = DATA.meta || {};
    var ms = (I18N ? I18N.mgmt() : null) || DATA.management_summary || {};
    var k = DATA.kpis_clean || {};
    var plats = (DATA.platforms || []).map(function (p) { return L(p.name) + ' ' + p.count; }).join(' · ');
    var disc = I18N ? I18N.metaField('disclaimer', m.disclaimer) : m.disclaimer;
    var gap = I18N ? I18N.metaField('data_gap_note', m.data_gap_note) : m.data_gap_note;
    setHTML(box,
      '<h3>' + t('method.src_ms') + '</h3>' +
      '<ul>' +
      '<li><strong>' + t('method.version') + '</strong>' + esc(m.version || 'multisource') + ' · ' + t('method.version_note') + '</li>' +
      '<li><strong>' + t('method.sample') + '</strong>' + (isEn() ? 'Xiaohongshu public sample ' : '小红书公开内容样本 ') + (k.xhs_sample_count || k.xhs_sample_count || 0) + ' · Web Informed ' + (k.web_informed_count || 0) + ' (Σ ' + ((DATA.posts || []).length) + ')</li>' +
      '<li><strong>' + t('method.plats') + '</strong>' + esc(plats) + '</li>' +
      '<li><strong>' + t('method.updated') + '</strong>' + esc(m.updated_at_display || '') + '</li>' +
      '<li><strong>' + t('method.filter') + '</strong>' + t('method.filter_v') + '</li>' +
      '<li><strong>' + t('method.cred') + '</strong>' + t('method.cred_v') + '</li>' +
      '<li><strong>' + t('method.disclaimer') + '</strong>' + esc(disc || '') + '</li>' +
      '<li><strong>' + t('method.gap') + '</strong>' + esc(gap || '') + '</li>' +
      '</ul>' +
      '<h3>' + t('method.voice') + '</h3>' +
      '<p>' + esc(ms.voice_quality_note || '') + '</p>' +
      '<h3>' + t('method.demo') + '</h3>' +
      '<p>' + t('method.demo_p_ms') + ' <span class="pill demo">' + t('badge.demo_ms') + '</span></p>' +
      '<h3>' + t('method.actions') + '</h3>' +
      '<ul>' + (ms.recommended_actions || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
    );
  }

  function refreshAll(opts) {
    opts = opts || {};
    destroyCharts();
    if (I18N) I18N.applyDom(document);
    safe('header', renderHeader);
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
    if (!opts.skipFilters) safe('filters', initFilters);
    else {
      // re-label filter options without rebinding
      safe('filters', initFilters);
    }
    safe('feed', renderFeed);
    safe('method', renderMethod);
  }

  function boot() {
    if (I18N) {
      I18N.mountToggle();
      I18N.onChange(function () { refreshAll(); });
    }
    safe('tabs', initTabs);
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
