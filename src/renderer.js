let appState = { settings: {}, documents: [] };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function toast(message) { const t = $('#toast'); t.textContent = message; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function showView(id) { $$('.view,.nav').forEach((el) => el.classList.toggle('active', el.id === id || el.dataset.view === id)); }
function bytes(n) { return n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`; }
function renderDocs() {
  $('#docCount').textContent = appState.documents.length;
  $('#libraryHint').textContent = appState.documents.length ? `正在检索 ${appState.documents.length} 份本地文档` : '知识库为空，请先导入资料';
  $('#storageText').textContent = appState.documents.length ? `${appState.documents.length} 份 · ${bytes(appState.documents.reduce((a, d) => a + d.size, 0))}` : '';
  $('#docList').innerHTML = appState.documents.length ? appState.documents.map((d) => `<div class="doc"><div class="doc-icon">${d.name.split('.').pop().toUpperCase()}</div><div><div class="doc-title"><b>${escapeHtml(d.title || d.name)}</b><span class="status ${statusClass(d.status)}">${escapeHtml(d.status || '未标明')}</span></div><small>公布：${escapeHtml(d.publicationDate || '未标明')} · 施行：${escapeHtml(d.effectiveDate || '未标明')} · 失效：${escapeHtml(d.expiryDate || '未标明')}</small><small>${escapeHtml(d.sourceName || '国家法律法规数据库')} · ${bytes(d.size)} · ${d.chunks} 个法条片段</small></div><div><button data-open="${escapeHtml(d.path)}" title="打开原文件">↗</button><button data-delete="${d.id}" title="删除">×</button></div></div>`).join('') : '<div class="empty">还没有法规文档，请从国家法律法规数据库下载并导入。</div>';
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function statusClass(status) { return status === '现行有效' ? 'valid' : status === '尚未生效' ? 'pending' : /废止|失效|修改/.test(status || '') ? 'invalid' : 'unknown'; }
async function importFiles() {
  const items = await window.kb.pickFiles(); if (!items.length) return;
  const good = items.filter((i) => !i.error), bad = items.filter((i) => i.error);
  appState = await window.kb.bootstrap(); renderDocs();
  toast(good.length ? `已导入 ${good.length} 份文档${bad.length ? `，${bad.length} 份失败` : ''}` : bad[0]?.error || '导入失败');
}
async function init() {
  appState = await window.kb.bootstrap(); renderDocs();
  ['baseUrl','apiKey','model','shortcut'].forEach((key) => $('#' + key).value = appState.settings[key] || '');
  $('#autoLaunch').checked = !!appState.settings.autoLaunch;
  if (!appState.settings.apiKey) { if (appState.configIssue) $('#onboardingMessage').textContent = appState.configIssue + ' 密钥仍只保存在本机。'; $('#onboarding').classList.remove('hidden'); }
}
$$('.nav').forEach((b) => b.onclick = () => showView(b.dataset.view));
$$('.go-import').forEach((b) => b.onclick = () => showView('library'));
$('#importBtn').onclick = $('#dropzone').onclick = importFiles;
$('#officialDbBtn').onclick = () => window.kb.openExternal('https://flk.npc.gov.cn/');
$('#docList').onclick = async (e) => { const open = e.target.dataset.open, del = e.target.dataset.delete; if (open) window.kb.openDocument(open); if (del) { await window.kb.deleteDocument(del); appState = await window.kb.bootstrap(); renderDocs(); } };
$$('.suggestions button').forEach((b) => b.onclick = () => { $('#question').value = b.textContent; $('#question').focus(); });
$('#askForm').onsubmit = async (e) => {
  e.preventDefault(); const question = $('#question').value.trim(); if (!question) return;
  const area = $('#answerArea'), btn = $('#askButton'); area.classList.remove('hidden'); area.innerHTML = '<h3>正在检索知识库…</h3>'; btn.disabled = true;
  try { const result = await window.kb.ask(question); area.innerHTML = `<h3>知识库回答</h3><div class="answer-text">${escapeHtml(result.answer)}</div>${result.sources.length ? `<div class="sources"><div class="sources-head"><b>法条原文与官方出处</b><button class="link-button" data-official="https://flk.npc.gov.cn/">国家法律法规数据库 ↗</button></div>${result.sources.map((s) => `<details class="source"><summary><span>[资料${s.n}] ${escapeHtml(s.title)}</span><span class="status ${statusClass(s.status)}">${escapeHtml(s.status)}</span></summary><div class="legal-meta"><span>公布日期：${escapeHtml(s.publicationDate)}</span><span>施行日期：${escapeHtml(s.effectiveDate)}</span><span>失效日期：${escapeHtml(s.expiryDate)}</span></div><div class="original-label">原文 · 片段 ${s.index}</div><blockquote>${escapeHtml(s.originalText)}</blockquote><button class="open-file" data-path="${escapeHtml(s.path || '')}">打开本地官方文件 ↗</button></details>`).join('')}</div>` : ''}`; }
  catch (err) { area.innerHTML = `<h3>无法完成回答</h3>${escapeHtml(err.message)}`; } finally { btn.disabled = false; }
};
$('#answerArea').onclick = (e) => { const button = e.target.closest('[data-path]'); const official = e.target.closest('[data-official]'); if (button?.dataset.path) window.kb.openDocument(button.dataset.path); if (official) window.kb.openExternal(official.dataset.official); };
$('#settingsForm').onsubmit = async (e) => { e.preventDefault(); try { await window.kb.saveSettings({ baseUrl:$('#baseUrl').value.trim(), apiKey:$('#apiKey').value.trim(), model:$('#model').value.trim(), shortcut:$('#shortcut').value.trim(), autoLaunch:$('#autoLaunch').checked }); toast('设置已保存'); } catch(err) { toast(err.message); } };
$('#testConnectionBtn').onclick = async () => {
  const button = $('#testConnectionBtn'), result = $('#connectionResult'); button.disabled = true; button.textContent = '正在测试…'; result.classList.remove('hidden','success','error');
  try { const data = await window.kb.testConnection({ baseUrl:$('#baseUrl').value.trim(), apiKey:$('#apiKey').value.trim(), model:$('#model').value.trim() }); $('#baseUrl').value = data.baseUrl; $('#model').value = data.model; result.textContent = `连接成功 · ${data.model}`; result.classList.add('success'); }
  catch (err) { result.textContent = String(err.message).replace(/^Error invoking remote method '[^']+': Error:\s*/, ''); result.classList.add('error'); }
  finally { button.disabled = false; button.textContent = '测试模型连接'; }
};
$('#firstForm').onsubmit = async (e) => { e.preventDefault(); try { await window.kb.saveSettings({ baseUrl:$('#firstBaseUrl').value.trim(), apiKey:$('#firstApiKey').value.trim(), model:$('#firstModel').value.trim(), shortcut:'CommandOrControl+Shift+K', autoLaunch:true }); $('#onboarding').classList.add('hidden'); appState = await window.kb.bootstrap(); ['baseUrl','apiKey','model','shortcut'].forEach((k) => $('#'+k).value = appState.settings[k] || ''); toast('配置完成，欢迎使用律知库'); } catch(err) { toast(err.message); } };
init();
