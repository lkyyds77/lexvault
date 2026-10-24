const test = require('node:test');
const assert = require('node:assert/strict');
const { chunkText, chunkDocument, extractLegalMetadata, scoreChunks, SearchIndex } = require('../src/retrieval');
test('chunks long documents and preserves content', () => { const chunks = chunkText('第一段内容。\n' + '法律条文'.repeat(400), 200, 20); assert.ok(chunks.length > 1); assert.match(chunks[0], /第一段/); });
test('ranks Chinese legal phrase', () => { const chunks = [{ text:'包庇罪是指明知是犯罪的人而为其提供隐藏处所。', searchText:'包庇罪是指明知是犯罪的人而为其提供隐藏处所。' }, { text:'这是民事合同内容。', searchText:'这是民事合同内容。' }]; const hits = scoreChunks('包庇罪的构成要件是什么', chunks); assert.equal(hits[0].text, chunks[0].text); });
test('returns empty when no knowledge matches', () => { assert.deepEqual(scoreChunks('聚众斗殴罪', [{ text:'天气晴朗', searchText:'天气晴朗' }]), []); });
test('splits legal documents on article boundaries', () => {
  const chunks = chunkDocument('中华人民共和国测试法\n第一条 总则。\n第二条 规则。\n第三条 罚则。');
  assert.equal(chunks.length, 4);
  assert.match(chunks[2], /^第二条/);
});
test('extracts official legal metadata without guessing missing values', () => {
  const meta = extractLegalMetadata('标题：中华人民共和国测试法\n时效性：已废止\n公布日期：2020-01-02\n施行日期：2020-03-01\n失效日期：2025-06-01\n制定机关：全国人民代表大会', 'test.docx');
  assert.equal(meta.title, '中华人民共和国测试法');
  assert.equal(meta.status, '已废止');
  assert.equal(meta.effectiveDate, '2020-03-01');
  assert.equal(meta.expiryDate, '2025-06-01');
  assert.equal(meta.sourceName, '国家法律法规数据库');
});
test('marks absent status as unknown', () => {
  const meta = extractLegalMetadata('中华人民共和国示例法\n第一条 内容。', '示例法.pdf');
  assert.equal(meta.status, '未标明');
  assert.equal(meta.effectiveDate, '未标明');
});
test('indexed search ranks the matching legal article first', () => {
  const chunks = [
    { index: 0, text: '第九条 船舶油污损害赔偿范围包括预防措施费用和财产损害。' },
    { index: 1, text: '第十条 合同当事人应当全面履行自己的义务。' },
    { index: 2, text: '第十一条 行政机关应当依法作出行政处罚。' }
  ];
  const hits = new SearchIndex(chunks).search('船舶油污损害赔偿范围', 2);
  assert.equal(hits[0].index, 0);
  assert.ok(hits[0].score > 0);
});
test('indexed search can rebuild after library changes', () => {
  const index = new SearchIndex([{ index: 0, text: '民事合同规则' }]);
  assert.equal(index.search('聚众斗殴').length, 0);
  index.rebuild([{ index: 1, text: '聚众斗殴罪法定刑' }]);
  assert.equal(index.search('聚众斗殴')[0].index, 1);
});
