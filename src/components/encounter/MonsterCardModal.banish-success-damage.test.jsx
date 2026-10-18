// @maintained-by-ai
// MA-0218: Ancient Gold Dragon Banish lists damage under Failure ONLY — a
// successful save must apply ZERO damage. The row authors dc_success:"none"
// so blockSaveDcSuccess stops defaulting the save context to 'half'; the
// click-time context (buildAbilitySaveRollContext, MonsterCardModal.jsx:1794)
// rides dcSuccess + autoDamageFormula bytes verbatim to saveProcessing.
// The once-per-turn gate clause rides the MA-0073 cooldown stamp, and a
// same-boundary re-click refuses (legendary_use_refused, zero spend, no
// second save rolled). DC 24 Ancient uniquely complements the Adult DC 21
// demiplane lane in MonsterCardModal.banish-demiplane.test.jsx (#581).
//
// Family collapse (MA-0481/0505/0514/0523/0567): every duplicate
// "dc_success none = zero on success" click-through retired to ONE test per
// distinct modal branch — block save with transport+cooldown (Ancient,
// test 2), normal-action save chip with the Multiattack text-collision
// scoping (Chain Devil), reaction-section save chip (Cockatrice Regent).
// Constrictor/Couatl/Fell Word chip clicks were byte-identical reruns of
// the Chain Devil branch (same saveChipPlan → handleSaveRoll →
// executeBlockSaveRoll seam) and now pin only their unique row-data keys.
// Compute-face owners for 'none' semantics: applyDamage.save-full.test.js:22-24
// (computeDamageAfterSave) + saveProcessing.* suite — no inline math reruns here.
// Transport owners: MonsterCardHelpers.banish-transport.test.js + soul-tome-trap.test.js (#563).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
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

// One isolation seam for every click test: fresh roll mocks + fresh runtime
// store so mock.calls[0] always belongs to THIS test's click.
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

const CREATURES = [
  { name: 'Ancient Gold Dragon 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 546, maxHp: 546, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
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
  it('authors dc_success none (failure-only damage) with DC 24 Charisma 7d6 Force, uses 3 armed (MA-0217)', () => {
    const row = ancientRow();
    expect(row.save_dc).toBe(24);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('7d6');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(hasLegendaryCooldownClause(row)).toBe(true);
    expect(ancient().legendary_actions[0].uses).toBe(3);
  });
});

