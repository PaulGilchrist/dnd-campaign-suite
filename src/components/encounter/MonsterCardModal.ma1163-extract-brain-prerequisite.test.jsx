// MA-1163 regression: Mind Flayer Extract Brain grappled-target prerequisite.
// The save row now authors target_prerequisite {conditions:["grappled"]} (MA-0019
// byte-shape minus by_attacker — Tentacles provenance unestablished, source-agnostic
// per the MA-0687 twin) and handleSaveRoll's evaluateTargetPrerequisiteGate refuses
// an ungrappled armed target with the MA-0019 refusal popup + extract_brain_refused
// log, zero save roll, nothing spent; a grappled target resolves the save exactly as
// before (DC 15 CON, 10d10 Piercing, half on success). Tentacles sibling untouched.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { parseTargetPrerequisite, evaluateTargetPrerequisiteGate, buildTargetPrerequisiteRefusalLog } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const MIND_FLYER = monstersData.find(m => m.name === 'Mind Flayer');
const EXTRACT_BRAIN = MIND_FLYER.actions.find(a => a.name === 'Extract Brain');
const TENTACLES = MIND_FLYER.actions.find(a => a.name === 'Tentacles');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 55, rolls: [6, 10, 6, 6, 1, 10, 6, 3, 4, 7], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 110, rolls: [6, 10, 6, 6, 1, 10, 6, 3, 4, 7], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
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

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 5)),
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

describe('MA-1163 monsters.json data: Extract Brain carries grappled target_prerequisite', () => {
  it('authors target_prerequisite {conditions:["grappled"]} with exact save core', () => {
    expect(EXTRACT_BRAIN.target_prerequisite).toEqual({ conditions: ['grappled'] });
    expect(EXTRACT_BRAIN.target_prerequisite.by_attacker).toBeUndefined();
    expect(EXTRACT_BRAIN.save_dc).toBe(15);
    expect(EXTRACT_BRAIN.save_type).toBe('Constitution');
    expect(EXTRACT_BRAIN.damage_dice_primary).toBe('10d10');
    expect(EXTRACT_BRAIN.damage_type_primary).toBe('Piercing');
  });

  it('Tentacles sibling untouched (no target_prerequisite)', () => {
    expect(TENTACLES.target_prerequisite).toBeUndefined();
    expect(parseTargetPrerequisite(TENTACLES)).toBeNull();
  });
});

describe('MA-1163 parseTargetPrerequisite + gate on the save row (by_attacker absent)', () => {
  it('parseTargetPrerequisite returns conditions ["grappled"], byAttacker false', () => {
    const prereq = parseTargetPrerequisite(EXTRACT_BRAIN);
    expect(prereq.conditions).toEqual(['grappled']);
    expect(prereq.byAttacker).toBe(false);
    expect(prereq.attackName).toBe('Extract Brain');
  });

  it('ungrappled target refuses with extract_brain_refused refusal shape', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: EXTRACT_BRAIN,
      target: { name: 'Bandit 1' },
      monsterName: 'Mind Flayer 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? [] : null),
    });
    expect(gate.satisfied).toBe(false);
    expect(String(gate.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(gate.popupHtml)).toContain('must be Grappled.');
    expect(gate.refusalLog.automationType).toBe('extract_brain_refused');
    expect(gate.refusalLog.characterName).toBe('Mind Flayer 1');
    expect(gate.refusalLog.targetName).toBe('Bandit 1');
  });

  it('grappled target (source-agnostic) is admitted', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: EXTRACT_BRAIN,
      target: { name: 'Bandit 1' },
      monsterName: 'Mind Flayer 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? ['grappled'] : { grappled: { source: 'Bandit Captain 1' } }),
    });
    expect(gate.satisfied).toBe(true);
    expect(gate.prerequisite.byAttacker).toBe(false);
  });

  it('refusal log slug is extract_brain_refused', () => {
    const entry = buildTargetPrerequisiteRefusalLog({ monsterName: 'Mind Flayer 1', actionName: 'Extract Brain', targetName: 'Bandit 1', prerequisite: parseTargetPrerequisite(EXTRACT_BRAIN) });
    expect(entry.automationType).toBe('extract_brain_refused');
    expect(entry.type).toBe('automation');
    expect(entry.targetName).toBe('Bandit 1');
  });
});

describe('MA-1163 MonsterCardModal Extract Brain SAVE-chip gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('ungrappled target: popup + extract_brain_refused log, zero save roll, no prompt', async () => {
    renderMindFlayer();
    fireEvent.click(saveChip('Extract Brain'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'extract_brain_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Mind Flayer 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('grappled target (any source): resolves the save unchanged, DC 15 CON / 10d10 Piercing', async () => {
    runtime.store['Bandit 1.activeConditions'] = ['grappled'];
    runtime.store['Bandit 1.activeConditionMeta'] = { grappled: { dc: 14, ability: 'str', source: 'Mind Flayer 1' } };
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
