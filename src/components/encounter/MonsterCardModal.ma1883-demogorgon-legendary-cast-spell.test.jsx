// MA-1883 modal seam: Demogorgon legendary_actions[3] "Cast a Spell (Costs 2
// Actions)" — pre-fix the single "Expend Legendary" chip press spent 1 and
// rolled a zero-payload save (MA-1874 CAN-route shell, "DC Unknown" popup,
// registry-verified FAIL). Now: the row arms the delegated Spellcasting
// master's SEVEN spell chips (MA-1879 lane rendered by
// LegendarySpellCastLinks), the bare expend chip self-suppresses (MA-1488
// sole-press mandate), and a spell-named press spends the parsed RAW cost 2
// (2→0) then resolves through the LIVE handleSpellCast lane — spells.json
// lookup, the spell's own save axis + row DC 23, N/Day charge tracking.
// Refusals stay honest and check-BEFORE-spend (MA-1150): exhausted spell and
// unarmed save press never burn a legendary use; 1-of-2 pool refuses
// insufficient-cost with zero spend; same-boundary re-press refuses zero-spend.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';
import spells2024Data from '../../../public/data/2024/spells.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4, 2], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
// §177: branch on ruleset — 5e-exact-first; the 7 names resolve in 5e.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024Data : spellsData)),
}));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 120),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

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
    const chips = row.querySelectorAll('.mc-dice-link-spell');
    expect(chips.length).toBe(7);
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
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const [abbr, , saveCtx] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('INT'); // the spell's own axis — never the generic shell
    expect(saveCtx.saveDc).toBe(23);
    expect(saveCtx.spellName).toBe('Feeblemind');
    expect(saveCtx.targetName).toBe('Bandit 1');
    expect(saveCtx.autoDamageFormula).toBe('4d6');
    // spell charge tracked on the same N/Day lane as the master row chips (MA-1879)
    await waitFor(() => expect(runtime.store[USES]).toEqual({ Feeblemind: 1 }));
    const spend = spendUses().find(e => /spends 2 legendary uses/.test(String(e.description)));
    expect(spend.description).toMatch(/Cast a Spell \(Costs 2 Actions\) \(Feeblemind\).*0 of 2 left/);
    const cast = abilityUses('Feeblemind').find(e => /casts Feeblemind via Spellcasting/.test(String(e.description)));
    expect(cast).toBeTruthy();
    // the MA-1874 defect signatures never appear
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    expect(entries().some(e => /DC Unknown/.test(String(e.description)))).toBe(false);
    errSpy.mockRestore();
  });

  it('press At-Will Detect Magic: named spell record carries DC 23, NO save rolled (no effect-less save), LA 2→0, charges untouched', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(chipByText('Detect Magic'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 }));
    await waitFor(() => expect(abilityUses('Detect Magic').length).toBe(1));
    expect(abilityUses('Detect Magic')[0].description).toMatch(/casts Detect Magic via Spellcasting/);
    expect(abilityUses('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled(); // self-cast: the zero-payload save shell is GONE
    expect(runtime.store[USES] ?? null).toBeNull(); // At Will ungated
  });

  it('exhausted Feeblemind (1/Day spent): press refuses with <spell>_refused BEFORE the LA spend — zero legendary burn', async () => {
    renderDemo({ max: 2, used: 0 });
    runtime.store[USES] = { Feeblemind: 1 };
    setPopupHtml.mockClear();
    addEntry.mockClear();
    fireEvent.click(chipByText('Feeblemind'));
    await waitFor(() => expect(entries().some(e => e.type === 'automation blocked' && e.abilityName === 'Feeblemind')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 }); // check-BEFORE-spend (MA-1150 twin)
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(spendUses().length).toBe(0);
  });

  it('1 of 2 left (used:1): spell press refuses insufficient-cost, ZERO spend, zero roll', async () => {
    renderDemo({ max: 2, used: 1 });
    fireEvent.click(chipByText('Telekinesis'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const popup = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Legendary Action Refused/.test(h)));
    expect(popup).toMatch(/costs 2 legendary uses but Demogorgon 1 has only 1 left/);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(entries().some(e => e.automationType === 'legendary_use_refused' && /insufficient-cost: costs 2, 1 left/.test(String(e.description)))).toBe(true);
  });

  it('same-boundary re-press after a successful cast: refused, zero extra spend, latch honest', async () => {
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(chipByText('Detect Magic'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 }));
    expect(runtime.store[LATCH]).toEqual({ round: 1, activeCreature: 'Bandit 1' });
    addEntry.mockClear();
    fireEvent.click(chipByText('Detect Magic'));
    await waitFor(() => expect(entries().some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(abilityUses('Detect Magic').length).toBe(0);
  });

  it('unarmed save-spell press refuses no-target BEFORE the legendary spend (MA-1150)', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: creatures(null) };
    renderDemo({ max: 2, used: 0 });
    fireEvent.click(chipByText('Feeblemind'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    // MA-1150 reuses the MA-0049 no-target refusal byte-identically
    expect(String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /No Target/.test(h)) || '')).toMatch(/no target is armed.*No save rolled, nothing spent/s);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 }); // zero LA burn
    expect(runtime.store[USES] ?? null).toBeNull();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted LA (2/2): chips stay clickable and route the honest exhausted refusal, zero roll, zero spell record', async () => {
    renderDemo({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(chipByText('Fear'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 });
    expect(spendUses().length).toBe(0);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
