const STOP = new Set('的了和是在有与及或为对从中等一个本其该这那到由按'.split(''));

function tokenize(text) {
  const source = String(text || '').toLowerCase();
  const words = source.match(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2,}/g) || [];
  const tokens = [];
  for (const word of words) {
    if (/^[\u4e00-\u9fff]+$/.test(word)) {
      for (let n = 2; n <= Math.min(4, word.length); n++) {
        for (let i = 0; i <= word.length - n; i++) {
          const token = word.slice(i, i + n);
          if (!STOP.has(token)) tokens.push(token);
        }
      }
    } else tokens.push(word);
  }
  return tokens;
}

function chunkText(text, size = 850, overlap = 130) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n+/).filter(Boolean);
  const chunks = [];
  let buffer = '';
  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length > size) {
      chunks.push(buffer.trim());
      buffer = buffer.slice(-overlap) + '\n' + paragraph;
    } else buffer += (buffer ? '\n' : '') + paragraph;
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

function chunkDocument(text) {
  const clean = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const article = /第[零〇一二三四五六七八九十百千万两0-9]+条(?:之[零〇一二三四五六七八九十百千万两0-9]+)?/g;
  const matches = [...clean.matchAll(article)];
  if (matches.length < 3) return chunkText(clean);
  const chunks = [];
  const preamble = clean.slice(0, matches[0].index).trim();
  if (preamble) chunks.push(...chunkText(preamble));
  for (let i = 0; i < matches.length; i++) {
    const body = clean.slice(matches[i].index, matches[i + 1]?.index ?? clean.length).trim();
    if (body.length <= 1800) chunks.push(body);
    else chunks.push(...chunkText(body, 1200, 160));
  }
  return chunks;
}

function extractLegalMetadata(text, filename = '') {
  const source = String(text || '').slice(0, 12000).replace(/[ \t]+/g, ' ');
  const value = (patterns) => {
    for (const pattern of patterns) {
      const hit = source.match(pattern);
      if (hit?.[1]) return hit[1].trim();
    }
    return '';
  };
  const datePatterns = (label) => [
    new RegExp(`${label}[：:\\s]*([12]\\d{3}[-./][01]?\\d[-./][0-3]?\\d)`),
    new RegExp(`${label}[：:\\s]*([12]\\d{3}年[01]?\\d月[0-3]?\\d日)`)
  ];
  let title = value([/(?:标题|法规名称)[：:]\s*([^\n]{2,80})/]);
  if (!title) {
    const first = source.split(/\n+/).map((s) => s.trim()).find((s) => s.length >= 4 && s.length <= 60 && !/^(目录|国家法律法规数据库|公布日期|施行日期)/.test(s));
    title = first || filename.replace(/\.(pdf|docx|txt|md)$/i, '');
  }
  let status = value([/(?:时效性|效力状态|时效状态)[：:]\s*(尚未生效|现行有效|有效|已修改|已废止|废止|失效|部分失效)/]);
  if (status === '有效') status = '现行有效';
  if (status === '废止' || status === '失效') status = '已废止';
  return {
    title,
    status: status || '未标明',
    publicationDate: value(datePatterns('(?:公布日期|发布日期|颁布日期)')) || '未标明',
    effectiveDate: value(datePatterns('(?:施行日期|实施日期|生效日期)')) || '未标明',
    expiryDate: value(datePatterns('(?:失效日期|废止日期)')) || '未标明',
    authority: value([/(?:制定机关|发布部门|颁布机关)[：:]\s*([^\n]{2,80})/]) || '未标明',
    category: value([/(?:法律法规分类|效力级别|法律效力位阶)[：:]\s*([^\n]{1,40})/]) || '未标明',
    sourceName: '国家法律法规数据库',
    sourceUrl: 'https://flk.npc.gov.cn/'
  };
}

