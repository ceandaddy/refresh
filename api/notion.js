'use strict';

const { blockText, sectionName, extractContent } = require('../lib/notion-content');
const DEFAULT_PAGE_ID = '3befd6b6-3b07-80fd-9c0f-fc14838a1d87';

async function readBlocks(blockId, token, signal) {
  const blocks = [];
  let cursor;
  const cursors = new Set();
  do {
    const url = new URL('https://api.notion.com/v1/blocks/' + encodeURIComponent(blockId) + '/children');
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2025-09-03' },
      signal
    });
    if (!response.ok) {
      const error = new Error('Notion request failed');
      error.upstreamStatus = response.status;
      throw error;
    }
    const page = await response.json();
    if (!Array.isArray(page.results)) throw new Error('Invalid Notion response');
    blocks.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
    if (page.has_more && (!cursor || cursors.has(cursor))) throw new Error('Invalid Notion pagination');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return blocks;
}

async function readContent(pageId, token, signal) {
  const topLevel = await readBlocks(pageId, token, signal);
  const blocks = [];
  let section = null;
  let level = 0;

  async function appendChildren(block, depth) {
    if (!block.has_children || !['bulleted_list_item', 'numbered_list_item', 'to_do', 'paragraph',
      'heading_1', 'heading_2', 'heading_3'].includes(block.type)) return;
    if (depth > 10) throw new Error('Notion content is too deeply nested');
    for (const child of await readBlocks(block.id, token, signal)) {
      // Child pages are never traversed, and nested headings cannot change section scope.
      if (/^heading_/.test(child.type)) continue;
      blocks.push(child);
      await appendChildren(child, depth + 1);
    }
  }

  for (const block of topLevel) {
    if (block.archived || block.in_trash) continue;
    const heading = /^heading_([123])$/.exec(block.type);
    if (heading) {
      const target = sectionName(blockText(block));
      if (target) { section = target; level = Number(heading[1]); }
      else if (Number(heading[1]) <= level) section = null;
    }
    blocks.push(block);
    if (section) await appendChildren(block, 0);
  }
  return extractContent(blocks);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const token = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_PAGE_ID || DEFAULT_PAGE_ID;
  if (!token) return res.status(503).json({ error: 'NOTION_NOT_CONFIGURED' });
  if (!/^[0-9a-f]{32}$|^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pageId)) {
    return res.status(503).json({ error: 'NOTION_NOT_CONFIGURED' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const content = await readContent(pageId, token, controller.signal);
    return res.status(200).json(content);
  } catch (error) {
    // Do not return tokens, raw page content, or upstream responses to visitors.
    const configurationError = [401, 403, 404].includes(error.upstreamStatus);
    return res.status(configurationError ? 503 : 502).json({
      error: configurationError ? 'NOTION_NOT_CONFIGURED' : 'NOTION_UNAVAILABLE'
    });
  } finally {
    clearTimeout(timer);
  }
};
