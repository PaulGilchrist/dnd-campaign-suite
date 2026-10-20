// @maintained-by-ai
// CLA-324 Spell Resistance (Abjurer lv14) — owner of the SPELL-ORIGIN seam at applyDamage:
// which arms fire the categorical 'Spell' reduction (options.isSpellDamage, campaign
// lastAttack spell-save / isSpellDamage stamps), which arms stay silent (non-holder,
// non-spell-origin, ignoreResistance, stale stamps), and the 'Spell Resistance' log bytes.
// Generic resistance/halving arithmetic lives in applyDamage.helpers.test.js :53-86;
// passive → ['Spell'] predicate census lives in automationPassives.landResistance.test.js —
// getDamageResistances is mocked here, so which-arm-arms is what this file pins.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget, computeDamageAfterResistancesWithDetails } from './applyDamage.js';
import * as logService from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getDamageResistances } from '../../combat/automation/automationPassives.js';

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

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fixtures ─────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';

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

// Computed-passive bytes verbatim from disk shape (test-campaign HexWarlock.json
// passive_immunity entries) — source feature: classes.json subclasses[1].class_levels[3]
// 'Spell Resistance' (damage_resistance:['Spell'], normalized to camelCase at collection).
function holderCharacters(name) {
  return [{
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
          {
            type: 'passive_immunity',
            name: 'Spell Resistance',
            target: 'self',
            conditionImmunity: '',
            damageResistance: ['Spell'],
            saveAdvantage: [],
            hasAutomation: true,
          },
        ],
      },
    },
  }];
}

function nonHolderCharacters(name) {
  return [{
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
  }];
}

// Name+key-routed store stub (#1057/#1186): only the exact `${name}.${key}` routes this
// lane reads answer; any other lookup stays explicitly null (#940).
function stubRuntime({ name, hp, lastAttack = null }) {
  const values = {
    [`${name}.currentHitPoints`]: hp,
    [`${name}.hitPoints`]: hp,
    [`${name}.activeBuffs`]: [],
    [`${name}.activeConditions`]: [],
    [`${name}.tempHp`]: 0,
    [`${name}.polymorphTempHp`]: 0,
    [`${name}.arcaneWardActive`]: false,
    [`${name}.arcaneWardHp`]: 0,
    [`${name}.projectedWardDamage`]: 0,
    'campaign.lastAttack': lastAttack,
    'campaign.targetEffects': [],
  };
  getRuntimeValue.mockImplementation((storeName, key) => values[`${storeName}.${key}`] ?? null);
}

function spellResistanceLogCalls() {
  return logService.addEntry.mock.calls.filter((c) => c[1].name === 'Spell Resistance');
}

// ── Pure helper: the spellOrigin clause of computeDamageAfterResistancesWithDetails ──

describe('computeDamageAfterResistancesWithDetails — categorical Spell resistance (CLA-324)', () => {
  it.each([
    ['halves spell-origin damage once, stamps Spell-resistant detail',
      { spellOrigin: true }, { finalDamage: 7, typeDetails: [{ damageType: 'Spell', status: 'resistant' }] }],
    ['stays silent for non-spell-origin damage',
      { spellOrigin: false }, { finalDamage: 14, typeDetails: [] }],
    ['ignoreResistance bypasses the spell clause',
      { spellOrigin: true, ignoreResistance: true }, { finalDamage: 14, typeDetails: [] }],
    ['does NOT double-halve when a concrete type already matched',
      { resistances: ['Cold', 'Spell'], spellOrigin: true }, { finalDamage: 7, typeDetails: [{ damageType: 'Cold', status: 'resistant' }] }],
    ['immunity to the concrete type wins over spell-origin halving',
      { immunities: ['Cold'], spellOrigin: true }, { finalDamage: 0, typeDetails: [{ damageType: 'Cold', status: 'immune' }] }],
  ])('%s', (_label, input, expected) => {
    const result = computeDamageAfterResistancesWithDetails({
      rawDamage: 14, damageTypes: ['Cold'], resistances: ['Spell'], immunities: [], ignoreResistance: false, ...input,
    });
    expect(result).toEqual(expected);
  });
});

// ── applyDamageToTarget integration ────────────────────────────

