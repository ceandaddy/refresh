'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractContent, parseEvent } = require('../lib/notion-content');
const handler = require('../api/notion');

const block = (type, text, extra = {}) => ({
  type, [type]: { rich_text: [{ plain_text: text }] }, ...extra
});
const entry = '"start": "2026-12-24", "end": "2026-12-25", "category": "행사", "place": "기념일", "memo": ""';

test('parses current bullet format, balanced braces and stray closing braces', () => {
  for (const text of [entry, '{' + entry + '}', entry + ' }', entry + ' \\}', entry.replaceAll('"', '”')]) {
    assert.equal(parseEvent(text).end, '2026-12-25');
  }
  assert.equal(parseEvent('"start": "2026-10-22", "category": "행사", "place": "약속"').end, '2026-10-22');
});

test('rejects invalid dates, reversed ranges and missing required fields', () => {
  for (const text of [
    entry.replace('2026-12-24', '2026-02-30'),
    entry.replace('2026-12-25', '2026-12-23'),
    entry.replace('"place": "기념일"', '"place": ""'),
    entry.replace('"2026-12-24"', '"tomorrow"')
  ]) assert.throws(() => parseEvent(text));
});

test('keeps requested sections separate and never includes unrelated content', () => {
  const content = extractContent([
    block('paragraph', 'unrelated before sections'),
    block('heading_2', 'Follow up'), block('bulleted_list_item', 'First task'),
    block('heading_2', 'Private notes'), block('paragraph', 'must not appear'),
    block('heading_2', 'Schedule'), block('bulleted_list_item', entry),
    block('bulleted_list_item', 'invalid entry'),
    block('heading_2', 'Other'), block('paragraph', entry)
  ]);
  assert.deepEqual(content.followup, ['First task']);
  assert.equal(content.events.length, 1);
  assert.equal(content.warnings.length, 1);
  assert.match(content.warnings[0], /2번째/);
  assert(!JSON.stringify(content).includes('must not appear'));
});

test('distinguishes an empty section from a missing heading', () => {
  assert.equal(extractContent([block('heading_2', 'followup'), block('heading_2', 'Schedule')]).warnings.length, 0);
  assert.equal(extractContent([]).warnings.length, 2);
});

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('API handles configuration, pagination, fresh reads and upstream failure', async (t) => {
  const oldToken = process.env.NOTION_TOKEN;
  const oldPage = process.env.NOTION_PAGE_ID;
  t.after(() => {
    if (oldToken === undefined) delete process.env.NOTION_TOKEN; else process.env.NOTION_TOKEN = oldToken;
    if (oldPage === undefined) delete process.env.NOTION_PAGE_ID; else process.env.NOTION_PAGE_ID = oldPage;
  });
  delete process.env.NOTION_TOKEN;
  delete process.env.NOTION_PAGE_ID;
  let res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 503);

  process.env.NOTION_TOKEN = 'test-only-token';
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    const secondPage = url.searchParams.get('start_cursor') === 'next';
    return { ok: true, json: async () => secondPage
      ? { results: [block('heading_2', 'Schedule'), block('bulleted_list_item', entry)], has_more: false }
      : { results: [block('heading_2', 'followup'), block('bulleted_list_item', 'Task ' + calls)], has_more: true, next_cursor: 'next' } };
  });
  res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.events.length, 1);
  assert.deepEqual(res.body.followup, ['Task 1']);
  assert.equal(calls, 2);
  res = response();
  await handler({ method: 'GET' }, res);
  assert.deepEqual(res.body.followup, ['Task 3']);

  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 403 }));
  res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 503);
  assert(!JSON.stringify(res.body).includes('test-only-token'));

  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 429 }));
  res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 502);
});

test('API permits GET only', async () => {
  const res = response();
  await handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});
