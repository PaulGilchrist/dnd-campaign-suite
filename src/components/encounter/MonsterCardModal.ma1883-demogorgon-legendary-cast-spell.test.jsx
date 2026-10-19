// @maintained-by-ai
// MA-1883 modal seam: Demogorgon legendary_actions[3] "Cast a Spell (Costs 2
// Actions)" — pre-fix the single "Expend Legendary" chip press spent 1 and
// rolled a zero-payload save (MA-1874 CAN-route shell, "DC Unknown" popup).
// THIS file owns the MODAL flow only: the row arms the delegated Spellcasting
// master's SEVEN spell chips (MA-1879 lane, rendered by LegendarySpellCastLinks)
// with the bare expend chip self-suppressed (MA-1488 sole-press mandate); a
// spell-named press spends the parsed RAW cost 2 (2→0) and resolves through the
// LIVE handleSpellCast lane; refusals check-BEFORE-spend (MA-1150) with zero
// legendary burn. Cited, not re-pinned: cost-parse/refusal economy
// monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js :136-210;
// master-row spell bytes + gate loops MonsterCardModal.ma1879-demogorgon-
// spellcasting.test.jsx :201-241; canonical exhausted faces
// monsterLegendaryUses.test.jsx:190-212/:304-326. The exhausted Feeblemind
// press stays byte-pinned HERE (ma1879's map cites this file :208-equivalent).
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';

// Mock hygiene (#739-#744 bisect): diceRoller, rangeValidation, mapsService and
// conditionEffects purged — the pressed lane never reaches rollExpression
// (spell damage adjudicates inside the mocked save roller), rangeValidation's
// rangeToFeet is a pure parser, mapName=null short-circuits loadMapData at
// modal :2131, and computeConditionEffects on conditions:[] is inert. Kept:
// logService (assertion target), sanitize (body render), dataLoader (the
// modal loads BOTH rulesets at :1541-1544 — one 5e list satisfies lookup since
// findMonsterSpell is 5e-exact-first, §177), useLoggedDiceRoll (destructured
// whole at modal :2211; only the save axis + popup capture have consumers),
// damageUtils (getCombatContext fires at :2125), reactive runtime store below.
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(spellsData)),
}));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));

// Reactive store lane (§56): setRuntimeValue notifies subscribers so the
// legendary counter re-renders after spends — the mocked dice hook rolls no
// state, so a plain snapshot mock would pin the header at its mount value.
const runtime = vi.hoisted(() => {
  const store = {};
  const listeners = new Set();
  return {
    store,
    listeners,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; Array.from(listeners).forEach((l) => l()); return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: null,
    useSyncedState: null,
    setRuntimeObject: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; Array.from(listeners).forEach((l) => l()); return Promise.resolve(); }),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', async () => {
  const { useEffect, useState } = await import('react');
  // Named like hooks so react-hooks/rules-of-hooks sees a legal call frame.
  function useRuntimeValue(k, p) {
    const [, tick] = useState(0);
    useEffect(() => {
      const fn = () => tick((t) => t + 1);
      runtime.listeners.add(fn);
      return () => { runtime.listeners.delete(fn); };
    }, [k, p]);
    return runtime.store[`${k}.${p}`] ?? null;
  }
  function useSyncedState(k, p, def) {
    const stored = runtime.store[`${k}.${p}`];
    return [stored === null || stored === undefined ? def : stored, (v) => runtime.setRuntimeValue(k, p, v)];
  }
  runtime.useRuntimeValue = useRuntimeValue;
  runtime.useSyncedState = useSyncedState;
  return {
    useRuntimeValue: (k, p) => runtime.useRuntimeValue(k, p),
    useSyncedState: (k, p, def) => runtime.useSyncedState(k, p, def),
    setRuntimeValue: runtime.setRuntimeValue,
    getRuntimeValue: runtime.getRuntimeValue,
    setRuntimeObject: runtime.setRuntimeObject,
    seedTrackedResources: vi.fn(),
  };
});

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const DEMO = monstersData.find(m => m.index === 'demogorgon');
const KEY = 'Demogorgon 1.monsterLegendaryUses';
const USES = 'Demogorgon 1.monsterSpellUses';
const LATCH = 'Demogorgon 1._legendaryUses_usedRound';

const creatures = (targetName = 'Bandit 1') => ([
  { name: 'Demogorgon 1', type: 'npc', monsterType: 'fiend', targetName, currentHp: 464, maxHp: 464, ac: 22, conditions: [] },
  { name: 'Bandit 1', type: 'player', currentHp: 999, maxHp: 999, ac: 12, conditions: [], computedStats: {} },
]);

function renderDemo(uses) {
  if (uses) runtime.store[KEY] = uses;
  const m = makeMonster({
    name: 'Demogorgon',
    actions: DEMO.actions,
    legendary_actions: DEMO.legendary_actions,
  });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Demogorgon 1', creatures: ctx.value.creatures })} />);
}
function castRow() {
  return Array.from(document.querySelectorAll('.mc-action'))
    .find(r => (r.querySelector('strong')?.textContent || '').startsWith('Cast a Spell (Costs 2 Actions)'));
}
function chipByText(name) {
  return Array.from(castRow().querySelectorAll('.mc-dice-link-spell')).find(el => el.textContent.includes(name)) || null;
}
const entries = () => addEntry.mock.calls.map(c => c[1]);
// Exact abilityName match: the spend record is named "Cast a Spell (Costs 2
// Actions) (<spell>)" on purpose — a loose regex would double-count casts.
const abilityUses = (name) => entries().filter(e => e.type === 'ability_use' && String(e.abilityName) === name);
const spendUses = () => entries().filter(e => e.type === 'ability_use' && /^Cast a Spell/.test(String(e.abilityName)));
const refusals = (name) => entries().filter(e => e.type === 'automation blocked' && e.abilityName === name);
const popups = (re) => setPopupHtml.mock.calls.map(c => String(c[0])).filter(h => re.test(h));

