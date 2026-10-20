// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { addEntry } from '../../ui/logService.js';

// NPC concentration auto-roll lane only — handleNpcConcentrationBreak (applyDamage.js
// :644-699): advantage/disadvantage arming, Relentless Hunter exemption (NPC side),
// broken/intact concentration state, and log bytes.
// Owned elsewhere, never re-driven here:
//   - generic arithmetic / spent / floor / resistance math → applyDamage.helpers.test.js
//     (computeDamageAfterResistances :53-86, computeDamageAfterSave :88-104,
//      rollSaveForCreature :106-166, hasEvasionForSave :168-182,
//      computeDamageAfterEvasion :184-196)
//   - concentration DC recalc after damage → applyDamage.test.js :241-285
//   - player prompt lane + PC Relentless Hunter exemption → applyDamage.relentlessHunter.test.js

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
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

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCreature(name, currentHp, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp: currentHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function makeCharacter(name, { level = 1, className = 'Fighter', features = [], saveModifiers } = {}) {
  const character = {
    name,
    level,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [{ level, features }],
      equipment: [],
      characterAdvancement: [],
      allFeatures: features,
      automation: { passives: [] },
      class: { name: className, class_levels: [{ level, features }] },
    },
  };
  if (saveModifiers) character.saveModifiers = saveModifiers;
  return character;
}

// Runtime store stub keyed `${name}.${key}` (#1057/#1186). Keys not listed return
// undefined — the absent-activeBuffs leg of CLA-395 is exercised implicitly by every test.
function stubRuntime(currentHp, overrides = {}) {
  getRuntimeValue.mockReset();
  getRuntimeValue.mockImplementation((name, key) => {
    const composite = `${name}.${key}`;
    if (composite in overrides) return overrides[composite];
    if (key in overrides) return overrides[key];
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'activeConditions') return [];
    return undefined;
  });
}

function apply(cs, targetName, damage, options = {}) {
  return applyDamageToTarget(cs, targetName, damage, ['Slashing'], {
    campaignName: 'TestCampaign',
    characters: [makeCharacter(targetName)],
    ...options,
  });
}

function clearRollMocks() {
  rollConcentrationSave.mockClear();
  addEntry.mockClear();
}

