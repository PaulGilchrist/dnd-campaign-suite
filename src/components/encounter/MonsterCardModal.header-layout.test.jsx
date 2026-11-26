// @maintained-by-ai 2026-11-16
/**
 * Layout contract for the monster stat-modal header (bug 2026-11-16).
 *
 * `.mc-header` is a space-between flex row. Before the fix NONE of its
 * children grew, so the leftover ~171 px spread into three equal gaps and the
 * name/type block floated 66 px to the right of its avatar (the designed
 * gutter is the avatar's 14 px margin-right). The fix makes the info block
 * absorb the slack (`flex: 1`), keeping the avatar+name group left-coherent
 * while the arm select and close button stay right-aligned on both header
 * faces (arm present, and the EB preview's 3-child header without it).
 *
 * jsdom performs no layout, so — mirroring the sibling CSS-pinning tests
 * (CreatureBadge.test.jsx, VictoryBanner.no-capture.test.jsx) — we parse the
 * co-located stylesheet and pin the exact normalized declarations the layout
 * depends on.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(join(SRC_DIR, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const css = readCss('MonsterCardModal.css');

function parseRule(selector) {
  const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'i');
  const match = css.match(re);
  if (!match) return null;
  const props = {};
  for (const decl of match[1].split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    props[decl.slice(0, colon).trim().toLowerCase()] = norm(decl.slice(colon + 1));
  }
  return props;
}

describe('mc-header layout (avatar/name hug left, arm/close stay right)', () => {
  it('header is a space-between flex row', () => {
    expect(parseRule('.mc-header')).toMatchObject({
      display: 'flex',
      'justify-content': 'space-between',
    });
  });

  it('info block grows to absorb the leftover width (no spread into the avatar gutter)', () => {
    const info = parseRule('.mc-header-info');
    expect(info, '.mc-header-info rule should exist').not.toBeNull();
    // Exact value pin: `flex: 1` normalizes grow to 1. A regressed
    // `flex: 0 ...`/missing declaration re-breaks the space-between spread.
    expect(info.flex).toBe('1');
    // Long monster names must still wrap/shrink inside the grown box.
    expect(info['min-width']).toBe('0');
  });

  it('info keeps a right gutter so the arm/close group never sits flush on the text', () => {
    expect(parseRule('.mc-header-info')).toMatchObject({ 'margin-right': '14px' });
  });

  it('avatar is fixed-size with the designed 14 px name gutter', () => {
    expect(parseRule('.mc-overlay .mc-header-avatar')).toMatchObject({
      'flex-shrink': '0',
      'margin-right': '14px',
    });
  });

  it('close button never shrinks away at the right edge', () => {
    expect(parseRule('.mc-close')).toMatchObject({ 'flex-shrink': '0' });
  });
});
