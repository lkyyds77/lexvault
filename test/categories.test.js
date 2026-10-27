const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCategories, descendantIds, categoryPath } = require('../src/categories');

test('creates the default legal directory hierarchy', () => {
  const categories = normalizeCategories();
  assert.ok(categories.some((item) => item.id === 'criminal' && item.parentId === null));
  assert.ok(categories.some((item) => item.id === 'criminal-law' && item.parentId === 'criminal'));
  assert.ok(categories.some((item) => item.id === 'crime-property' && item.parentId === 'criminal-law'));
  assert.ok(categories.some((item) => item.id === 'criminal-procedure' && item.parentId === 'criminal'));
});

test('preserves custom nested directories', () => {
  const categories = normalizeCategories([{ id: 'custom', name: '自定义罪名', parentId: 'crime-property' }]);
  assert.equal(categoryPath(categories, 'custom'), '刑事 / 刑法 / 侵犯财产罪 / 自定义罪名');
});

test('includes every nested directory when filtering a parent', () => {
  const categories = normalizeCategories([{ id: 'custom', name: '自定义罪名', parentId: 'crime-property' }]);
  const ids = descendantIds(categories, 'criminal');
  assert.ok(ids.has('criminal-law'));
  assert.ok(ids.has('crime-property'));
  assert.ok(ids.has('custom'));
  assert.ok(!ids.has('civil'));
});

test('moves orphan custom directories to the root', () => {
  const categories = normalizeCategories([{ id: 'orphan', name: '孤立目录', parentId: 'missing' }]);
  assert.equal(categories.find((item) => item.id === 'orphan').parentId, null);
});
