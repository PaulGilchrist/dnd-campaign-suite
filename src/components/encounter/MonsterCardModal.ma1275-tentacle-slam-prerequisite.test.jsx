// @maintained-by-ai
// MA-1275 regression: Otyugh Tentacle Slam grappled-by-the-otyugh prerequisite.
// OWNER FILE for the MA-0019 by_attacker:true gate lane (ma0687, ma0689, ma1163
// cite-skip their gates here): the direct evaluateTargetPrerequisiteGate truth
// table (unmet refuse, source≠attacker refuse, source===attacker admit) + the
// tentacle_slam_refused refusal-log shape live HERE, nowhere else.
// The Otyugh save row authors target_prerequisite {conditions:["grappled"],
// by_attacker:true} after save_effect; the SAVE chip refuses an ungrappled or
// other-grappled target with the provenance-INCLUSIVE popup ("must be Grappled
// by Otyugh 1." — the byAttacker clause, vs the omission on ma0687/ma1163),
// zero save roll, nothing spent; a victim grappled BY the otyugh (provenance
// stamped live by the MA-1274 Tentacle hit_conditions seam) resolves the save
// exactly as before (DC 14 CON, 3d8 + 3 Bludgeoning, half default).
// Cite-skip: by_attacker:true parse byte + refusal description prose — MA-1890;
// satisfaction truth table by_attacker-absent + null-parse — MA-1652 helpers;
// ungated siblings' own lanes — MA-1273/1274 (Bite/Tentacle appear here only as
// byte-inert null-negatives on the same disk lock).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

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

// Network-guard: getCombatContext only fetches when `creatures` is absent —
// never on this lane; all other exports real.
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
  getCombatContext: vi.fn().mockResolvedValue(null),
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

const OTYUGH = monstersData.find(m => m.name === 'Otyugh');
const BITE = OTYUGH.actions.find(a => a.name === 'Bite');
const TENTACLE = OTYUGH.actions.find(a => a.name === 'Tentacle');
const TENTACLE_SLAM = OTYUGH.actions.find(a => a.name === 'Tentacle Slam');

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

function gateWith(conditions, meta) {
  return evaluateTargetPrerequisiteGate({
    action: TENTACLE_SLAM,
    target: { name: 'Bandit 1' },
    monsterName: 'Otyugh 1',
    campaignName: 'test-campaign',
    getRuntimeValue: (k, p) => (p === 'activeConditions' ? conditions : meta ?? null),
  });
}

describe('MA-1275 monsters.json: Tentacle Slam carries grappled-by-attacker target_prerequisite', () => {
  it('authors {conditions:["grappled"],by_attacker:true} + exact save core; Bite/Tentacle siblings byte-inert', () => {
    expect(TENTACLE_SLAM.target_prerequisite).toEqual({ conditions: ['grappled'], by_attacker: true });
    expect(TENTACLE_SLAM.save_dc).toBe(14);
    expect(TENTACLE_SLAM.save_type).toBe('Constitution');
    expect(TENTACLE_SLAM.damage_dice_primary).toBe('3d8 + 3');
    expect(TENTACLE_SLAM.damage_type_primary).toBe('Bludgeoning');
    expect(TENTACLE_SLAM.dc_success).toBeUndefined();
    expect(BITE.target_prerequisite).toBeUndefined();
    expect(TENTACLE.target_prerequisite).toBeUndefined();
  });
});

describe('MA-1275 OWNED gate truth table (by_attacker:true) + tentacle_slam_refused refusal shape', () => {
  it('ungrappled target refuses: provenance-inclusive popup + refusal log, nothing spent', () => {
    const gate = gateWith([], null);
    expect(gate.satisfied).toBe(false);
    // "by Otyugh 1." proves the byAttacker:true provenance clause is INCLUDED here
    expect(String(gate.popupHtml)).toContain('Prerequisite Not Met');
    expect(String(gate.popupHtml)).toContain('must be Grappled by Otyugh 1.');
    expect(gate.refusalLog.type).toBe('automation');
    expect(gate.refusalLog.automationType).toBe('tentacle_slam_refused');
    expect(gate.refusalLog.characterName).toBe('Otyugh 1');
    expect(gate.refusalLog.targetName).toBe('Bandit 1');
  });

  it('grappled by someone else refuses (by_attacker provenance leg)', () => {
    const gate = gateWith(['grappled'], { grappled: { source: 'Bandit Captain 1' } });
    expect(gate.satisfied).toBe(false);
    expect(String(gate.popupHtml)).toContain('must be Grappled by Otyugh 1.');
    expect(gate.refusalLog.automationType).toBe('tentacle_slam_refused');
  });

  it('grappled BY the otyugh admits the save', () => {
    const gate = gateWith(['grappled'], { grappled: { dc: 13, ability: 'str', source: 'Otyugh 1' } });
    expect(gate.satisfied).toBe(true);
    expect(gate.prerequisite.byAttacker).toBe(true);
  });
});

describe('MA-1275 MonsterCardModal Tentacle Slam SAVE-chip gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('ungrappled target: popup + tentacle_slam_refused log, zero save roll', async () => {
    renderOtyugh();
    fireEvent.click(saveChip('Tentacle Slam'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('must be Grappled by Otyugh 1.');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusals = addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'tentacle_slam_refused');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].characterName).toBe('Otyugh 1');
    expect(refusals[0].targetName).toBe('Bandit 1');
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
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'tentacle_slam_refused')).toBeUndefined();
  });
});
