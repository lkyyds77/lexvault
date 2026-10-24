const { performance } = require('node:perf_hooks');
const { scoreChunks, SearchIndex } = require('../src/retrieval');

const clauses = [
  '船舶油污损害赔偿范围包括为防止或者减轻污染损害采取预防措施所发生的费用。',
  '聚众斗殴的首要分子和其他积极参加的处三年以下有期徒刑拘役或者管制。',
  '明知是犯罪的人而为其提供隐藏处所财物帮助其逃匿或者作假证明包庇。',
  '合同当事人应当按照约定全面履行自己的义务并遵循诚信原则。',
  '行政机关作出行政处罚决定前应当告知当事人拟作出的内容及事实理由依据。'
];
const chunks = Array.from({ length: 20000 }, (_, i) => {
  const text = `第${i + 1}条 ${clauses[i % clauses.length]} 本条适用于第${i % 317}类案件以及相关法律责任。`;
  return { id: `c${i}`, docId: `d${i % 500}`, docName: `法规${i % 500}`, index: i, text, searchText: text.toLowerCase() };
});
const queries = ['船舶油污损害赔偿范围', '聚众斗殴法定刑', '包庇犯罪的人', '行政处罚告知义务', '合同全面履行'];
const expectedPhrases = ['船舶油污损害赔偿范围', '聚众斗殴', '包庇', '行政处罚', '合同'];

const measure = (search, rounds = 10) => {
  for (const query of queries) search(query);
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    for (const query of queries) {
      const start = performance.now();
      search(query);
      samples.push(performance.now() - start);
    }
  }
  samples.sort((a, b) => a - b);
  const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
  return { medianMs: percentile(0.5), p95Ms: percentile(0.95), maxMs: samples.at(-1) };
};

if (global.gc) global.gc();
const memoryBefore = process.memoryUsage().heapUsed;
const buildStart = performance.now();
const index = new SearchIndex(chunks);
const buildMs = performance.now() - buildStart;
if (global.gc) global.gc();
const indexMemoryMb = (process.memoryUsage().heapUsed - memoryBefore) / 1024 / 1024;

const linear = measure((query) => scoreChunks(query, chunks, 7));
const indexed = measure((query) => index.search(query, 7));
const accuracy = (search) => queries.reduce((correct, query, i) => correct + Number(search(query, 1)[0]?.text.includes(expectedPhrases[i])), 0) / queries.length;
const result = {
  chunks: chunks.length,
  measuredQueries: queries.length * 10,
  buildMs,
  indexMemoryMb,
  linear,
  indexed,
  linearTop1Accuracy: accuracy((query) => scoreChunks(query, chunks, 1)),
  indexedTop1Accuracy: accuracy((query) => index.search(query, 1)),
  medianSpeedup: linear.medianMs / indexed.medianMs,
  p95Speedup: linear.p95Ms / indexed.p95Ms
};
console.log(JSON.stringify(result, null, 2));
