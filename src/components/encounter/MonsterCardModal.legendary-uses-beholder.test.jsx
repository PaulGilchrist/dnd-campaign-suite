// @maintained-by-ai — trimmed to beholder-distinct lanes: by-name data locks
// (header uses:3, Chomp→Bite delegate, Glare eye_rays advisory) + one
// effect-distinct click per lane (delegated roll ctx, advisory record,
// exhausted refusal). Generic gate/spend/latch/regain units and modal
// exhausted/latch lanes are cite-skipped to their owners (see map below).
// MA-0375 regression: Beholder legendary header was display-only prose
// ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, zero chips, forced clicks fire-free). Fix mirrors the verified
// MA-0227 (ancient green) DATA-only shape: header uses:3 ("4 in Lair" stays
// name text — no lair consumer); Chomp gets delegates_to:"Bite" (MA-0022
// seam, Bite +8 / 3d6+3 Piercing verified live at the click ctx); Glare gets
// the MA-0058/0270 advisory seam with row-authored honest copy (Eye Rays
// multi-ray block is MA-0374 unparseable — advisory spend + GM-picks-ray
// adjudication is the honest engine seam, MA-0164 silent-burn rule: every
// child row resolves a mechanic, proven live by the two effect-distinct
// clicks below).
//
// Cite-skipped generics (covered by owners — verified):
// - gate / spend / turn-latch / exhausted / refusal / regain units:
//   src/services/encounters/monsterLegendaryUses.test.js :79-110, :112-143, :145-162
// - modal counter mount, delegated click, exhausted refusal, turn-latch lanes:
//   src/components/encounter/MonsterCardModal.legendary-uses.test.jsx :178-219, :310
// - advisory popup/log builder shape: monsterLegendaryUses.test.js :607-617
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryHeaderAction, legendaryDelegateAction } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay sphere-picker-stub" />,
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
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
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Beholder 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 136, maxHp: 136, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Beholder 1.monsterLegendaryUses';
const LATCH_KEY = 'Beholder 1._legendaryUses_usedRound';

const beholder = () => monstersData.find(m => m.name === 'Beholder');
const row = (name) => beholder().legendary_actions.find(a => a.name === name);

describe('MA-0375 monsters.json data: beholder legendary rows by-name locks', () => {
  it('header authors uses:3 — legendaryHeaderAction resolves it (was prose-only null); "4 in Lair" stays name text (MA-0092 fingerprint)', () => {
    const header = row('Legendary Action Uses: 3 (4 in Lair)');
    expect(header.uses).toBe(3);
    expect(legendaryHeaderAction(beholder())).toBe(header);
  });

  it('Chomp delegates_to Bite, no own numeric mechanic; delegate resolves the real Bite row (MA-0022 seam)', () => {
    const chomp = row('Chomp');
    expect(chomp.delegates_to).toBe('Bite');
    expect(chomp.attack_bonus).toBeUndefined();
    expect(chomp.save_dc).toBeUndefined();
    expect(chomp.advisory).toBeUndefined();
    expect(legendaryDelegateAction(beholder(), chomp)).toBe(beholder().actions.find(a => a.name === 'Bite'));
  });

  it('Glare is the eye_rays advisory row — no fabricated ray numbers, honest MA-0374 adjudication copy (MA-0058 seam)', () => {
    const glare = row('Glare');
    expect(glare.advisory).toBe('eye_rays');
    expect(glare.attack_bonus).toBeUndefined();
    expect(glare.save_dc).toBeUndefined();
    expect(glare.damage_dice_primary).toBeUndefined();
    expect(glare.delegates_to).toBeUndefined();
    expect(glare.advisory_message).toMatch(/GM picks one eye ray and adjudicates/);
    expect(glare.advisory_message).toMatch(/MA-0374 pending subsystem/);
  });
});

// Live seam: counter mounts, gated effect-distinct clicks run their honest
// lanes once; exhausted is the ONE refusal sibling (own-turn + turn-latch
// refusals are service/template generics, see cite-skipped header above).
describe('MA-0375 MonsterCardModal beholder gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBeholder(uses) {
    if (uses !== undefined) runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Beholder',
      actions: beholder().actions,
      legendary_actions: beholder().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Beholder 1', creatures: CREATURES })} />);
  }
  function beholderRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); Chomp and Glare render gated Expend Legendary chips', () => {
    renderBeholder({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chompChip = beholderRow('Chomp').querySelector('.mc-dice-link-legendary');
    expect(chompChip).not.toBe(null);
    expect(chompChip.textContent).toContain('Expend Legendary');
    expect(beholderRow('Glare').querySelector('.mc-dice-link-legendary')).not.toBe(null);
  });

  it('Chomp gated click spends 1 (3→2), creates monsterLegendaryUses + latch, rolls delegated +8 / 3d6+3 Piercing Bite, zero console dead-end', async () => {
    renderBeholder();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(runtime.store[KEY]).toBeUndefined();
    fireEvent.click(beholderRow('Chomp').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[LATCH_KEY]).toEqual({ round: 1, activeCreature: 'Thug 1' }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Chomp (Bite attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(8);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d6 + 3');
    expect(options.damageType).toBe('Piercing');
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Chomp/.test(e.description));
    expect(spend.description).toMatch(/Beholder 1 expends a legendary use for Chomp/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Glare gated click spends 1 and lands the advisory record (popup + ability_use log), zero rolls', async () => {
    renderBeholder();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(beholderRow('Glare').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action — Glare');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('GM picks one eye ray');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(
      e => e.type === 'ability_use' && e.abilityName === 'Glare' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderBeholder({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(beholderRow('Chomp').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('no legendary uses left');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
