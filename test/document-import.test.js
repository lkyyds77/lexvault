const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isSupportedFile, canonicalPath, collectSupportedFiles, extractDocumentText } = require('../src/document-import');

test('recognizes legacy Word and current supported document formats', () => {
  for (const name of ['law.doc', 'law.docx', 'law.pdf', 'law.txt', 'law.md']) assert.equal(isSupportedFile(name), true);
  assert.equal(isSupportedFile('law.exe'), false);
});

test('recursively collects supported files and ignores unrelated files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexvault-import-'));
  try {
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'a.doc'), 'placeholder');
    fs.writeFileSync(path.join(root, 'nested', 'b.txt'), '第二条 测试');
    fs.writeFileSync(path.join(root, 'ignored.exe'), 'x');
    const files = collectSupportedFiles(root);
    assert.equal(files.length, 2);
    assert.ok(files.some((file) => file.endsWith('a.doc')));
    assert.ok(files.some((file) => file.endsWith('b.txt')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('extracts local plain text without network access', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexvault-text-'));
  const file = path.join(root, 'law.txt');
  try {
    fs.writeFileSync(file, '第一条 本地法规。', 'utf8');
    assert.equal(await extractDocumentText(file), '第一条 本地法规。');
    assert.equal(canonicalPath(file), canonicalPath(path.resolve(file)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
