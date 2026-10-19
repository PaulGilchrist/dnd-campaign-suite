// @maintained-by-ai
// EncounterEntry lane: owned contract = encounter log-entry RENDER bytes only —
// leg polarity (container class, icon, title) for every producer-emitted action,
// exact ordered roster bytes (roster census #781) on the start leg, exact
// xpPerChar/loot bytes (#875 exemplar: exact numbers, not regex) on the end leg,
// falsy-field suppression asserting the surviving sibling byte (#842), and
// cross-leg field suppression.
// CUT (owners cited): container type-dispatch → LogEntryRendering.test.jsx (#876,
// queued NEXT); producer payload bytes (#871 encounter entries: EncounterBuilder.jsx:305
// action:'joined'; useLootHandlers.js:58 and autoRewardService.js:59 action:'loot_awarded'
// — autoRewardService owns the award-number payloads, we only pin how they render).
// Family-standard setup (useLog fake, zero-network, zero added mocks) from
// log-test-utils.jsx; #876 rule: fixed timestamps, never assert Date.now() output.
// Old→new map: started-core(1)+timestamp(1)+completed-core(1) → polarityMatrix;
// monster-list bytes → startLegDetails; xp+loot bytes → endLegDetails;
// hide-monsters(1)+hide-xp(1)+hide-loot(1) → falsyMatrix; NEW: cross-leg
// suppression, exact separator/nbsp bytes, producer action fall-through legs.
import { beforeEach } from 'vitest';
import { enc, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed timestamp — never Date.now() in assertions

describe('Log > EncounterEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // Only the literal 'started' selects the start leg. Real producers emit
  // 'joined' (EncounterBuilder.jsx:307) and 'loot_awarded' (useLootHandlers.js:60,
  // autoRewardService.js:61); BOTH non-'started' actions fall through to the
  // completed leg — 'joined' renders "Encounter Completed" with a trophy
  // (pinned honestly — SOURCE BUGS).
  it.each([
    ['started', 'log-encounter-start', 'fa-skull', 'Encounter Started'],
    ['joined', 'log-encounter-end', 'fa-trophy', 'Encounter Completed'],
    ['completed', 'log-encounter-end', 'fa-trophy', 'Encounter Completed'],
    ['loot_awarded', 'log-encounter-end', 'fa-trophy', 'Encounter Completed'],
  ])('action "%s" renders the %s leg: class, icon, title, fixed-epoch time', (action, legCls, iconCls, title) => {
    setup(Log, [enc({ timestamp: TS, action })]);
    expect(q('.log-entry')).toHaveClass('log-entry', 'log-encounter', legCls);
    expect(q('.log-encounter .log-icon i')).toHaveClass(iconCls);
    expect(q('.log-name').textContent).toBe(title);
    expect(q('.log-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('start leg renders the roster as exact ordered bytes with comma separators', () => {
    setup(Log, [enc({ timestamp: TS, action: 'started', encounterName: 'Orc Ambush', monsters: ['Gob x4', 'Troll'] })]);
    expect(q('.log-encounter-name').textContent).toBe('Orc Ambush');
    expect([...document.querySelectorAll('.log-encounter-monsters .log-encounter-monster')].map((n) => n.textContent))
      .toEqual(['Gob x4,\u00a0', 'Troll\u00a0']);
  });

  it('end leg renders exact XP byte with star icon and exact ordered loot item bytes', () => {
    setup(Log, [enc({ timestamp: TS, action: 'completed', xpPerChar: 750, lootItems: ['Sword', 'Potion of Healing'] })]);
    expect(q('.log-encounter-xp i')).toHaveClass('fa-star');
    expect(q('.log-encounter-xp').textContent).toBe('\u00a0750 XP per character');
    expect([...document.querySelectorAll('.log-encounter-loot .log-encounter-loot-item')].map((n) => n.textContent))
      .toEqual(['Sword', 'Potion of Healing']);
  });

  // Cross-leg suppression: fields authored for the other leg must not render.
  // Scoped to each render's container (setup returns render result) so the
  // two renders in one test can't shadow each other's selectors.
  it('started entry suppresses xpPerChar/lootItems and completed entry suppresses monsters', () => {
    const end = setup(Log, [enc({ timestamp: TS, action: 'completed', monsters: ['Troll'], xpPerChar: 750 })]);
    expect(end.container.querySelector('.log-encounter-monsters')).toBeNull();
    expect(end.container.querySelector('.log-encounter-xp').textContent).toBe('\u00a0750 XP per character');

    const start = setup(Log, [enc({ timestamp: TS, action: 'started', monsters: ['Gob x4'], xpPerChar: 750, lootItems: ['Sword'] })]);
    expect(start.container.querySelector('.log-encounter-monsters')).toBeInTheDocument(); // this leg owns the roster
    expect(start.container.querySelector('.log-encounter-xp')).toBeNull();
    expect(start.container.querySelector('.log-encounter-loot')).toBeNull();
  });

  it.each([
    ['started', { monsters: [] }, '.log-encounter-monsters', '.log-encounter-name', 'Orc Ambush'],
    ['started', { monsters: undefined }, '.log-encounter-monsters', '.log-encounter-name', 'Orc Ambush'],
    ['completed', { xpPerChar: 0, lootItems: ['Sword'] }, '.log-encounter-xp', '.log-encounter-loot-item', 'Sword'],
    ['completed', { xpPerChar: -100, lootItems: ['Sword'] }, '.log-encounter-xp', '.log-encounter-loot-item', 'Sword'],
    ['completed', { xpPerChar: 750, lootItems: [] }, '.log-encounter-loot', '.log-encounter-xp', '\u00a0750 XP per character'],
    ['completed', { xpPerChar: 750, lootItems: undefined }, '.log-encounter-loot', '.log-encounter-xp', '\u00a0750 XP per character'],
  ])('%s with falsy field hides %s while sibling renders exact byte "%s"', (action, override, hiddenSel, siblingSel, siblingText) => {
    setup(Log, [enc({ timestamp: TS, action, ...override })]);
    expect(q(hiddenSel)).not.toBeInTheDocument();
    expect(q(siblingSel).textContent).toBe(siblingText);
  });
});
