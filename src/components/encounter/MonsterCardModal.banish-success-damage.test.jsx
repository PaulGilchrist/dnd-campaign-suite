// MA-0218: Ancient Gold Dragon Banish lists damage under Failure ONLY — a
// successful save must apply ZERO damage. The row now authors dc_success:"none"
// (Adult Gold Banish MA-0104 sibling shape) so resolveBlockSaveDcSuccess stops
// defaulting the save context to 'half'; computeDamageAfterSave(…, 'none')
// returns 0 on success / full raw on failure. The once-per-turn gate clause
// rides the MA-0073 cooldown stamp, and a same-boundary re-click refuses
// (legendary_use_refused, zero spend, no second save rolled).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 24, rolls: [6, 6, 4, 4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 48, rolls: [6, 6, 4, 4, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
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

const CREATURES = [
  { name: 'Ancient Gold Dragon 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 546, maxHp: 546, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

const CHAIN_CREATURES = [
  { name: 'Chain Devil 1', type: 'npc', targetName: 'Bandit 1', currentHp: 85, maxHp: 85, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const ancient = () => monstersData.find(m => m.name === 'Ancient Gold Dragon');
const ancientRow = () => ancient().legendary_actions.find(a => a.name === 'Banish');
const ancientActions = () => [{ name: 'Rend', attack_bonus: 16, damage_dice_primary: '2d8 + 9', damage_type_primary: 'Slashing', damage_dice_secondary: '2d8', damage_type_secondary: 'Lightning', reach: '15 ft.' }];

function renderAncient(uses) {
  if (uses !== undefined) runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Ancient Gold Dragon', actions: ancientActions(), legendary_actions: ancient().legendary_actions });
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Gold Dragon 1', creatures: CREATURES })} />);
}

function banishRow() {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Banish'));
}

describe('MA-0218 monsters.json data lock: Ancient Gold Dragon Banish row', () => {
  it('authors dc_success none (failure-only damage) with DC 24 Charisma 7d6 Force', () => {
    const row = ancientRow();
    expect(row.save_dc).toBe(24);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('7d6');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(hasLegendaryCooldownClause(row)).toBe(true);
  });

  it('legendary header authors numeric uses:3 (MA-0217) arming the economy', () => {
    expect(ancient().legendary_actions[0].uses).toBe(3);
  });
});

describe('MA-0218 MonsterCardModal Banish save: zero damage on success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('save context carries dcSuccess none: success = 0 damage, failure = full raw', async () => {
    renderAncient({ max: 3, used: 0 });
    fireEvent.click(banishRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(24);
    expect(context.dcSuccess).toBe('none');
    expect(context.saveConditions).toContain('incapacitated');
    expect(context.demiplaneTransport).toEqual({ effect: 'banished_demiplane' });
    expect(computeDamageAfterSave(24, true, context.dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(24, false, context.dcSuccess)).toBe(24);
  });

  it('first click spends a use + stamps the banish cooldown; same-boundary re-click refuses zero-spend', async () => {
    renderAncient({ max: 3, used: 0 });
    fireEvent.click(banishRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ banish: { round: 1 } });

    fireEvent.click(banishRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const refusal = addEntry.mock.calls.find(([, e]) => e.automationType === 'legendary_use_refused');
    expect(refusal).toBeTruthy();
    expect(refusal[1].description).toMatch(/Banish legendary action refused/);
  });
});

// MA-0481: Chain Devil Conjure Infernal Chain — prose "Success: The chain
// disappears." = ZERO on a successful save; the absent dc_success field let
// resolveBlockSaveDcSuccess default the success leg to 'half' (live proof:
// nat 19 vs DC 15 paid finalDamage 3, hp 951→948). Same MA-0218 byte-shape
// data fix rides the same block-save seam: dc_success:"none" threaded onto
// the save context → computeDamageAfterSave(…, 'none') = 0 on success, full
// raw on failure (fail leg byte-identical: 2d4+4 + Restrained).
const chainDevil = () => monstersData.find(m => m.index === 'chain-devil');
const chainRow = () => chainDevil().actions.find(a => a.name === 'Conjure Infernal Chain');

function renderChainDevil() {
  const m = makeMonster({ name: 'Chain Devil', armor_class: 15, hit_points: 85, actions: chainDevil().actions });
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CHAIN_CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Chain Devil 1', creatures: CHAIN_CREATURES })} />);
}

// MA-0481 gotcha: the Multiattack row text also mentions the action —
// scope straight to the labelled save chip, not the first row match.
function conjureSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.textContent.includes('DC 15 Dexterity')) || null;
}

describe('MA-0481 monsters.json data lock: Chain Devil Conjure Infernal Chain row', () => {
  it('authors dc_success none (success = chain disappears) with DC 15 Dexterity 2d4 + 4 Fire', () => {
    const row = chainRow();
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('2d4 + 4');
    expect(row.damage_type_primary).toBe('Fire');
    expect(row.range).toBe('60 feet');
    expect(row.save_effect).toMatch(/Restrained/);
    expect(row.description).toMatch(/Success:\s*<\/strong>?\s*The chain disappears/i);
  });
});

describe('MA-0481 MonsterCardModal Conjure Infernal Chain save: zero damage on success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('save chip context carries dcSuccess none: success = 0 damage, failure = full raw', async () => {
    renderChainDevil();
    fireEvent.click(conjureSaveChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(15);
    expect(context.dcSuccess).toBe('none');
    expect(context.saveConditions).toContain('restrained');
    expect(computeDamageAfterSave(24, true, context.dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(24, false, context.dcSuccess)).toBe(24);
  });
});
