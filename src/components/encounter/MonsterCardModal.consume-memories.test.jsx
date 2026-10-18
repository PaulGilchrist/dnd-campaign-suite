// @maintained-by-ai: 2026-10-18
// MA-0019 regression: Aboleth Consume Memories target-eligibility gate.
// The save row carries target_prerequisite {conditions:["charmed","grappled"],
// by_attacker:true}. Owned HERE: the disk row BY name (#387) and the modal
// producer seam — an armed target grappled BY THIS MONSTER resolves through
// rollSavingThrow with the consumeMemoriesClause producer flag TRUE (the
// consumer lives in saveProcessing — see saveProcessing.consumeMemories.test.js,
// whose header points producer-side coverage back to this file); any other
// target is refused once with popup + consume_memories_refused log, zero roll.
// An ungated sibling row rides the SAME render inert (flag FALSE — the
// consumer never arms for clauseless rows).
// Helper truth tables are NOT re-run here: evaluateTargetPrerequisiteGate
// (unmet refuse shape, source≠attacker refuse, source===attacker admit) is
// owned by MA-1275, multi-condition OR + null-parse by MA-1652, and the
// by_attacker:true parse byte by MA-1890 — all over this shared handleSaveRoll seam.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const CONSUME_MEMORIES = monstersData.find(m => m.name === 'Aboleth').actions.find(a => a.name === 'Consume Memories');
const MIND_ROT = { name: 'Mind Rot', save_dc: 15, save_type: 'Intelligence', damage_dice_primary: '6d8', damage_type_primary: 'Psychic', save_effect: 'Failure: 27 (6d8) Psychic damage. Success: Half damage' };

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

// getCombatContext fires from the mount fallback useEffect — keep it null-stubbed.
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
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
  { name: 'Aboleth 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAboleth() {
  const m = makeMonster({ name: 'Aboleth', actions: [CONSUME_MEMORIES, MIND_ROT] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function saveChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('div')?.textContent.includes(actionName)) || null;
}

describe('MA-0019 monsters.json data: Consume Memories carries target_prerequisite', () => {
  it('authors target_prerequisite charmed/grappled by_attacker with exact save core', () => {
    expect(CONSUME_MEMORIES.target_prerequisite).toEqual({ conditions: ['charmed', 'grappled'], by_attacker: true });
    expect(CONSUME_MEMORIES.save_dc).toBe(16);
    expect(CONSUME_MEMORIES.save_type).toBe('Intelligence');
    expect(CONSUME_MEMORIES.damage_dice_primary).toBe('3d6');
    expect(CONSUME_MEMORIES.damage_type_primary).toBe('Psychic');
  });
});

describe('MA-0019 MonsterCardModal Consume Memories gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('prerequisite met (grappled by aboleth): resolves the save unchanged, producer flag set, no refusal', () => {
    runtime.store['TestPC.activeConditions'] = ['grappled'];
    runtime.store['TestPC.activeConditionMeta'] = { grappled: { dc: 14, ability: 'str', source: 'Aboleth 1' } };
    renderAboleth();
    fireEvent.click(saveChip('Consume Memories'));

    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(16);
    expect(ctx.saveType).toBe('Intelligence');
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('3d6');
    expect(ctx.targetName).toBe('TestPC');
    expect(ctx.consumeMemoriesClause).toBe(true);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('unmet: refused once with popup + consume_memories_refused log, zero roll; ungated Mind Rot row rides inert (flag false)', () => {
    renderAboleth();
    fireEvent.click(saveChip('Consume Memories'));

    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, refusal] = addEntry.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    expect(refusal.automationType).toBe('consume_memories_refused');
    expect(refusal.characterName).toBe('Aboleth 1');
    expect(refusal.targetName).toBe('TestPC');

    // Ungated save rows are untouched by the MA-0019 gate: same click seam
    // resolves directly and NEVER arms the consume-memories consumer.
    fireEvent.click(saveChip('Mind Rot'));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(rollSavingThrow.mock.calls[0][2].consumeMemoriesClause).toBe(false);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });
});
