'use strict';

function blockText(block) {
  const richText = block[block.type]?.rich_text || [];
  return richText.map((part) => part.plain_text ?? part.text?.content ?? '').join('').trim();
}

function sectionName(text) {
  const name = text.toLowerCase().replace(/[\s_-]/g, '');
  return name === 'followup' || name === 'schedule' ? name : null;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseEvent(text) {
  // Notion bullets may omit braces or retain a closing brace after pasting.
  const body = text.trim().replace(/^[-*]\s+/, '').replace(/[“”]/g, '"')
    .replace(/\\([{}])/g, '$1').replace(/^\{\s*/, '').replace(/[\s,}]+$/, '');
  const value = JSON.parse('{' + body + '}');
  if (!validDate(value.start) || !validDate(value.end || value.start)
      || (value.end && value.end < value.start)
      || typeof value.place !== 'string' || !value.place.trim()
      || typeof value.category !== 'string' || !value.category.trim()
      || (value.memo != null && typeof value.memo !== 'string')) {
    throw new Error('Invalid schedule entry');
  }
  return {
    start: value.start, end: value.end || value.start,
    category: value.category.trim(), place: value.place.trim(),
    memo: (value.memo || '').trim()
  };
}

function extractContent(blocks) {
  const result = { followup: [], events: [], warnings: [] };
  const found = new Set();
  let section = null;
  let level = 0;
  let scheduleRow = 0;
  for (const block of blocks) {
    if (block.archived || block.in_trash) continue;
    const text = blockText(block);
    const heading = /^heading_([123])$/.exec(block.type);
    if (heading) {
      const target = sectionName(text);
      if (target) {
        section = target;
        level = Number(heading[1]);
        found.add(target);
      } else if (Number(heading[1]) <= level) {
        section = null;
      }
      continue;
    }
    if (!section || !text) continue;
    if (!['paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'code'].includes(block.type)) continue;
    if (section === 'followup') {
      result.followup.push(text);
    } else {
      scheduleRow++;
      try {
        result.events.push(parseEvent(text));
      } catch {
        result.warnings.push('Schedule의 ' + scheduleRow + '번째 항목은 형식을 확인해 주세요.');
      }
    }
  }
  if (!found.has('followup')) result.warnings.push('Notion에서 followup 제목을 찾지 못했습니다.');
  if (!found.has('schedule')) result.warnings.push('Notion에서 Schedule 제목을 찾지 못했습니다.');
  return result;
}

module.exports = { blockText, sectionName, parseEvent, extractContent };
