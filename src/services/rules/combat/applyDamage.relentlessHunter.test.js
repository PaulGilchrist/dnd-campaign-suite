// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { addEntry } from '../../ui/logService.js';

// Relentless Hunter PLAYER prompt lane only — promptPlayerConcentrationSave
// (applyDamage.js :618-632) driving hasRelentlessHunterExemption (:162-176) for
// type:'player' creatures: the CON-save prompt is queued, or the exemption suppresses
// it and logs the maintained bytes. Players never auto-roll — rollConcentrationSave
// must stay untouched on this lane.
// Owned elsewhere, never re-driven here:
//   - NPC-side exemption + concentration auto-roll → applyDamage.npcConcentrationAdvanced.test.js
//     (:152-212, incl. its guard-silent and null-level arms)
//   - generic arithmetic / spent / floor / resistance math → applyDamage.helpers.test.js
//     (computeDamageAfterResistances :53-86, computeDamageAfterSave :88-104,
//      rollSaveForCreature :106-166, hasEvasionForSave :168-182,
//      computeDamageAfterEvasion :184-196)
//   - concentration DC recalc after damage → applyDamage.test.js :241-285

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

function makePlayer(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

// Feature presence resolved from class_levels data (applyDamage.js :158-159), never a
// hardcoded level: featureLevel null omits the feature entirely.
function makeCharacter(name, { level = 12, className = 'Ranger', featureLevel = null } = {}) {
  const features = featureLevel === null ? [] : [{ name: 'Relentless Hunter' }];
  const classLevels = [{ level: featureLevel ?? level, features }];
  return {
    name,
    level,
    computedStats: {
      resistances: [],
      immunities: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: features,
      automation: { passives: [] },
      class: { name: className, class_levels: classLevels },
    },
  };
}

// Runtime store stub keyed `${name}.${key}` (#1057/#1186). Consumers guard every
// absent key (!wardActive, Array.isArray, || 0), so unlisted keys stay undefined safely.
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

function apply(cs, targetName, options = {}) {
  return applyDamageToTarget(cs, targetName, 17, ['Slashing'], {
    campaignName: 'TestCampaign',
    attackerName: 'Goblin Boss',
    ...options,
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — Relentless Hunter player prompt lane (CLA-289)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exempts a Ranger with the feature concentrating Hunter's Mark — no prompt, no roll, maintained log, damage still lands", async () => {
    const ranger = makePlayer('FeyRanger', { concentration: { spell: "Hunter's Mark", dc: 10 } });
    const cs = { round: 1, creatures: [ranger] };
    stubRuntime(30);

    await apply(cs, 'FeyRanger', { characters: [makeCharacter('FeyRanger', { level: 13, featureLevel: 13 })] });

    expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    expect(rollConcentrationSave).not.toHaveBeenCalled();
    expect(ranger.concentration).toEqual({ spell: "Hunter's Mark", dc: 10 });
    // Exemption suppresses the prompt, not the damage: 30 − 17 slashing = 13.
    expect(setRuntimeValue).toHaveBeenCalledWith('FeyRanger', 'currentHitPoints', 13, 'TestCampaign');
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'condition',
      action: 'maintained',
      characterName: 'FeyRanger',
      condition: 'Concentration on Hunter\'s Mark',
      sourceName: 'Relentless Hunter',
    });
  });

  it('keeps the exemption silent — prompt still queued for non-Hunter\'s-Mark spell (CLA-289), missing feature, unreached feature level, or non-Ranger class', async () => {
    const cases = [
      { name: 'CLA-289 spell axis: qualifying Ranger concentrating a non-Hunter\'s-Mark spell', spell: 'Spirit Guardians', character: makeCharacter('FeyRanger', { level: 13, featureLevel: 13 }) },
      { name: 'feature axis: Ranger whose class_levels lack the feature', spell: 'Hunter\'s Mark', character: makeCharacter('FeyRanger', { level: 12, featureLevel: null }) },
      { name: 'level axis: feature listed only at a level the Ranger has not reached', spell: 'Hunter\'s Mark', character: makeCharacter('FeyRanger', { level: 12, featureLevel: 13 }) },
      { name: 'class axis: non-Ranger concentrating Hunter\'s Mark with the feature name listed', spell: 'Hunter\'s Mark', character: makeCharacter('HexWarlock', { level: 14, className: 'Warlock', featureLevel: 14 }) },
    ];

    for (const c of cases) {
      vi.clearAllMocks();
      const player = makePlayer(c.character.name, { concentration: { spell: c.spell, dc: 10 } });
      const cs = { round: 1, creatures: [player] };
      stubRuntime(30);

      await apply(cs, c.character.name, { characters: [c.character] });

      expect(sendConcentrationPrompt, c.name).toHaveBeenCalledTimes(1);
      expect(sendConcentrationPrompt, c.name).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: c.character.name,
        spellName: c.spell,
        dc: 10,
        attackerName: 'Goblin Boss',
      });
      expect(rollConcentrationSave, c.name).not.toHaveBeenCalled();
      expect(addEntry, c.name).not.toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        action: 'maintained',
        sourceName: 'Relentless Hunter',
      }));
    }
  });
});