const ROLL_SUCCESS = { success: true, roll: 10, total: 10 };

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — NPC concentration auto-roll lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants concentration save advantage only for the Dragon Starry Form', async () => {
    const druid = makeCreature('Druid', 30, { concentration: { spell: 'Haste', dc: 10 } });
    const cs = { round: 1, creatures: [druid] };
    rollConcentrationSave.mockReturnValue(ROLL_SUCCESS);

    // guard fires: Dragon constellation → advantage
    stubRuntime(30, { 'Druid.activeBuffs': [{ name: 'Starry Form', constellation: 'Dragon' }] });
    await apply(cs, 'Druid', 10);
    expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, true, false);

    // guard silent: same buff name, different constellation → no advantage
    clearRollMocks();
    stubRuntime(30, { 'Druid.activeBuffs': [{ name: 'Starry Form', constellation: 'Raven' }] });
    await apply(cs, 'Druid', 10);
    expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false, false);
  });

  it("exempts a Relentless Hunter Ranger concentrating Hunter's Mark — no save, maintained log, damage still lands", async () => {
    const ranger = makeCreature('Ranger', 30, { concentration: { spell: "Hunter's Mark", dc: 10 } });
    const cs = { round: 1, creatures: [ranger] };
    stubRuntime(30);

    await apply(cs, 'Ranger', 10, {
      characters: [makeCharacter('Ranger', { level: 13, className: 'Ranger', features: [{ name: 'Relentless Hunter' }] })],
    });

    expect(rollConcentrationSave).not.toHaveBeenCalled();
    expect(ranger.concentration).toEqual({ spell: "Hunter's Mark", dc: 10 });
    expect(ranger.currentHp).toBe(20); // exemption suppresses the save, not the damage
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'condition',
      action: 'maintained',
      characterName: 'Ranger',
      condition: 'Concentration on Hunter\'s Mark',
      sourceName: 'Relentless Hunter',
    });
  });

  it('keeps the Relentless Hunter exemption silent — save still rolls for non-Hunter\'s-Mark spell (CLA-289), Ranger without the feature, or non-Ranger', async () => {
    const cases = [
      { name: 'CLA-289: qualifying Ranger concentrating a non-Hunter\'s-Mark spell', creature: 'Ranger', spell: 'Haste', className: 'Ranger', level: 13, features: [{ name: 'Relentless Hunter' }] },
      { name: 'Ranger whose class_levels lack the feature', creature: 'Ranger', spell: 'Hunter\'s Mark', className: 'Ranger', level: 12, features: [] },
      { name: 'non-Ranger carrying the feature name', creature: 'Wizard', spell: 'Hunter\'s Mark', className: 'Wizard', level: 20, features: [{ name: 'Relentless Hunter' }] },
    ];

    for (const c of cases) {
      clearRollMocks();
      const creature = makeCreature(c.creature, 30, { concentration: { spell: c.spell, dc: 10 } });
      const cs = { round: 1, creatures: [creature] };
      stubRuntime(30);
      rollConcentrationSave.mockReturnValue(ROLL_SUCCESS);

      await apply(cs, c.creature, 10, {
        characters: [makeCharacter(c.creature, { level: c.level, className: c.className, features: c.features })],
      });

      expect(rollConcentrationSave, c.name).toHaveBeenCalledTimes(1);
      expect(rollConcentrationSave, c.name).toHaveBeenCalledWith(0, 10, false, false);
      expect(creature.concentration, c.name).not.toBeNull();
      expect(addEntry, c.name).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        action: 'maintained',
        sourceName: 'Relentless Hunter',
      }));
    }
  });

  it('throws when the Ranger player level is null for the relentless hunter check', async () => {
    const ranger = makeCreature('Ranger', 30, { concentration: { spell: "Hunter's Mark", dc: 10 } });
    const cs = { round: 1, creatures: [ranger] };
    stubRuntime(30);
    const levelless = makeCharacter('Ranger', { level: 13, className: 'Ranger', features: [{ name: 'Relentless Hunter' }] });
    levelless.level = null;
    levelless.computedStats.level = null;

    await expect(apply(cs, 'Ranger', 10, { characters: [levelless] })).rejects.toThrow('player level is required for relentless hunter check');
    // guard silent when level is present: covered by the exemption test above (lv13, no throw)
    expect(rollConcentrationSave).not.toHaveBeenCalled();
  });

  it('MA-0038: forces disadvantage from a live concentration_disadvantage te or an attacker concentration_breaker — silent when neither', async () => {
    const orc = makeCreature('Orc', 30, { concentration: { spell: 'Haste', dc: 10 } });
    const cs = { round: 1, creatures: [orc] };
    rollConcentrationSave.mockReturnValue(ROLL_SUCCESS);

    // arm 1: live te written by a monster failed-save clause
    const te = { target: 'Orc', effect: 'concentration_disadvantage', source: 'Adult Black Dragon', actionName: 'Cloud of Insects' };
    stubRuntime(30, { 'campaign.targetEffects': [te] });
    await apply(cs, 'Orc', 10);
    expect(rollConcentrationSave).toHaveBeenLastCalledWith(0, 10, false, true);
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'automation',
      automationType: 'concentration_disadvantage_applied',
      characterName: 'Orc',
      sourceName: 'Adult Black Dragon',
      abilityName: 'Cloud of Insects',
    }));
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'roll',
      name: 'Concentration Save',
      mode: 'disadvantage',
    }));

    // arm 2: static concentration_breaker on the attacker
    clearRollMocks();
    stubRuntime(30);
    await apply(cs, 'Orc', 10, {
      attackerName: 'Goblin Boss',
      characters: [
        makeCharacter('Orc'),
        makeCharacter('Goblin Boss', { saveModifiers: [{ condition: 'concentration_breaker', effect: 'disadvantage' }] }),
      ],
    });
    expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false, true);
    expect(addEntry).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      automationType: 'concentration_disadvantage_applied',
    }));

    // guard silent: no te, no breaker → normal save
    clearRollMocks();
    stubRuntime(30);
    await apply(cs, 'Orc', 10);
    expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false, false);
  });

  it('breaks concentration and logs the removal on a failed save; keeps it and logs the full roll entry on a pass', async () => {
    // fail: concentration nulled, removed-log golden bytes
    const failingOrc = makeCreature('OrcFail', 30, { concentration: { spell: 'Haste', dc: 10 }, saveBonuses: { con: 3 } });
    const cs1 = { round: 1, creatures: [failingOrc] };
    stubRuntime(30);
    rollConcentrationSave.mockReturnValue({ success: false, roll: 5, total: 8 });

    await apply(cs1, 'OrcFail', 10);

    expect(rollConcentrationSave).toHaveBeenCalledWith(3, 10, false, false);
    expect(failingOrc.concentration).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'condition',
      action: 'removed',
      characterName: 'OrcFail',
      condition: 'Concentrating on Haste',
      sourceName: 'Concentration broken by damage',
    });

    // pass: concentration intact, roll-log golden bytes, missing con bonus defaults to 0
    clearRollMocks();
    const passingOrc = makeCreature('OrcPass', 30, { concentration: { spell: 'Haste', dc: 10 } });
    const cs2 = { round: 1, creatures: [passingOrc] };
    stubRuntime(30);
    rollConcentrationSave.mockReturnValue(ROLL_SUCCESS);

    await apply(cs2, 'OrcPass', 10);

    expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false, false);
    expect(passingOrc.concentration).toEqual({ spell: 'Haste', dc: 10 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'roll',
      characterName: 'OrcPass',
      rollType: 'save',
      name: 'Concentration Save',
      targetName: 'Haste',
      rolls: [10],
      mode: 'normal',
      total: 10,
      bonus: 0,
      saveType: 'CON',
      saveDc: 10,
      saveResult: 'success',
    });
  });

  it('CLA-395: null activeBuffs on an EB monster does not crash the concentration auto-roll', async () => {
    const wight = makeCreature('Wight 1', 82, { concentration: { spell: 'Wight Hold Person', dc: 10 }, saveBonuses: { con: 2 } });
    const cs = { round: 1, creatures: [wight] };
    stubRuntime(82, { 'Wight 1.activeBuffs': null });
    rollConcentrationSave.mockReturnValue({ success: false, roll: 3, total: 5 });

    await apply(cs, 'Wight 1', 10);

    expect(rollConcentrationSave).toHaveBeenCalledWith(2, 10, false, false);
    expect(wight.concentration).toBeNull();
    expect(wight.currentHp).toBe(72); // damage flow completed past the guard
  });
});
