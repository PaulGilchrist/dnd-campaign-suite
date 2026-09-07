// CLA-324 Spell Resistance (Wizard / Abjurer lv14) regression tests.
// Locks down: spell-origin damage halved for a damageResistance:['Spell'] target;
// non-spell damage NOT halved; non-holder NOT halved.
import { describe, it, expect, vi } from 'vitest';

import { applyDamageToTarget, computeDamageAfterResistancesWithDetails } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 82,
    currentHp: 82,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

function createHolderCharacter(name) {
  // Abjurer lv14 Spell Resistance passive: passive_immunity damageResistance:['Spell']
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: {
        passives: [
          { type: 'passive_immunity', damageResistance: ['Spell'], name: 'Spell Resistance' },
        ],
      },
    },
  };
}

function createNonHolderCharacter(name) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

function stubRuntime(currentHp, lastAttack = null) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return lastAttack;
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'hitPoints') return currentHp;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    return undefined;
  });
}

// ── Pure helper ─────────────────────────────────────────────────

describe('computeDamageAfterResistancesWithDetails — categorical Spell resistance', () => {
  it('halves spell-origin damage when resistances include Spell', () => {
    const r = computeDamageAfterResistancesWithDetails(14, ['Cold'], ['Spell'], [], false, true);
    expect(r.finalDamage).toBe(7);
    expect(r.typeDetails).toEqual([{ damageType: 'Spell', status: 'resistant' }]);
  });

  it('does NOT halve non-spell-origin damage even when resistances include Spell', () => {
    const r = computeDamageAfterResistancesWithDetails(14, ['Cold'], ['Spell'], [], false, false);
    expect(r.finalDamage).toBe(14);
    expect(r.typeDetails).toEqual([]);
  });

  it('does NOT double-halve when a concrete type already matched', () => {
    const r = computeDamageAfterResistancesWithDetails(14, ['Cold'], ['Cold', 'Spell'], [], false, true);
    expect(r.finalDamage).toBe(7);
    expect(r.typeDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('does NOT halve spell-origin damage when resistance is ignored', () => {
    const r = computeDamageAfterResistancesWithDetails(14, ['Cold'], ['Spell'], [], true, true);
    expect(r.finalDamage).toBe(14);
  });

  it('immunity wins over spell-origin halving', () => {
    const r = computeDamageAfterResistancesWithDetails(14, ['Cold'], ['Spell'], ['Cold'], false, true);
    expect(r.finalDamage).toBe(0);
    expect(r.typeDetails).toEqual([{ damageType: 'Cold', status: 'immune' }]);
  });
});

// ── applyDamageToTarget integration ────────────────────────────

describe('applyDamageToTarget — CLA-324 Spell Resistance halving', () => {
  it('halves spell-origin damage for a damageResistance:[Spell] holder and logs', async () => {
    const { getDamageResistances } = await import('../../combat/automation/automationPassives.js');
    getDamageResistances.mockReturnValue(['Spell']);
    const logModule = await import('../../ui/logService.js');
    logModule.addEntry.mockClear();

    const player = createPlayerCreature('DivinationWizard');
    const cs = makeCombatSummary([player]);
    stubRuntime(82);

    const result = await applyDamageToTarget(cs, 'DivinationWizard', 14, ['Cold'], 'test-campaign', [
      createHolderCharacter('DivinationWizard'),
    ], false, 'Gazer 1', false, { isSpellDamage: true });

    expect(result.finalDamage).toBe(7);
    expect(result.damageReduced).toBe(true);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Spell', status: 'resistant' }]);
    expect(player.currentHp).toBe(82);

    const resistLog = logModule.addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Spell Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain('DivinationWizard');
    expect(resistLog[1].description).toContain('14 spell damage halved to 7');
  });

  it('does NOT halve non-spell-origin damage for the holder', async () => {
    const { getDamageResistances } = await import('../../combat/automation/automationPassives.js');
    getDamageResistances.mockReturnValue(['Spell']);

    const player = createPlayerCreature('DivinationWizard');
    const cs = makeCombatSummary([player]);
    stubRuntime(82);

    const result = await applyDamageToTarget(cs, 'DivinationWizard', 14, ['Cold'], 'test-campaign', [
      createHolderCharacter('DivinationWizard'),
    ], false, 'Thug 1');

    expect(result.finalDamage).toBe(14);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('does NOT halve spell-origin damage for a non-holder', async () => {
    const { getDamageResistances } = await import('../../combat/automation/automationPassives.js');
    getDamageResistances.mockReturnValue([]);

    const player = createPlayerCreature('AberrantSorcerer');
    const cs = makeCombatSummary([player]);
    stubRuntime(44);

    const result = await applyDamageToTarget(cs, 'AberrantSorcerer', 11, ['Cold'], 'test-campaign', [
      createNonHolderCharacter('AberrantSorcerer'),
    ], false, 'Gazer 1', false, { isSpellDamage: true });

    expect(result.finalDamage).toBe(11);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('halves via spell-save lastAttack stamp without an explicit option', async () => {
    const { getDamageResistances } = await import('../../combat/automation/automationPassives.js');
    getDamageResistances.mockReturnValue(['Spell']);

    const player = createPlayerCreature('DivinationWizard');
    const cs = makeCombatSummary([player]);
    stubRuntime(82, { rollType: 'spell-save', attackerName: 'Archmage', attackName: 'Fireball' });

    const result = await applyDamageToTarget(cs, 'DivinationWizard', 20, ['Fire'], 'test-campaign', [
      createHolderCharacter('DivinationWizard'),
    ], false, 'Archmage');

    expect(result.finalDamage).toBe(10);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Spell', status: 'resistant' }]);
  });

  it('does NOT halve weapon damage even when a stale spell-save lastAttack lingers (holder, non-spell-origin)', async () => {
    const { getDamageResistances } = await import('../../combat/automation/automationPassives.js');
    getDamageResistances.mockReturnValue(['Spell']);

    const player = createPlayerCreature('DivinationWizard');
    const cs = makeCombatSummary([player]);
    // Monster melee attack stamp — NOT spell-origin.
    stubRuntime(82, { rollType: 'attack', attackerName: 'Knight 1', attackName: 'Greatsword' });

    const result = await applyDamageToTarget(cs, 'DivinationWizard', 14, ['Slashing'], 'test-campaign', [
      createHolderCharacter('DivinationWizard'),
    ], false, 'Knight 1');

    expect(result.finalDamage).toBe(14);
  });
});
