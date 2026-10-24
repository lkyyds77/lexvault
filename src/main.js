const { app, BrowserWindow, ipcMain, dialog, globalShortcut, shell, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { chunkDocument, extractLegalMetadata, scoreChunks } = require('./retrieval');

let win;
const state = { settings: null, library: null, configIssue: '' };
const defaults = { baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: '', shortcut: 'CommandOrControl+Shift+K', autoLaunch: true };
const paths = () => ({ settings: path.join(app.getPath('userData'), 'settings.json'), library: path.join(app.getPath('userData'), 'library.json') });

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function saveJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function normalizeSettings(value) {
  const next = { ...value, baseUrl: String(value.baseUrl || '').trim().replace(/\/$/, ''), model: String(value.model || '').trim() };
  if (next.model.toLowerCase() === 'deepseek') next.model = 'deepseek-flash';
  if (/^deepseek-/i.test(next.model) && /api\.openai\.com/i.test(next.baseUrl)) next.baseUrl = 'https://api.deepseek.com';
  return next;
}
function modelErrorMessage(error, url) {
  const code = error?.cause?.code || error?.code || '';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return `连接模型服务超时：${url}`;
  if (code === 'ENOTFOUND') return `无法解析模型服务域名，请检查 API 地址：${url}`;
  if (code === 'ECONNREFUSED') return `模型服务拒绝连接：${url}`;
  if (code === 'CERT_HAS_EXPIRED' || code.startsWith('ERR_TLS')) return `模型服务证书校验失败（${code}）`;
  return `无法连接模型服务：${url}${code ? `（${code}）` : ''}`;
}
async function loadState() {
  const p = paths();
  const stored = readJson(p.settings, {});
  if (stored.apiKeyEncrypted && await safeStorage.isAsyncEncryptionAvailable()) {
    try { stored.apiKey = (await safeStorage.decryptStringAsync(Buffer.from(stored.apiKeyEncrypted, 'base64'))).result; }
    catch { stored.apiKey = ''; state.configIssue = '原有 API Key 无法解密，请重新输入一次。'; }
  }
  delete stored.apiKeyEncrypted;
  state.settings = normalizeSettings({ ...defaults, ...stored });
  state.library = readJson(p.library, { documents: [], chunks: [] });
  let migrated = false;
  for (const doc of state.library.documents) {
    if (!doc.sourceName) {
      const sample = state.library.chunks.filter((c) => c.docId === doc.id).slice(0, 15).map((c) => c.text).join('\n');
      Object.assign(doc, extractLegalMetadata(sample, doc.name));
      migrated = true;
    }
  }
  if (migrated) saveJson(p.library, state.library);
}
function showWindow() { if (!win) return; win.show(); win.focus(); }
function registerHotkey(accelerator) {
  globalShortcut.unregisterAll();
  try { return globalShortcut.register(accelerator, () => { if (win.isVisible() && win.isFocused()) win.hide(); else showWindow(); }); } catch { return false; }
}
function createWindow() {
  win = new BrowserWindow({ width: 1120, height: 760, minWidth: 860, minHeight: 600, show: false, backgroundColor: '#f3f0e8', titleBarStyle: 'hiddenInset', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
}

app.whenReady().then(async () => {
  await loadState(); createWindow(); registerHotkey(state.settings.shortcut);
  app.setLoginItemSettings({ openAtLogin: !!state.settings.autoLaunch, path: process.execPath });
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});

ipcMain.handle('bootstrap', () => ({ settings: { ...state.settings, apiKey: state.settings.apiKey ? '••••••••' : '' }, documents: state.library.documents, configIssue: state.configIssue }));
ipcMain.handle('save-settings', async (_, incoming) => {
  const next = normalizeSettings({ ...state.settings, ...incoming });
  if (incoming.apiKey === '••••••••') next.apiKey = state.settings.apiKey;
  if (!next.apiKey) throw new Error('请输入模型 API Key');
  if (!registerHotkey(next.shortcut)) { registerHotkey(state.settings.shortcut); throw new Error('快捷键已被其他程序占用'); }
  state.settings = next;
  const diskSettings = { ...next };
  if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('当前系统无法安全保存 API Key');
  diskSettings.apiKeyEncrypted = (await safeStorage.encryptStringAsync(next.apiKey)).toString('base64');
  delete diskSettings.apiKey;
  saveJson(paths().settings, diskSettings);
  state.configIssue = '';
  app.setLoginItemSettings({ openAtLogin: !!next.autoLaunch, path: process.execPath });
  return true;
});
ipcMain.handle('test-connection', async (_, incoming) => {
  const candidate = normalizeSettings({ ...state.settings, ...incoming });
  if (incoming.apiKey === '••••••••') candidate.apiKey = state.settings.apiKey;
  if (!candidate.apiKey) throw new Error('请输入模型 API Key');
  let response;
  const url = candidate.baseUrl + '/models';
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${candidate.apiKey}` }, signal: AbortSignal.timeout(15000) });
  } catch (error) { throw new Error(modelErrorMessage(error, url)); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `连接失败（HTTP ${response.status}）`);
  const models = (data.data || []).map((item) => item.id);
  if (models.length && !models.includes(candidate.model)) throw new Error(`连接成功，但模型“${candidate.model}”不可用。可用模型：${models.join('、')}`);
  return { baseUrl: candidate.baseUrl, model: candidate.model, models };
});
ipcMain.handle('pick-files', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: '支持的文档', extensions: ['pdf', 'docx', 'txt', 'md'] }] });
  if (result.canceled) return [];
  const imported = [];
  for (const file of result.filePaths) {
    const ext = path.extname(file).toLowerCase();
    let text = '';
    try {
      if (ext === '.pdf') text = (await pdf(fs.readFileSync(file))).text;
      else if (ext === '.docx') text = (await mammoth.extractRawText({ path: file })).value;
      else text = fs.readFileSync(file, 'utf8');
      if (!text.trim()) throw new Error('未提取到文本（扫描版 PDF 需要先 OCR）');
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const metadata = extractLegalMetadata(text, path.basename(file));
      const doc = { id, name: path.basename(file), path: file, size: fs.statSync(file).size, addedAt: new Date().toISOString(), chunks: 0, ...metadata };
      const chunks = chunkDocument(text).map((body, index) => ({ id: `${id}-${index}`, docId: id, docName: doc.name, docTitle: doc.title, index, text: body, searchText: body.toLowerCase() }));
      doc.chunks = chunks.length;
      state.library.documents.unshift(doc); state.library.chunks.push(...chunks); imported.push(doc);
    } catch (error) { imported.push({ name: path.basename(file), error: error.message }); }
  }
  saveJson(paths().library, state.library);
  return imported;
});
ipcMain.handle('delete-document', (_, id) => {
  state.library.documents = state.library.documents.filter((d) => d.id !== id);
  state.library.chunks = state.library.chunks.filter((c) => c.docId !== id);
  saveJson(paths().library, state.library); return true;
});
ipcMain.handle('open-document', (_, file) => shell.openPath(file));
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('ask', async (_, question) => {
  if (!state.settings.apiKey) throw new Error('请先完成模型 API 配置');
  const hits = scoreChunks(question, state.library.chunks, 7);
  if (!hits.length) return { answer: '知识库中未找到与此问题相关的内容。', sources: [] };
  const context = hits.map((h, i) => {
    const d = state.library.documents.find((doc) => doc.id === h.docId) || {};
    return `[资料 ${i + 1}]\n法规名称：${d.title || d.name || h.docName}\n时效性：${d.status || '未标明'}\n公布日期：${d.publicationDate || '未标明'}\n施行日期：${d.effectiveDate || '未标明'}\n失效日期：${d.expiryDate || '未标明'}\n制定机关：${d.authority || '未标明'}\n来源：${d.sourceName || '国家法律法规数据库'}\n原文片段：\n${h.text}`;
  }).join('\n\n');
  const sources = hits.map((h, i) => { const d = state.library.documents.find((doc) => doc.id === h.docId) || {}; return { n: i + 1, docName: h.docName, title: d.title || h.docName, index: h.index + 1, originalText: h.text, path: d.path, status: d.status || '未标明', publicationDate: d.publicationDate || '未标明', effectiveDate: d.effectiveDate || '未标明', expiryDate: d.expiryDate || '未标明', sourceName: d.sourceName || '国家法律法规数据库', sourceUrl: d.sourceUrl || 'https://flk.npc.gov.cn/' }; });
  const body = { model: state.settings.model, temperature: 0, messages: [
    { role: 'system', content: '你是严格的中国法律法规知识库检索助手。只能根据用户提供的“知识库资料”回答，绝对禁止使用常识、训练数据或推测补充。若资料不足以支持结论，明确回答“知识库资料不足以回答此问题”。必须按以下结构回答：一、结论；二、效力信息（法规名称、时效性、公布日期、施行日期、失效日期；资料未标明的字段必须写“资料未标明”，不得猜测）；三、相关法条原文（逐字引用知识库原文，不得改写）；四、出处。每个关键结论后标注[资料N]。若资料显示已修改或已废止，必须在回答开头醒目标注风险。' },
    { role: 'user', content: `问题：${question}\n\n知识库资料：\n${context}` }
  ] };
  const url = state.settings.baseUrl.replace(/\/$/, '') + '/chat/completions';
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.settings.apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  } catch (error) {
    const message = modelErrorMessage(error, url);
    return { answer: `已在本地知识库找到 ${sources.length} 个相关法条片段，但模型服务暂时不可用。你仍可在下方查看命中的法条原文。\n\n诊断信息：${message}`, sources, modelError: message };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `模型请求失败（HTTP ${response.status}）`;
    return { answer: `已在本地知识库找到 ${sources.length} 个相关法条片段，但模型服务返回错误。你仍可在下方查看命中的法条原文。\n\n诊断信息：${message}`, sources, modelError: message };
  }
  return { answer: data.choices?.[0]?.message?.content || '模型未返回内容', sources };
});
