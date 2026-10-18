// @maintained-by-ai
// BA-001: Dodge (baseAction) — EB monster attack rolls against a dodging PC
// must fold the Dodge activeBuff into attack mode as Disadvantage (2d20,
// mode marker), mirroring the verified PC-side seam countDodgeDisadvantage
// (contextBuilder-sync.js:631) and the active-buff-backed
// applyProtectionFromEvilPenalty fold in this file. Before the fix
// buildTargetEffectData read conditions + targetEffects only, so the dodging
// PC's buff was invisible to the monster card and every roll was single-d20
// normal mode.
// Owned here: the activeBuffs-backed fold. The condition/te-backed dodge
// fold in combineAttackModes is owned by conditionEffects.test.js:352/507;
// PC-sheet Patient Defense grant lane by useCharActionsAutomation.test.js.
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { applyDodgePenalty } from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 3, rolls: [2], modifier: 1 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 6, rolls: [2, 2], modifier: 2 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack, _setPopupHtml };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
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

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

const MONSTER_NAME = 'Bandit 1';
const SCIMITAR_ACTION = {
  name: 'Scimitar',
  description: 'Melee Attack Roll: +3, reach 5 ft. <strong>Hit:</strong> 4 (1d6 + 1) Slashing damage.',
  attack_bonus: 3,
  reach: '5 ft.',
  damage_dice_primary: '1d6 + 1',
  damage_type_primary: 'Slashing',
};

function renderBandit({ dodging }) {
  runtime.store['LightfootHalfling.activeBuffs'] = dodging
    ? [{ name: 'Dodge', effect: 'dodge', duration: 'until_start_of_next_turn' }]
    : [];
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', targetName: 'LightfootHalfling' },
    { name: 'LightfootHalfling', type: 'player', ac: 14 },
  ];
  const m = makeMonster({ name: 'Bandit', actions: [SCIMITAR_ACTION] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

function scimitarChip() {
  const row = [...document.querySelectorAll('.mc-action')].find(r => (r.querySelector('strong')?.textContent || '').trim().startsWith('Scimitar'));
  return row?.querySelector('span.mc-dice-link') || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('applyDodgePenalty — active-buff fold (unit)', () => {
  const DODGE = [{ name: 'Dodge', effect: 'dodge' }];
  const PLAYER = { name: 'LightfootHalfling', type: 'player' };

  it.each([
    { name: 'folds a dodge buff into a fresh count', buffs: DODGE, target: PLAYER, initial: undefined, expected: 1 },
    { name: 'stacks onto an existing disadvantage count', buffs: DODGE, target: PLAYER, initial: 1, expected: 2 },
    { name: 'is inert without a dodge buff', buffs: [{ name: 'Bless', effect: 'bless_bonus' }], target: PLAYER, initial: undefined, expected: 0 },
    { name: 'is inert for non-player targets', buffs: DODGE, target: { name: 'Ogre', type: 'npc' }, initial: undefined, expected: 0 },
  ])('$name', ({ buffs, target, initial, expected }) => {
    runtime.store[`${target.name}.activeBuffs`] = buffs;
    const data = initial === undefined ? {} : { targetDisadvantageCount: initial };
    applyDodgePenalty(data, target, 'test-campaign');
    expect(data.targetDisadvantageCount ?? 0).toBe(expected);
  });
});

describe('BA-001 MonsterCardModal — Scimitar vs dodge state', () => {
  it.each([
    { dodging: true, expectedMode: 'disadvantage' },
    { dodging: false, expectedMode: 'normal' },
  ])('rolls $expectedMode when target dodging=$dodging', async ({ dodging, expectedMode }) => {
    renderBandit({ dodging });
    const chip = scimitarChip();
    expect(chip).toBeTruthy();
    await act(async () => { fireEvent.click(chip); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Scimitar');
    expect(bonus).toBe(3);
    expect(options.targetName).toBe('LightfootHalfling');
    expect(options.forcedMode ?? 'normal').toBe(expectedMode);
  });
});
