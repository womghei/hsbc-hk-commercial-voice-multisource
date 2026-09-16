#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'shared', 'data.js');
const code = fs.readFileSync(dataPath, 'utf8');
global.window = {};
eval(code);
const DATA = global.window.HSBC_SL_DATA;
if (!DATA) {
  console.error('FAIL: HSBC_SL_DATA not loaded');
  process.exit(1);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

const posts = DATA.posts || [];
assert(posts.length > 80, 'posts.length > 80 (got ' + posts.length + ')');

const required = ['platform', 'sentiment', 'category', 'author_type'];
let missing = 0;
posts.forEach((p, i) => {
  required.forEach((k) => {
    if (p[k] == null || p[k] === '') {
      missing++;
      if (missing <= 5) console.error('  missing', k, 'on', p.id || i);
    }
  });
  // also recommend source_channel / credibility but hard-require the four
});
assert(missing === 0, 'every post has platform, sentiment, category, author_type');

// source_channel + credibility present
const noCh = posts.filter((p) => !p.source_channel).length;
const noCred = posts.filter((p) => !p.credibility).length;
assert(noCh === 0, 'every post has source_channel');
assert(noCred === 0, 'every post has credibility');

const clean = posts.filter((p) => !p.is_intermediary && !p.is_personal_noise);
const k = DATA.kpis_clean || {};
const diff = Math.abs((k.total_posts || 0) - clean.length);
assert(diff <= 1, 'kpis_clean.total_posts reconciles with filtered posts (±1): kpi=' + k.total_posts + ' clean=' + clean.length);

// sentiment reconcile
const sc = { '正面': 0, '负面': 0, '中性': 0 };
clean.forEach((p) => { sc[p.sentiment] = (sc[p.sentiment] || 0) + 1; });
const sent = DATA.sentiment || {};
const sDiff = Math.abs((sent['正面'] || 0) - sc['正面']) + Math.abs((sent['负面'] || 0) - sc['负面']) + Math.abs((sent['中性'] || 0) - sc['中性']);
assert(sDiff <= 1, 'sentiment counts reconcile with clean posts (±1 total drift)');

const platforms = new Set(posts.map((p) => p.platform));
assert(platforms.size >= 4, 'at least 4 platforms present (got ' + platforms.size + ': ' + [...platforms].join(', ') + ')');

const webInf = posts.filter((p) => p.source_status === 'web_informed').length;
assert(webInf >= 5, 'web_informed count >= 5 (got ' + webInf + ')');

// no invented xhs explore/note fake urls
const badUrls = [];
posts.forEach((p) => {
  const urls = [];
  if (p.url) urls.push(p.url);
  if (Array.isArray(p.related_urls)) urls.push(...p.related_urls);
  urls.forEach((u) => {
    if (!u) return;
    if (/xiaohongshu\.com\/(explore|discovery)\//i.test(u)) badUrls.push(u);
    if (/xiaohongshu\.com\/user\/profile\/fake/i.test(u)) badUrls.push(u);
    // fake note ids in explore-style paths
    if (/xiaohongshu\.com.*\/[0-9a-f]{24}/i.test(u) && /explore|discovery|fake|placeholder|xxxx/i.test(u)) badUrls.push(u);
  });
});
assert(badUrls.length === 0, 'no invented xiaohongshu.com/explore or fake note URLs (bad=' + badUrls.length + ')');

// platform enum check
const allowed = new Set(['小红书', '微博', '知乎', '新闻媒体', '官网/新闻稿', '论坛/社区', '网页其他']);
const badPlat = posts.filter((p) => !allowed.has(p.platform));
assert(badPlat.length === 0, 'all platforms in allowed enum (bad=' + badPlat.length + ')');

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll logic checks passed.');
console.log('posts=', posts.length, 'clean=', clean.length, 'platforms=', [...platforms].join('|'));
const byPlat = {};
posts.forEach((p) => { byPlat[p.platform] = (byPlat[p.platform] || 0) + 1; });
console.log('by_platform=', JSON.stringify(byPlat));
process.exit(0);