describe('MA-1883 modal: legendary Cast a Spell arms the live spell chips, not a save shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: creatures() };
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('row renders the master\'s 7 spell chips with live N/Day counters and NO generic Expend Legendary chip', () => {
    renderDemo({ max: 2, used: 0 });
    const row = castRow();
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null); // sole-press mandate (MA-1488)
    expect(row.querySelectorAll('.mc-dice-link-spell')).toHaveLength(7);
    expect(chipByText('Feeblemind').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(chipByText('Fear').textContent).toMatch(/\(3\/Day · 3 left\)/);
    expect(chipByText('Detect Magic').textContent).not.toMatch(/\/Day/); // At Will ungated (§57)
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
  });

  it('press Feeblemind: spends 2 LA (2→0), casts live — INT save vs DC 23 + 4d6 Psychic payload + 1/Day charge, zero shell', async () => {
    renderDemo({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chipByText('Feeblemind'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 }));
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    const [abbr, , saveCtx] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('INT'); // the spell's own axis — never the generic shell
    expect(saveCtx.saveDc).toBe(23);
    expect(saveCtx.spellName).toBe('Feeblemind');
    expect(saveCtx.targetName).toBe('Bandit 1');
    expect(saveCtx.autoDamageFormula).toBe('4d6');
    // spell charge tracked on the same N/Day lane as the master row chips (MA-1879)
    await waitFor(() => expect(runtime.store[USES]).toEqual({ Feeblemind: 1 }));
    const spends = spendUses().filter(e => /spends 2 legendary uses/.test(String(e.description)));
    expect(spends).toHaveLength(1);
    expect(spends[0].description).toMatch(/Cast a Spell \(Costs 2 Actions\) \(Feeblemind\).*0 of 2 left/);
    expect(abilityUses('Feeblemind')).toHaveLength(1);
    expect(abilityUses('Feeblemind')[0].description).toMatch(/casts Feeblemind via Spellcasting/);
    // the MA-1874 defect signatures never appear
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    expect(entries().some(e => /DC Unknown/.test(String(e.description)))).toBe(false);
  });

  it('At-Will Detect Magic press casts ungated (DC 23 record, NO save rolled, charges untouched, LA 2→0), then same-boundary re-press refuses zero-spend with the honest latch', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(chipByText('Detect Magic'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 }));
    await waitFor(() => expect(abilityUses('Detect Magic')).toHaveLength(1));
    expect(abilityUses('Detect Magic')[0].description).toMatch(/casts Detect Magic via Spellcasting/);
    expect(abilityUses('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled(); // self-cast: the zero-payload save shell is GONE
    expect(runtime.store[USES] ?? null).toBeNull(); // At Will ungated
    expect(runtime.store[LATCH]).toEqual({ round: 1, activeCreature: 'Bandit 1' });
    // same-boundary re-press: refused, zero extra spend (parse byte at service twin :226)
    addEntry.mockClear();
    fireEvent.click(chipByText('Detect Magic'));
    await waitFor(() => expect(entries().some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(abilityUses('Detect Magic')).toHaveLength(0);
  });

  it('exhausted Feeblemind (1/Day spent): press refuses with <spell>_refused BEFORE the LA spend — zero legendary burn', async () => {
    renderDemo({ max: 2, used: 0 });
    runtime.store[USES] = { Feeblemind: 1 };
    fireEvent.click(chipByText('Feeblemind'));
    await waitFor(() => expect(refusals('Feeblemind')).toHaveLength(1));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 }); // check-BEFORE-spend (MA-1150 twin)
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(spendUses()).toHaveLength(0);
  });

  it('economy refusals burn nothing: 1-of-2 press shows the insufficient-cost byte, exhausted pool press routes the honest refusal — chips stay clickable, zero roll, zero spend', async () => {
    renderDemo({ max: 2, used: 1 });
    fireEvent.click(chipByText('Telekinesis'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(popups(/Legendary Action Refused/)[0]).toMatch(/costs 2 legendary uses but Demogorgon 1 has only 1 left/);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(entries().some(e => e.automationType === 'legendary_use_refused' && /insufficient-cost: costs 2, 1 left/.test(String(e.description)))).toBe(true);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // drive the pool to exhausted through the reactive lane, then re-press another chip
    await act(async () => { runtime.setRuntimeValue('Demogorgon 1', 'monsterLegendaryUses', { max: 2, used: 2 }); });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    addEntry.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(chipByText('Fear'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(popups(/Legendary Action Refused/)).toHaveLength(1);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(spendUses()).toHaveLength(0);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('unarmed save-spell press refuses no-target BEFORE the legendary spend (MA-1150)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: creatures(null) };
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(chipByText('Feeblemind'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    // MA-1150 reuses the MA-0049 no-target refusal byte-identically
    expect(popups(/No Target/)[0]).toMatch(/no target is armed.*No save rolled, nothing spent/s);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 }); // zero LA burn
    expect(runtime.store[USES] ?? null).toBeNull();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
