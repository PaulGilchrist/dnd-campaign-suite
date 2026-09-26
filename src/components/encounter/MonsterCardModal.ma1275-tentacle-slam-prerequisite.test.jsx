// MA-1275 regression: Otyugh Tentacle Slam grappled-by-the-otyugh prerequisite.
// The save row now authors target_prerequisite {conditions:["grappled"],
// by_attacker:true} (MA-0019 aboleth byte-shape) after save_effect; handleSaveRoll's
// evaluateTargetPrerequisiteGate refuses an ungrappled armed target AND a victim
// grappled by someone else (source ≠ attacker) with the MA-0019 refusal popup +
// tentacle_slam_refused log, zero save roll, nothing spent; a victim grappled BY the
// otyugh (provenance stamped live by the MA-1274 Tentacle hit_conditions seam)
// resolves the save exactly as before (DC 14 CON, 3d8 + 3 Bludgeoning, half default).
// Bite/Tentacle siblings untouched.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { parseTargetPrerequisite, evaluateTargetPrerequisiteGate, buildTargetPrerequisiteRefusalLog } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const OTYUGH = monstersData.find(m => m.name === 'Otyugh');
const BITE = OTYUGH.actions.find(a => a.name === 'Bite');
const TENTACLE = OTYUGH.actions.find(a => a.name === 'Tentacle');
const TENTACLE_SLAM = OTYUGH.actions.find(a => a.name === 'Tentacle Slam');

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 16, rolls: [3, 6, 4], modifier: 3 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 29, rolls: [3, 6, 4], modifier: 3 })),
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
  { name: 'Otyugh 1', type: 'npc', monsterType: 'aberration', targetName: 'Bandit 1', currentHp: 999, maxHp: 999, ac: 13, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderOtyugh() {
  const m = makeMonster({ name: 'Otyugh', actions: [BITE, TENTACLE, TENTACLE_SLAM] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Otyugh 1', creatures: CREATURES })} />);
}

function saveChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-1275 monsters.json data: Tentacle Slam carries grappled-by-attacker target_prerequisite', () => {
  it('authors target_prerequisite {conditions:["grappled"],by_attacker:true} with exact save core', () => {
    expect(TENTACLE_SLAM.target_prerequisite).toEqual({ conditions: ['grappled'], by_attacker: true });
    expect(TENTACLE_SLAM.save_dc).toBe(14);
    expect(TENTACLE_SLAM.save_type).toBe('Constitution');
    expect(TENTACLE_SLAM.damage_dice_primary).toBe('3d8 + 3');
    expect(TENTACLE_SLAM.damage_type_primary).toBe('Bludgeoning');
    expect(TENTACLE_SLAM.dc_success).toBeUndefined();
  });

  it('target_prerequisite placed immediately after save_effect (MA-0019 byte-shape)', () => {
    const keys = Object.keys(TENTACLE_SLAM);
    expect(keys.indexOf('target_prerequisite')).toBe(keys.indexOf('save_effect') + 1);
  });

  it('Bite/Tentacle siblings untouched (MA-1273/1274 rows carry no target_prerequisite)', () => {
    expect(BITE.target_prerequisite).toBeUndefined();
    expect(TENTACLE.target_prerequisite).toBeUndefined();
    expect(parseTargetPrerequisite(TENTACLE)).toBeNull();
  });
});

describe('MA-1275 parseTargetPrerequisite + gate on the save row (by_attacker true)', () => {
  it('parseTargetPrerequisite returns conditions ["grappled"], byAttacker true', () => {
    const prereq = parseTargetPrerequisite(TENTACLE_SLAM);
    expect(prereq.conditions).toEqual(['grappled']);
    expect(prereq.byAttacker).toBe(true);
    expect(prereq.attackName).toBe('Tentacle Slam');
  });

  it('ungrappled target refuses with tentacle_slam_refused refusal shape', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: TENTACLE_SLAM,
      target: { name: 'Bandit 1' },
      monsterName: 'Otyugh 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? [] : null),
    });
    expect(gate.satisfied).toBe(false);
    expect(String(gate.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(gate.popupHtml)).toContain('must be Grappled by Otyugh 1.');
    expect(gate.refusalLog.automationType).toBe('tentacle_slam_refused');
    expect(gate.refusalLog.characterName).toBe('Otyugh 1');
    expect(gate.refusalLog.targetName).toBe('Bandit 1');
  });

  it('grappled victim with source ≠ attacker refuses (by_attacker provenance check)', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: TENTACLE_SLAM,
      target: { name: 'Bandit 1' },
      monsterName: 'Otyugh 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? ['grappled'] : { grappled: { source: 'Bandit Captain 1' } }),
    });
    expect(gate.satisfied).toBe(false);
    expect(gate.refusalLog.automationType).toBe('tentacle_slam_refused');
  });

  it('grappled victim with source === attacker name is admitted', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: TENTACLE_SLAM,
      target: { name: 'Bandit 1' },
      monsterName: 'Otyugh 1',
      campaignName: 'test-campaign',
      getRuntimeValue: (k, p) => (p === 'activeConditions' ? ['grappled'] : { grappled: { dc: 13, ability: 'str', source: 'Otyugh 1' } }),
    });
    expect(gate.satisfied).toBe(true);
    expect(gate.prerequisite.byAttacker).toBe(true);
  });

  it('refusal log slug is tentacle_slam_refused', () => {
    const entry = buildTargetPrerequisiteRefusalLog({ monsterName: 'Otyugh 1', actionName: 'Tentacle Slam', targetName: 'Bandit 1', prerequisite: parseTargetPrerequisite(TENTACLE_SLAM) });
    expect(entry.automationType).toBe('tentacle_slam_refused');
    expect(entry.type).toBe('automation');
    expect(entry.targetName).toBe('Bandit 1');
  });
});

describe('MA-1275 MonsterCardModal Tentacle Slam SAVE-chip gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('ungrappled target: popup + tentacle_slam_refused log, zero save roll, no prompt', async () => {
    renderOtyugh();
    fireEvent.click(saveChip('Tentacle Slam'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'tentacle_slam_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Otyugh 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('grappled by another: still refuses, zero save roll', async () => {
    runtime.store['Bandit 1.activeConditions'] = ['grappled'];
    runtime.store['Bandit 1.activeConditionMeta'] = { grappled: { dc: 12, ability: 'str', source: 'Bandit Captain 1' } };
    renderOtyugh();
    fireEvent.click(saveChip('Tentacle Slam'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'tentacle_slam_refused');
    expect(refusal).toBeTruthy();
  });

  it('grappled by the otyugh: resolves the save unchanged, DC 14 CON / 3d8 + 3 Bludgeoning half-default', async () => {
    runtime.store['Bandit 1.activeConditions'] = ['grappled'];
    runtime.store['Bandit 1.activeConditionMeta'] = { grappled: { dc: 13, ability: 'str', source: 'Otyugh 1' } };
    renderOtyugh();
    fireEvent.click(saveChip('Tentacle Slam'));

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(14);
    expect(ctx.saveType).toBe('Constitution');
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('3d8 + 3');
    expect(ctx.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'tentacle_slam_refused');
    expect(refusal).toBeUndefined();
  });
});