describe('MA-0218 MonsterCardModal Banish save: zero damage on success', () => {
  it('block-save click context carries dcSuccess none + 7d6 Force damage byte: success face pays zero', async () => {
    renderAncient({ max: 3, used: 0 });
    fireEvent.click(banishRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(24);
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('7d6');
    expect(context.autoDamageDamageType).toContain('Force');
    expect(context.saveConditions).toContain('incapacitated');
    expect(context.demiplaneTransport).toEqual({ effect: 'banished_demiplane' });
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
// nat 19 vs DC 15 paid finalDamage 3, hp 951→948). Representative of the
// NORMAL-ACTION save-chip branch: saveChipPlan chip → handleSaveRoll →
// executeBlockSaveRoll, same ctx builder as the block-save lane above.
// MA-0481 gotcha: the Multiattack row text also mentions the action —
// scope straight to the labelled save chip, not the first row match.
const chainDevil = () => monstersData.find(m => m.index === 'chain-devil');
const chainRow = () => chainDevil().actions.find(a => a.name === 'Conjure Infernal Chain');

const CHAIN_CREATURES = [
  { name: 'Chain Devil 1', type: 'npc', targetName: 'Bandit 1', currentHp: 85, maxHp: 85, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderChainDevil() {
  const m = makeMonster({ name: 'Chain Devil', armor_class: 15, hit_points: 85, actions: chainDevil().actions });
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CHAIN_CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Chain Devil 1', creatures: CHAIN_CREATURES })} />);
}

function conjureSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.textContent.includes('DC 15 Dexterity')) || null;
}

describe('MA-0481 Chain Devil Conjure Infernal Chain: dc_success none row + chip save lane', () => {
  it('authored row locks DC 15 Dex 2d4 + 4 Fire none (success = chain disappears)', () => {
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

  it('save chip context carries dcSuccess none + damage byte: success face pays zero', async () => {
    renderChainDevil();
    fireEvent.click(conjureSaveChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(15);
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('2d4 + 4');
    expect(context.saveConditions).toContain('restrained');
  });
});

// MA-0505: Cockatrice Regent Magical Backlash — reactions[0], failure-only
// damage prose; the absent dc_success field let the save context default to
// 'half' (live proof: nat 20 vs DC 14 SAVE SUCCESS paid finalDamage 7).
// Representative of the REACTION-section save-chip branch (same
// executeBlockSaveRoll seam, rendered from reactions[]).
const cockatrice = () => monstersData.find(m => m.index === 'cockatrice-regent');
const backlashRow = () => cockatrice().reactions.find(a => a.name === 'Magical Backlash');

const COCKATRICE_CREATURES = [
  { name: 'Cockatrice Regent 1', type: 'npc', targetName: 'Bandit 1', currentHp: 136, maxHp: 136, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderCockatrice() {
  const m = makeMonster({ name: 'Cockatrice Regent', armor_class: 15, hit_points: 136, actions: cockatrice().actions, reactions: cockatrice().reactions });
  ctx.value = { round: 1, activeCreatureName: 'Cockatrice Regent 1', creatures: COCKATRICE_CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Cockatrice Regent 1', creatures: COCKATRICE_CREATURES })} />);
}

function backlashSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.textContent.includes('DC 14 Dexterity')) || null;
}

describe('MA-0505 Cockatrice Regent Magical Backlash: dc_success none reaction lane', () => {
  it('authored reaction row locks DC 14 Dex 3d6 + 3 Force none, failure-only prose', () => {
    const row = backlashRow();
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6 + 3');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.range).toBe('120 feet');
    expect(row.description).toMatch(/<strong>Failure:<\/strong>\s*13 \(3d6 \+ 3\) Force damage\./);
    expect(row.description).not.toMatch(/Success:/i);
  });

  it('reaction save chip context carries dcSuccess none + damage byte: success face pays zero', async () => {
    renderCockatrice();
    fireEvent.click(backlashSaveChip());
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(14);
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('3d6 + 3');
  });
});

// MA-0514/MA-0523/MA-0567 row-data locks: the dc_success:"none" +
// escape_dc / advisory keys on these rows are pinned ONLY here (distinct
// JSON rows; giant-constrictor-snake's twin lives in
// services/rules/combat/giant-constrictor-snake-constrict-dc-success.test.js).
// Their modal click-through is byte-identical to the Chain Devil chip
// branch above (saveChipPlan → handleSaveRoll → executeBlockSaveRoll with
// the same buildAbilitySaveRollContext), so no duplicate click tests remain.
describe('MA-0514 monsters.json data lock: Constrictor Snake Constrict row', () => {
  it('authors dc_success none + escape_dc 12 with DC 12 Strength 3d4 Bludgeoning + Grappled', () => {
    const row = monstersData.find(m => m.index === 'constrictor-snake').actions[1];
    expect(row.name).toBe('Constrict');
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Strength');
    expect(row.dc_success).toBe('none');
    expect(row.escape_dc).toBe(12);
    expect(row.damage_dice_primary).toBe('3d4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    expect(row.range).toBe('5 feet');
    expect(row.save_effect).toMatch(/Grappled.*escape DC 12/i);
    expect(row.description).toMatch(/<strong>Failure:<\/strong>\s*7 \(3d4\) Bludgeoning damage/);
    expect(row.description).not.toMatch(/Success:/i);
    // RESIDUAL lock (MA-0514): escape_dc rides ONLY the attack-hit
    // hit_conditions stamper — save-row grapple meta carries no dc field.
    expect(row.hit_conditions).toBeUndefined();
  });
});

describe('MA-0523 monsters.json data lock: Couatl Constrict row', () => {
  it('authors dc_success none + escape_dc 13 with DC 15 Strength 1d6 + 5 Bludgeoning + Grappled, Restrained', () => {
    const row = monstersData.find(m => m.name === 'Couatl').actions[1];
    expect(row.name).toBe('Constrict');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.dc_success).toBe('none');
    expect(row.escape_dc).toBe(13);
    expect(row.damage_dice_primary).toBe('1d6 + 5');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    expect(row.range).toBe('5 feet');
    expect(row.save_effect).toMatch(/Grappled.*escape DC 13.*Restrained/i);
    expect(row.description).toMatch(/<strong>Failure:<\/strong>\s*8 \(1d6 \+ 5\) Bludgeoning damage/);
    expect(row.description).not.toMatch(/Success:/i);
    expect(row.hit_conditions).toBeUndefined();
  });
});

describe('MA-0567 monsters.json data lock: Death Knight Fell Word row', () => {
  it('authors dc_success none (failure-only damage) with DC 18 Constitution 5d6 Necrotic + advisory hp-max clause', () => {
    const row = monstersData.find(m => m.index === 'death-knight').legendary_actions.find(a => a.name === 'Fell Word');
    expect(row.save_dc).toBe(18);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('5d6');
    expect(row.damage_type_primary).toBe('Necrotic');
    expect(row.range).toBe('120 feet');
    expect(row.description).toMatch(/<strong>Failure:<\/strong>\s*17 \(5d6\) Necrotic damage/);
    expect(hasLegendaryCooldownClause(row)).toBe(true);
    // RESIDUAL lock (MA-0483 §116 precedent): the hp-max-reduction clause in
    // save_effect has ZERO producers app-wide — readers-only, advisory-unbuilt.
    expect(row.save_effect).toMatch(/Hit Point maximum decreases by an amount equal to the damage taken/i);
    expect(row.hit_conditions).toBeUndefined();
  });
});
