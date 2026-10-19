// @maintained-by-ai
// LootEntry lane: owned contract = the standalone loot log entry's OWN render
// bytes — header icon/title/fixed-epoch time, exact XP byte incl. \u00a0 separator
// (#829 exact bytes over regex), exact ordered <li> item census (#781), XP→items
// adjacency inside .log-loot-details, falsy-field suppression asserting the
// surviving sibling byte (#842), and honest empty details distinct from any
// placeholder. Producers also author encounterName/totalEncounterXp
// (useLootHandlers.js:48, autoRewardService.js:53) which this component does NOT
// render — pinned as current behavior in the full-entry test.
// NOT owned (cited): type:'loot' → root-class routing → LogEntryRendering.test.jsx
// (#879); loot bytes EMBEDDED within an encounter entry + XP byte there →
// LogEncounter.test.jsx (#878); producer payload bytes ('Gold coins' arrays,
// floor-split XP numbers) → useLootHandlers.test.jsx (#875) / autoRewardService.
// Family-standard setup (useLog fake, zero-network, zero added mocks) from
// log-test-utils.jsx; #827 rule: fixed timestamps, never assert Date.now() output.
// Old->new map: icon(1)+title(1)+xp-format(2)+items(2)+combined(1) -> fullEntry;
// hide-xp-matrix(1)+hide-items-matrix(1) -> suppressionMatrix (#877 shape);
// NEW: honest blank details (undefined legs), stray-"0" bug pin (#878 honest-pin
// convention), exact \u00a0 XP byte, details child order, producer-metadata-not-rendered pin.

import { beforeEach } from 'vitest';
import { loot, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed timestamp — never Date.now() in assertions

describe('Log > LootEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('renders header, exact XP byte, exact ordered item bytes, and XP-before-items order', () => {
    setup(Log, [loot({
      timestamp: TS,
      encounterName: 'Combat',
      totalEncounterXp: 3000,
      xpPerChar: 1500,
      lootItems: ['Gold coins', 'Ring of Protection'],
    })]);
    expect(q('.log-loot .log-icon i')).toHaveClass('fa-coins');
    expect(q('.log-loot .log-name').textContent).toBe('Loot & XP Awarded');
    expect(q('.log-loot .log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(q('.log-loot-xp i')).toHaveClass('fa-star');
    expect(q('.log-loot-xp').textContent).toBe('\u00a01,500 XP per character');
    expect([...document.querySelectorAll('.log-loot-items .log-loot-item')].map((n) => n.textContent))
      .toEqual(['Gold coins', 'Ring of Protection']);
    // Authored details order: XP line precedes the items list.
    expect([...q('.log-loot-details').children].map((n) => n.className))
      .toEqual(['log-loot-xp', 'log-loot-items']);
    // Producers author encounterName/totalEncounterXp; this component ignores them.
    expect(q('.log-loot').textContent).not.toContain('Combat');
    expect(q('.log-loot').textContent).not.toContain('3,000');
  });

  // Falsy-field suppression with surviving-sibling byte (#842): each row hides
  // one section and pins the other section's exact byte so absence is honest,
  // not a blank-render false positive.
  it.each([
    ['xpPerChar 0', { xpPerChar: 0 }, '.log-loot-xp', '.log-loot-item', 'Gold coins'],
    ['xpPerChar negative', { xpPerChar: -100 }, '.log-loot-xp', '.log-loot-item', 'Gold coins'],
    ['xpPerChar undefined', { xpPerChar: undefined }, '.log-loot-xp', '.log-loot-item', 'Gold coins'],
    ['lootItems empty', { lootItems: [] }, '.log-loot-items', '.log-loot-xp', '\u00a0750 XP per character'],
    ['lootItems null', { lootItems: null }, '.log-loot-items', '.log-loot-xp', '\u00a0750 XP per character'],
    ['lootItems undefined', { lootItems: undefined }, '.log-loot-items', '.log-loot-xp', '\u00a0750 XP per character'],
  ])('%s hides %s while sibling renders exact byte "%s"', (_label, override, hiddenSel, siblingSel, siblingText) => {
    setup(Log, [loot({ timestamp: TS, xpPerChar: 750, lootItems: ['Gold coins'], ...override })]);
    expect(q(hiddenSel)).not.toBeInTheDocument();
    expect(q(siblingSel).textContent).toBe(siblingText);
  });

  it('renders honest empty details — not a placeholder — when XP and items are undefined', () => {
    setup(Log, [loot({ timestamp: TS, xpPerChar: undefined, lootItems: undefined })]);
    expect(q('.log-loot-details')).toBeInTheDocument();
    expect(q('.log-loot-details').textContent).toBe('');
    expect(q('.log-loot .log-name').textContent).toBe('Loot & XP Awarded');
  });

  // Pinned honestly (SOURCE BUG LogLootEntry.jsx:12): `entry.xpPerChar && …`
  // short-circuits to 0 and React renders the number 0 — the XP span is correctly
  // absent but a stray "0" byte leaks into details whenever xpPerChar is 0
  // (reachable via producers when totalEncounterXp floors to 0).
  it('xpPerChar 0 hides the XP span but leaks a stray "0" byte into details', () => {
    setup(Log, [loot({ timestamp: TS, xpPerChar: 0, lootItems: ['Gold coins'] })]);
    expect(q('.log-loot-xp')).not.toBeInTheDocument();
    expect(q('.log-loot-details').textContent).toBe('0Gold coins');
  });
});
