const DEFAULT_CATEGORIES = [
  { id: 'criminal', name: '刑事', parentId: null, system: true },
  { id: 'criminal-law', name: '刑法', parentId: 'criminal', system: true },
  { id: 'criminal-law-general', name: '刑法总则', parentId: 'criminal-law', system: true },
  { id: 'crime-national-security', name: '危害国家安全罪', parentId: 'criminal-law', system: true },
  { id: 'crime-public-security', name: '危害公共安全罪', parentId: 'criminal-law', system: true },
  { id: 'crime-market-order', name: '破坏社会主义市场经济秩序罪', parentId: 'criminal-law', system: true },
  { id: 'crime-personal-rights', name: '侵犯公民人身权利、民主权利罪', parentId: 'criminal-law', system: true },
  { id: 'crime-property', name: '侵犯财产罪', parentId: 'criminal-law', system: true },
  { id: 'crime-social-order', name: '妨害社会管理秩序罪', parentId: 'criminal-law', system: true },
  { id: 'crime-national-defense', name: '危害国防利益罪', parentId: 'criminal-law', system: true },
  { id: 'crime-corruption', name: '贪污贿赂罪', parentId: 'criminal-law', system: true },
  { id: 'crime-dereliction', name: '渎职罪', parentId: 'criminal-law', system: true },
  { id: 'crime-military-duty', name: '军人违反职责罪', parentId: 'criminal-law', system: true },
  { id: 'criminal-procedure', name: '刑事诉讼法', parentId: 'criminal', system: true },
  { id: 'civil', name: '民事', parentId: null, system: true },
  { id: 'public-interest', name: '公益诉讼', parentId: null, system: true },
  { id: 'case-management', name: '案管', parentId: null, system: true }
];

function normalizeCategories(categories = []) {
  const result = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const positions = new Map(result.map((category, index) => [category.id, index]));
  for (const value of Array.isArray(categories) ? categories : []) {
    const id = String(value?.id || '').trim();
    const name = String(value?.name || '').trim();
    if (!id || !name) continue;
    const category = { id, name: name.slice(0, 40), parentId: value.parentId || null, system: !!value.system };
    if (positions.has(id)) result[positions.get(id)] = { ...result[positions.get(id)], ...category };
    else { positions.set(id, result.length); result.push(category); }
  }
  const ids = new Set(result.map((category) => category.id));
  for (const category of result) if (category.parentId && !ids.has(category.parentId)) category.parentId = null;
  return result;
}

function descendantIds(categories, categoryId) {
  const found = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId && found.has(category.parentId) && !found.has(category.id)) { found.add(category.id); changed = true; }
    }
  }
  return found;
}

function categoryPath(categories, categoryId) {
  if (!categoryId) return '未分类';
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names = [];
  const seen = new Set();
  let current = byId.get(categoryId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return names.join(' / ') || '未分类';
}

module.exports = { DEFAULT_CATEGORIES, normalizeCategories, descendantIds, categoryPath };