function scoreChunks(query, chunks, limit = 6) {
  const q = tokenize(query);
  if (!q.length) return [];
  const unique = [...new Set(q)];
  return chunks.map((chunk) => {
    const hay = chunk.searchText || chunk.text.toLowerCase();
    let score = 0;
    for (const token of unique) {
      const count = hay.split(token).length - 1;
      if (count) score += (1 + Math.log(count)) * (1 + Math.min(token.length, 4));
    }
    const exact = String(query).replace(/\s/g, '').toLowerCase();
    if (exact.length > 1 && hay.replace(/\s/g, '').includes(exact)) score += 20;
    return { ...chunk, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

class SearchIndex {
  constructor(chunks = []) {
    this.rebuild(chunks);
  }

  rebuild(chunks = []) {
    this.chunks = chunks;
    this.postings = new Map();
    this.lengths = new Uint32Array(chunks.length);
    this.normalized = new Array(chunks.length);
    let totalLength = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const source = chunk.searchText || String(chunk.text || '').toLowerCase();
      const tokens = tokenize(source);
      const counts = new Map();
      for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
      this.lengths[chunkIndex] = tokens.length;
      this.normalized[chunkIndex] = source.replace(/\s/g, '');
      totalLength += tokens.length;
      for (const [token, frequency] of counts) {
        let posting = this.postings.get(token);
        if (!posting) this.postings.set(token, posting = []);
        posting.push(chunkIndex, frequency);
      }
    }

    for (const [token, posting] of this.postings) this.postings.set(token, Uint32Array.from(posting));

    this.averageLength = chunks.length ? totalLength / chunks.length : 1;
    this.scoreBuffer = new Float64Array(chunks.length);
    this.markBuffer = new Uint32Array(chunks.length);
    this.searchGeneration = 0;
    return this;
  }

  search(query, limit = 6) {
    if (limit <= 0) return [];
    const queryTokens = tokenize(query);
    if (!queryTokens.length || !this.chunks.length) return [];
    const queryCounts = new Map();
    for (const token of queryTokens) queryCounts.set(token, (queryCounts.get(token) || 0) + 1);

    this.searchGeneration++;
    if (this.searchGeneration === 0xffffffff) { this.markBuffer.fill(0); this.searchGeneration = 1; }
    const generation = this.searchGeneration;
    const touched = [];
    const total = this.chunks.length;
    const averageLength = this.averageLength || 1;
    const k1 = 1.35;
    const b = 0.68;
    for (const [token, queryFrequency] of queryCounts) {
      const posting = this.postings.get(token);
      if (!posting) continue;
      const documentFrequency = posting.length / 2;
      const inverseDocumentFrequency = Math.log(1 + (total - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const queryWeight = (1 + Math.log(queryFrequency)) * (1 + Math.min(token.length, 4) * 0.2);
      for (let i = 0; i < posting.length; i += 2) {
        const chunkIndex = posting[i];
        const termFrequency = posting[i + 1];
        const lengthRatio = this.lengths[chunkIndex] / averageLength;
        const termScore = inverseDocumentFrequency * ((termFrequency * (k1 + 1)) / (termFrequency + k1 * (1 - b + b * lengthRatio))) * queryWeight;
        if (this.markBuffer[chunkIndex] !== generation) {
          this.markBuffer[chunkIndex] = generation;
          this.scoreBuffer[chunkIndex] = termScore;
          touched.push(chunkIndex);
        } else this.scoreBuffer[chunkIndex] += termScore;
      }
    }

    if (!touched.length) return [];
    const exact = String(query).replace(/\s/g, '').toLowerCase();
    const top = [];
    for (const chunkIndex of touched) {
      let score = this.scoreBuffer[chunkIndex];
      if (exact.length > 1 && this.normalized[chunkIndex].includes(exact)) score += 20;
      if (top.length < limit || score > top[top.length - 1].score) {
        top.push({ chunkIndex, score });
        top.sort((a, b) => b.score - a.score || (this.chunks[a.chunkIndex].index ?? a.chunkIndex) - (this.chunks[b.chunkIndex].index ?? b.chunkIndex));
        if (top.length > limit) top.pop();
      }
    }
    return top.map(({ chunkIndex, score }) => ({ ...this.chunks[chunkIndex], score }));
  }
}

module.exports = { tokenize, chunkText, chunkDocument, extractLegalMetadata, scoreChunks, SearchIndex };