describe('applyDamageToTarget — CLA-324 Spell Resistance halving', () => {
  it('halves spell-origin damage for the holder: store HP, flags, and exact log bytes', async () => {
    getDamageResistances.mockReturnValue(['Spell']);
    const player = createPlayerCreature('DivinationWizard');
    stubRuntime({ name: 'DivinationWizard', hp: 82 });

    const result = await applyDamageToTarget(
      { round: 1, creatures: [player] }, 'DivinationWizard', 14, ['Cold'],
      { campaignName: CAMPAIGN, characters: holderCharacters('DivinationWizard'), isSpellDamage: true, attackerName: 'Gazer 1' },
    );

    expect(result.finalDamage).toBe(7);
    expect(result.damageReduced).toBe(true);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Spell', status: 'resistant' }]);
    expect(result.newHp).toBe(75);
    expect(setRuntimeValue).toHaveBeenCalledWith('DivinationWizard', 'currentHitPoints', 75, CAMPAIGN);

    const logs = spellResistanceLogCalls();
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe(CAMPAIGN);
    expect(logs[0][1]).toEqual(expect.objectContaining({
      type: 'automation',
      creatureName: 'DivinationWizard',
      name: 'Spell Resistance',
      description: 'DivinationWizard has resistance to damage of spells — 14 spell damage halved to 7.',
    }));
  });

  // Arm census for isSpellOriginDamage (applyDamage.js:933): same Fire 20 spell damage,
  // no explicit option — only the stamp bytes decide. isSpellDamage:true stamp is the
  // monster-card save-attack arm never exercised elsewhere.
  it.each([
    ['spell-save stamp arms halving', { rollType: 'spell-save', attackerName: 'Archmage', attackName: 'Fireball' }, 10],
    ['isSpellDamage:true stamp arms halving', { rollType: 'ability', attackerName: 'Archmage', attackName: 'Fireball', isSpellDamage: true }, 10],
    ['no stamp stays silent', null, 20],
    ['stale non-spell attack stamp stays silent', { rollType: 'attack', attackerName: 'Knight 1', attackName: 'Greatsword' }, 20],
  ])('%s', async (_label, lastAttack, expected) => {
    getDamageResistances.mockReturnValue(['Spell']);
    const player = createPlayerCreature('DivinationWizard');
    stubRuntime({ name: 'DivinationWizard', hp: 82, lastAttack });

    const result = await applyDamageToTarget(
      { round: 1, creatures: [player] }, 'DivinationWizard', 20, ['Fire'],
      { campaignName: CAMPAIGN, characters: holderCharacters('DivinationWizard'), attackerName: 'Archmage' },
    );

    expect(result.finalDamage).toBe(expected);
    expect(result.resistanceDetails).toEqual(expected < 20 ? [{ damageType: 'Spell', status: 'resistant' }] : []);
    expect(spellResistanceLogCalls()).toHaveLength(expected < 20 ? 1 : 0);
  });

  it('does NOT halve plain weapon damage for the holder (no spell arm anywhere)', async () => {
    getDamageResistances.mockReturnValue(['Spell']);
    const player = createPlayerCreature('DivinationWizard');
    stubRuntime({ name: 'DivinationWizard', hp: 82 });

    const result = await applyDamageToTarget(
      { round: 1, creatures: [player] }, 'DivinationWizard', 14, ['Slashing'],
      { campaignName: CAMPAIGN, characters: holderCharacters('DivinationWizard'), attackerName: 'Thug 1' },
    );

    expect(result.finalDamage).toBe(14);
    expect(result.newHp).toBe(68);
    expect(result.resistanceDetails).toEqual([]);
    expect(spellResistanceLogCalls()).toHaveLength(0);
  });

  it('does NOT halve spell-origin damage for a non-holder (passive absent)', async () => {
    const player = createPlayerCreature('AberrantSorcerer');
    stubRuntime({ name: 'AberrantSorcerer', hp: 44 });

    const result = await applyDamageToTarget(
      { round: 1, creatures: [player] }, 'AberrantSorcerer', 11, ['Cold'],
      { campaignName: CAMPAIGN, characters: nonHolderCharacters('AberrantSorcerer'), isSpellDamage: true, attackerName: 'Gazer 1' },
    );

    expect(result.finalDamage).toBe(11);
    expect(result.newHp).toBe(33);
    expect(result.resistanceDetails).toEqual([]);
    expect(spellResistanceLogCalls()).toHaveLength(0);
  });
});
