let appState = { settings: {}, documents: [] };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function toast(message) {
  const target = $('#toast');
  target.textContent = message;
  target.classList.add('show');
  setTimeout(() => target.classList.remove('show'), 2800);
}

function showView(id) {
  $$('.view,.nav').forEach((element) => element.classList.toggle('active', element.id === id || element.dataset.view === id));
}

function bytes(value) {
  return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function cleanError(error) {
  return String(error?.message || error).replace(/^Error invoking remote method '[^']+': Error:\s*/, '');
}

function statusClass(status) {
  return status === '现行有效' ? 'valid' : status === '尚未生效' ? 'pending' : /废止|失效|修改/.test(status || '') ? 'invalid' : 'unknown';
}

function renderPrivacy() {
  const local = !!appState.settings.localOnly;
  $('#privacyTitle').textContent = local ? '纯本地模式' : '远程模型模式';
  $('#privacyText').textContent = local ? '文档、问题和检索结果均不离开此设备' : '仅命中片段与问题会发送给模型';
  $('#modeChip').textContent = local ? '纯本地 · 不联网' : `远程精炼 · ${appState.settings.model || '模型'}`;
}

function renderDocs() {
  $('#docCount').textContent = appState.documents.length;
  $('#libraryHint').textContent = appState.documents.length ? `检索 ${appState.documents.length} 份本地文档` : '知识库为空，请先导入资料';
  $('#storageText').textContent = appState.documents.length ? `${appState.documents.length} 份 · ${bytes(appState.documents.reduce((sum, document) => sum + document.size, 0))}` : '';
  $('#docList').innerHTML = appState.documents.length ? appState.documents.map((document) => `
    <div class="doc">
      <div class="doc-icon">${escapeHtml(document.name.split('.').pop().toUpperCase())}</div>
      <div><div class="doc-title"><b>${escapeHtml(document.title || document.name)}</b><span class="status ${statusClass(document.status)}">${escapeHtml(document.status || '未标明')}</span></div>
      <small>公布：${escapeHtml(document.publicationDate || '未标明')} · 施行：${escapeHtml(document.effectiveDate || '未标明')} · 失效：${escapeHtml(document.expiryDate || '未标明')}</small>
      <small>${escapeHtml(document.sourceName || '国家法律法规数据库')} · ${bytes(document.size)} · ${document.chunks} 个片段</small></div>
      <div><button data-open="${escapeHtml(document.path)}" title="打开原文件">↗</button><button data-delete="${document.id}" title="删除">×</button></div>
    </div>`).join('') : '<div class="empty">还没有文档。可导入单个文件，也可一次导入整个文件夹。</div>';
}

function updateRemoteSettingsState() {
  const local = $('#localOnly').checked;
  $('#remoteFields').classList.toggle('disabled', local);
  $('#remoteNotice').classList.toggle('hidden', local);
  $('#testConnectionBtn').disabled = local;
}

async function handleImport(picker) {
  const items = await picker();
  if (!items.length) return;
  const good = items.filter((item) => !item.error && !item.skipped);
  const skipped = items.filter((item) => item.skipped);
  const bad = items.filter((item) => item.error);
  appState = await window.kb.bootstrap();
  renderDocs();
  const parts = [];
  if (good.length) parts.push(`导入 ${good.length} 份`);
  if (skipped.length) parts.push(`跳过重复 ${skipped.length} 份`);
  if (bad.length) parts.push(`失败 ${bad.length} 份`);
  toast(parts.join('，') || '没有找到支持的文档');
}

function sourceMarkup(source) {
  return `<details class="source"><summary><span>[资料${source.n}] ${escapeHtml(source.title)}</span><span class="status ${statusClass(source.status)}">${escapeHtml(source.status)}</span></summary><div class="legal-meta"><span>公布日期：${escapeHtml(source.publicationDate)}</span><span>施行日期：${escapeHtml(source.effectiveDate)}</span><span>失效日期：${escapeHtml(source.expiryDate)}</span></div><div class="original-label">法条原文 · 片段 ${source.index}</div><blockquote>${escapeHtml(source.originalText)}</blockquote><button class="open-file" data-path="${escapeHtml(source.path || '')}">打开本地原文件 ↗</button></details>`;
}

async function init() {
  appState = await window.kb.bootstrap();
  renderDocs();
  renderPrivacy();
  ['baseUrl', 'apiKey', 'model', 'shortcut'].forEach((key) => $('#' + key).value = appState.settings[key] || '');
  $('#autoLaunch').checked = !!appState.settings.autoLaunch;
  $('#localOnly').checked = !!appState.settings.localOnly;
  updateRemoteSettingsState();
  if (appState.configIssue) toast(appState.configIssue);
}

$$('.nav').forEach((button) => button.onclick = () => showView(button.dataset.view));
$$('.go-import').forEach((button) => button.onclick = () => showView('library'));
$('#importBtn').onclick = $('#dropzone').onclick = () => handleImport(window.kb.pickFiles);
$('#folderBtn').onclick = () => handleImport(window.kb.pickFolder);
$('#officialDbBtn').onclick = () => window.kb.openExternal('https://flk.npc.gov.cn/');
$('#localOnly').onchange = updateRemoteSettingsState;

$('#docList').onclick = async (event) => {
  const open = event.target.dataset.open;
  const remove = event.target.dataset.delete;
  if (open) window.kb.openDocument(open);
  if (remove) { await window.kb.deleteDocument(remove); appState = await window.kb.bootstrap(); renderDocs(); }
};

$$('.suggestions button').forEach((button) => button.onclick = () => { $('#question').value = button.textContent; $('#question').focus(); });

$('#askForm').onsubmit = async (event) => {
  event.preventDefault();
  const question = $('#question').value.trim();
  if (!question) return;
  const area = $('#answerArea');
  const button = $('#askButton');
  area.classList.remove('hidden');
  area.innerHTML = '<h3>正在检索本地知识库…</h3>';
  button.disabled = true;
  try {
    const result = await window.kb.ask(question);
    const evidence = result.sources.length ? `<details class="evidence-panel"><summary>查看依据、效力信息与法条原文（${result.sources.length}）</summary><div class="sources"><div class="sources-head"><b>本地命中资料</b><button class="link-button" data-official="https://flk.npc.gov.cn/">国家法律法规数据库 ↗</button></div>${result.sources.map(sourceMarkup).join('')}</div></details>` : '';
    area.innerHTML = `<h3>${result.localOnly ? '本地检索结论' : '知识库结论'}</h3><div class="answer-text">${escapeHtml(result.answer)}</div>${evidence}`;
  } catch (error) {
    area.innerHTML = `<h3>无法完成回答</h3><div class="answer-text">${escapeHtml(cleanError(error))}</div>`;
  } finally { button.disabled = false; }
};

$('#answerArea').onclick = (event) => {
  const fileButton = event.target.closest('[data-path]');
  const officialButton = event.target.closest('[data-official]');
  if (fileButton?.dataset.path) window.kb.openDocument(fileButton.dataset.path);
  if (officialButton) window.kb.openExternal(officialButton.dataset.official);
};

$('#settingsForm').onsubmit = async (event) => {
  event.preventDefault();
  try {
    await window.kb.saveSettings({ localOnly: $('#localOnly').checked, baseUrl: $('#baseUrl').value.trim(), apiKey: $('#apiKey').value.trim(), model: $('#model').value.trim(), shortcut: $('#shortcut').value.trim(), autoLaunch: $('#autoLaunch').checked });
    appState = await window.kb.bootstrap();
    renderPrivacy();
    toast('设置已保存');
  } catch (error) { toast(cleanError(error)); }
};

$('#testConnectionBtn').onclick = async () => {
  const button = $('#testConnectionBtn');
  const result = $('#connectionResult');
  button.disabled = true;
  button.textContent = '正在测试…';
  result.classList.remove('hidden', 'success', 'error');
  try {
    const data = await window.kb.testConnection({ localOnly: $('#localOnly').checked, baseUrl: $('#baseUrl').value.trim(), apiKey: $('#apiKey').value.trim(), model: $('#model').value.trim() });
    $('#baseUrl').value = data.baseUrl;
    $('#model').value = data.model;
    result.textContent = `连接成功 · ${data.model}`;
    result.classList.add('success');
  } catch (error) { result.textContent = cleanError(error); result.classList.add('error'); }
  finally { button.disabled = false; button.textContent = '测试模型连接'; }
};

init();
