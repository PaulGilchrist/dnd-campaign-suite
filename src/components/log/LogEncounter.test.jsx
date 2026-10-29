// @maintained-by-ai
// EncounterEntry lane: owned contract = encounter log-entry RENDER bytes only —
// leg polarity (container class, icon, title) for every producer-emitted action,
// exact ordered roster bytes (roster census #781) on the start leg, exact
// xpPerChar/loot bytes (#875 exemplar: exact numbers, not regex) on the end leg,
// falsy-field suppression asserting the surviving sibling byte (#842), and
// cross-leg field suppression.
// CUT (owners cited): container type-dispatch → LogEntryRendering.test.jsx (#876,
// queued NEXT); producer payload bytes (#871 encounter entries: EncounterBuilder.jsx:315
// action:'joined'; useLootHandlers.js:60 and autoRewardService.js:61 action:'loot_awarded'
// — autoRewardService owns the award-number payloads, we only pin how they render).
// Family-standard setup (useLog fake, zero-network, zero added mocks) from
// log-test-utils.jsx; #876 rule: fixed timestamps, never assert Date.now() output.
// Old→new map: started-core(1)+timestamp(1)+completed-core(1) → polarityMatrix;
// monster-list bytes → startLegDetails; xp+loot bytes → endLegDetails;
// hide-monsters(1)+hide-xp(1)+hide-loot(1) → falsyMatrix; NEW: cross-leg
// suppression, exact separator/nbsp bytes, #878-fix presentation-map legs
// (joined/loot_awarded own legs, enum-cover #1348, UNKNOWN + console.error).
import { beforeEach, vi } from 'vitest';
import { enc, q, setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

const TS = 1700000000000; // fixed timestamp — never Date.now() in assertions

describe('Log > EncounterEntry', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // #878 FIX: binary isStart ternary replaced by ENCOUNTER_PRESENTATION map covering
  // the full producer enum census — 'joined' (EncounterBuilder.jsx:315) and
  // 'loot_awarded' (useLootHandlers.js:60, autoRewardService.js:61) no longer fall
  // through to the completed leg. Row2 flipped from the honest-broken pin
  // ('log-encounter-end' + 'fa-trophy' + 'Encounter Completed') to the fixed bytes.
  // started/completed leg bytes byte-intact from the pre-fix pin.
  it.each([
    ['started', 'log-encounter-start', 'fa-skull', 'Encounter Started'],
    ['joined', 'log-encounter-joined', 'fa-right-to-bracket', 'Encounter Joined'], // #878-fix (was end+trophy+Completed)
    ['completed', 'log-encounter-end', 'fa-trophy', 'Encounter Completed'],
    ['loot_awarded', 'log-encounter-rewards', 'fa-coins', 'Loot Awarded'], // #878-fix (was end+trophy+Completed)
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

  // #878: joined rows (EncounterBuilder.jsx:315 payload: encounterName + monsters)
  // render the roster on the join leg and NEVER the completion trophy, XP, or loot.
  it('joined leg renders exact roster bytes and suppresses completion trophy/xp/loot', () => {
    setup(Log, [enc({ timestamp: TS, action: 'joined', encounterName: 'Orc Ambush', monsters: ['1x Goblin', '2x Troll'], xpPerChar: 750, lootItems: ['Sword'] })]);
    expect(q('.log-entry')).toHaveClass('log-encounter-joined');
    expect(q('.log-name').textContent).toBe('Encounter Joined');
    expect([...document.querySelectorAll('.log-encounter-monsters .log-encounter-monster')].map((n) => n.textContent))
      .toEqual(['1x Goblin,\u00a0', '2x Troll\u00a0']);
    expect(q('.log-encounter .log-icon i')).not.toHaveClass('fa-trophy');
    expect(q('.log-encounter .log-icon i')).toHaveClass('fa-right-to-bracket');
    expect(q('.log-encounter-xp')).toBeNull();
    expect(q('.log-encounter-loot')).toBeNull();
  });

  // #878: loot_awarded rows (useLootHandlers.js:60 / autoRewardService.js:61 payload:
  // xpPerChar + lootItems) render the rewards leg with exact bytes, no roster.
  it('loot_awarded leg renders exact xp/loot bytes and suppresses the roster', () => {
    const { container } = setup(Log, [enc({ timestamp: TS, action: 'loot_awarded', encounterName: 'Combat', xpPerChar: 27, lootItems: ['a pouch of 25 gp'] })]);
    expect(q('.log-name').textContent).toBe('Loot Awarded');
    expect(q('.log-encounter-xp i')).toHaveClass('fa-star');
    expect(q('.log-encounter-xp').textContent).toBe('\u00a027 XP per character');
    expect([...container.querySelectorAll('.log-encounter-loot .log-encounter-loot-item')].map((n) => n.textContent))
      .toEqual(['a pouch of 25 gp']);
    expect(container.querySelector('.log-encounter-monsters')).toBeNull();
  });

  // 2026-10-29-AC producer suppression: NEW loot_awarded rows omit lootItems
  // (the sibling type:'loot' row owns the per-line record). Renderer must stay
  // sane — label + xp leg, no loot list, no crash. The legacy WITH-lootItems
  // pin above proves old rows still render byte-exact (criterion 5).
  it('loot_awarded row without lootItems (post-fix producer shape) still renders the rewards record', () => {
    const { container } = setup(Log, [enc({ timestamp: TS, action: 'loot_awarded', encounterName: 'Combat', xpPerChar: 27, totalEncounterXp: 55 })]);
    expect(q('.log-name').textContent).toBe('Loot Awarded');
    expect(q('.log-encounter .log-icon i')).toHaveClass('fa-coins');
    expect(q('.log-encounter-xp').textContent).toBe('\u00a027 XP per character');
    expect(container.querySelector('.log-encounter-loot')).toBeNull();
  });

  // #878 enum-cover (#1348): every action the producers can emit (plus the defensive
  // UNKNOWN arm) renders a mutually distinguishable label/icon/class triple — no two
  // rows share all three bytes.
  it.each([
    ['started', 'Encounter Started', 'fa-skull', 'log-encounter-start'],
    ['joined', 'Encounter Joined', 'fa-right-to-bracket', 'log-encounter-joined'],
    ['completed', 'Encounter Completed', 'fa-trophy', 'log-encounter-end'],
    ['loot_awarded', 'Loot Awarded', 'fa-coins', 'log-encounter-rewards'],
    ['quantum-tunneled', 'Encounter Update', 'fa-circle-info', 'log-encounter-neutral'],
  ])('enum-cover: action "%s" is distinguishable (%s / %s)', (_action, title, iconCls, legCls) => {
    setup(Log, [enc({ timestamp: TS, action: _action })]);
    expect(q('.log-entry')).toHaveClass('log-encounter', legCls);
    expect(q('.log-name').textContent).toBe(title);
    expect(q('.log-encounter .log-icon i')).toHaveClass(iconCls);
  });

  // Mirrors the #876/#877 house pattern (LogConditionEntry.jsx:32-35): an unknown
  // action logs loudly and renders the neutral fallback — never silently
  // 'Encounter Completed' + trophy.
  it('unknown action logs console.error and renders the neutral fallback — never a silent "Encounter Completed"', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = setup(Log, [enc({ timestamp: TS, action: 'quantum-tunneled', xpPerChar: 750, lootItems: ['Sword'], monsters: ['Troll'] })]);
    expect(q('.log-entry')).toHaveClass('log-encounter-neutral');
    expect(q('.log-entry')).not.toHaveClass('log-encounter-end');
    expect(q('.log-icon i')).toHaveClass('fa-circle-info');
    expect(q('.log-name')).toHaveTextContent('Encounter Update');
    expect(container.querySelector('.log-encounter-monsters')).toBeNull();
    expect(container.querySelector('.log-encounter-xp')).toBeNull();
    expect(container.querySelector('.log-encounter-loot')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('quantum-tunneled'), expect.anything());
    errorSpy.mockRestore();
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
