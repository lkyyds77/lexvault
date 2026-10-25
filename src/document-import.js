const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const WordExtractor = require('word-extractor');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.txt', '.md']);
const wordExtractor = new WordExtractor();

function isSupportedFile(file) {
  return SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function canonicalPath(file) {
  return path.resolve(file).replace(/\\/g, '/').toLowerCase();
}

function collectSupportedFiles(directory) {
  const files = [];
  const pending = [path.resolve(directory)];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && isSupportedFile(target)) files.push(target);
    }
  }
  return files.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

async function extractDocumentText(file) {
  const ext = path.extname(file).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) throw new Error(`不支持 ${ext || '未知'} 格式`);
  if (ext === '.pdf') return (await pdf(fs.readFileSync(file))).text;
  if (ext === '.docx') return (await mammoth.extractRawText({ path: file })).value;
  if (ext === '.doc') return (await wordExtractor.extract(file)).getBody();
  return fs.readFileSync(file, 'utf8');
}

module.exports = { SUPPORTED_EXTENSIONS, isSupportedFile, canonicalPath, collectSupportedFiles, extractDocumentText };
