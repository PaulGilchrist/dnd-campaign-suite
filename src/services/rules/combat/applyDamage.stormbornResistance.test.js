// @maintained-by-ai
// CLA-336 lane at the DAMAGE seam: with stale computedStats (runtime toggles never
// recompute it, applyDamage.js:217-226), the LIVE getDamageResistances gate must
// inject the Stormborn triple at hit-resolution. Disk bytes: public/data/2024/classes.json
// Circle of the Sea lv10 automation row {type:'resistance',damageTypes:['Cold',
// 'Lightning','Thunder'],casting_time:'passive'}; the name byte rides feature flattening.
// Gate consulted under the target's store name — the name+key-routed stub (#1057/#1186)
// answers ONLY `${name}.wrathOfTheSeaActive`, so a wrong-name consult resolves unarmed
// and fails every armed row. Guard-falsifier discipline (#1187): armed C/L/T halve and
// log 'Damage Resistance' verbatim (applyDamage.js:317-330); armed Bludgeoning stays
// full; badge-removed stays full and silent. Gate truth-table per damage type lives in
// automationPassives.stormbornResistance.test.js; generic arithmetic is owned by
// applyDamage.helpers.test.js :53-86/:88-104/:106-166/:168-182/:184-196; HP bookkeeping
// by applyDamage.test.js; categorical Spell clause by applyDamage.spellResistance.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import * as logService from '../../ui/logService.js';
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

// automationPassives is NOT mocked — the wrath gate runs LIVE here (CLA-336 core).
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));
vi.mock('../core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}));
vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(() => 0),
}));
vi.mock('../core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
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
const NAME = 'Wild_Sage_Druid';

// automationPassives.stormbornResistance.test.js:66-71 byte-twin — disk envelope plus
// the flattened feature-name byte that gatedResistanceTypes exact-matches (automationPassives.js:307).
const STORMBORN_PASSIVE = {
  type: 'resistance',
  name: 'Stormborn',
  damageTypes: ['Cold', 'Lightning', 'Thunder'],
  casting_time: 'passive',
};

function characters() {
  // Stale computedStats: resistances stays [] — the live gate is the ONLY resistance
  // source, exactly the CLA-336 production shape (keys verbatim from character JSON).
  return [{
    name: NAME,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [STORMBORN_PASSIVE] },
    },
  }];
}

// Name+key-routed store stub (#1057/#1186): only the exact `${name}.${key}` routes this
// lane reads answer; any other lookup stays explicitly null (#940).
function stubRuntime(wrathActive) {
  const values = {
    [`${NAME}.wrathOfTheSeaActive`]: wrathActive,
    [`${NAME}.currentHitPoints`]: 143,
    [`${NAME}.hitPoints`]: 143,
    [`${NAME}.activeBuffs`]: [],
    [`${NAME}.activeConditions`]: [],
    [`${NAME}.tempHp`]: 0,
    [`${NAME}.polymorphTempHp`]: 0,
    [`${NAME}.arcaneWardActive`]: false,
    [`${NAME}.arcaneWardHp`]: 0,
    [`${NAME}.projectedWardDamage`]: 0,
    'campaign.lastAttack': null,
    'campaign.targetEffects': [],
  };
  getRuntimeValue.mockImplementation((storeName, key) => values[`${storeName}.${key}`] ?? null);
}

function damageResistanceLogs() {
  return logService.addEntry.mock.calls.filter((c) => c[1].name === 'Damage Resistance');
}

function apply(damageTypes, rawDamage) {
  return applyDamageToTarget(
    { round: 1, creatures: [{ name: NAME, type: 'player', maxHp: 143, currentHp: 143, resistances: [], immunities: [], conditions: [], concentration: null, saveBonuses: {} }] },
    NAME, rawDamage, damageTypes,
    { campaignName: CAMPAIGN, characters: characters(), ignoreResistance: false, attackerName: 'Air Elemental 1' },
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-336 Stormborn wrath-gated halving at the damage seam', () => {
  // Truth table over gate byte × damage type: fires AND stays silent (#1187).
  it.each([
    ['Lightning halved while Wrath is armed', true, 'Lightning', 15, 7, [{ damageType: 'Lightning', status: 'resistant' }]],
    ['Thunder halved while Wrath is armed', true, 'Thunder', 12, 6, [{ damageType: 'Thunder', status: 'resistant' }]],
    ['Cold halved while Wrath is armed', true, 'Cold', 16, 8, [{ damageType: 'Cold', status: 'resistant' }]],
    ['Bludgeoning NOT halved while Wrath is armed', true, 'Bludgeoning', 8, 8, []],
    ['Lightning NOT halved after the Wrath badge is removed', false, 'Lightning', 15, 15, []],
  ])('%s', async (_label, wrathActive, damageType, rawDamage, expectedFinal, expectedDetails) => {
    stubRuntime(wrathActive);

    const result = await apply([damageType], rawDamage);

    expect(result.finalDamage).toBe(expectedFinal);
    expect(result.damageReduced).toBe(expectedFinal < rawDamage);
    expect(result.resistanceDetails).toEqual(expectedDetails);
    expect(damageResistanceLogs()).toHaveLength(expectedFinal < rawDamage ? 1 : 0);
  });

  it('logs the exact Damage Resistance bytes when Stormborn halves', async () => {
    stubRuntime(true);

    const result = await apply(['Lightning'], 15);

    expect(result.finalDamage).toBe(7);
    const logs = damageResistanceLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe(CAMPAIGN);
    expect(logs[0][1]).toEqual(expect.objectContaining({
      type: 'automation',
      creatureName: NAME,
      name: 'Damage Resistance',
      description: 'Wild_Sage_Druid has resistance to Lightning damage — 15 damage halved to 7.',
    }));
  });
});
