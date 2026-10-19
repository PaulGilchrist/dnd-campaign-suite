// @maintained-by-ai
// MA-1163 regression: Mind Flayer Extract Brain grappled-target prerequisite on the
// SAVE chip. The save row authors target_prerequisite {conditions:["grappled"]} —
// MA-0019 byte-shape MINUS by_attacker (Tentacles provenance unestablished, source-
// agnostic per the MA-0687 twin). handleSaveRoll's evaluateTargetPrerequisiteGate
// refuses an ungrappled armed target with the provenance-OMITTED popup ("must be
// Grappled." — the fix's byAttacker-conditional clause) + extract_brain_refused log,
// zero save roll, nothing spent; a grappled target from ANY source resolves the save
// exactly as before (DC 15 CON, 10d10 Piercing, half on success).
// Cite-skip: gate truth table, by_attacker provenance, refusal-log builder —
// MA-1275 owner (MonsterCardModal.ma1275-tentacle-slam-prerequisite.test.jsx) +
// MA-1652 helpers (by_attacker-absent satisfaction); Tentacles attack-chip lane —
// MonsterAction.ma1162-mind-flayer-tentacles-hit-conditions.test.jsx.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

// Network-guard: getCombatContext only fetches when `creatures` is absent — never on
// this lane; other exports real.
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

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

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const MIND_FLYER_ACTIONS = monstersData.find(m => m.name === 'Mind Flayer').actions;
const TENTACLES = MIND_FLYER_ACTIONS.find(a => a.name === 'Tentacles');
const EXTRACT_BRAIN = MIND_FLYER_ACTIONS.find(a => a.name === 'Extract Brain');

// Mind Flayer carries targetName so getTarget resolves Bandit 1 without a picker.
const CREATURES = [
  { name: 'Mind Flayer 1', type: 'npc', monsterType: 'aberration', targetName: 'Bandit 1', currentHp: 999, maxHp: 999, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderMindFlayer() {
  const m = makeMonster({ name: 'Mind Flayer', actions: [TENTACLES, EXTRACT_BRAIN] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mind Flayer 1', creatures: CREATURES })} />);
}

function saveChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-1163 MonsterCardModal Extract Brain SAVE-chip prerequisite gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('monsters.json Extract Brain row authors target_prerequisite {conditions:["grappled"]} (no by_attacker) with its save core; Tentacles sibling byte-inert', () => {
    expect(EXTRACT_BRAIN.target_prerequisite).toEqual({ conditions: ['grappled'] });
    expect(EXTRACT_BRAIN.target_prerequisite.by_attacker).toBeUndefined();
    expect(EXTRACT_BRAIN.save_dc).toBe(15);
    expect(EXTRACT_BRAIN.save_type).toBe('Constitution');
    expect(EXTRACT_BRAIN.damage_dice_primary).toBe('10d10');
    expect(EXTRACT_BRAIN.damage_type_primary).toBe('Piercing');
    expect(TENTACLES.target_prerequisite).toBeUndefined();
  });

  it('ungrappled target: popup omits provenance + extract_brain_refused log, zero save roll, nothing spent', async () => {
    renderMindFlayer();
    fireEvent.click(saveChip('Extract Brain'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    // "must be Grappled." proves the byAttacker-conditional provenance clause is OMITTED here
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('must be Grappled.');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'extract_brain_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('Mind Flayer 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('grappled from ANY source: resolves the save unchanged, DC 15 CON / 10d10 Piercing half on success', () => {
    runtime.store['Bandit 1.activeConditions'] = ['grappled'];
    runtime.store['Bandit 1.activeConditionMeta'] = { grappled: { dc: 14, ability: 'str', source: 'Bandit Captain 1' } };
    renderMindFlayer();
    fireEvent.click(saveChip('Extract Brain'));

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(15);
    expect(ctx.saveType).toBe('Constitution');
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('10d10');
    expect(ctx.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'extract_brain_refused');
    expect(refusal).toBeUndefined();
  });
});
