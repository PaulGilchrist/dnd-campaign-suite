// @maintained-by-ai — deterministic mocked-seam lane: runtime store, logService,
// combat context, and rangeCheck are all mocked at module level. Expression utils
// (automationExpressions) and rangeToFeet run REAL — they own suites elsewhere
// (automationExpressions.test.js, rangeValidation.test.js). No timers: turn-based
// seam, every branch resolves inline.
//
// ── CLA-163 healing_pool lane — healingPoolHandler.js handle() ──────────────
// handle() dispatches live via automation/index.js registry key `healing_pool`.
// Inputs mirror real prod shapes from 2024 data: Warrior of the Gods
// (4d12 + 6/12/17 scaling), Preserve Life (channel_divinity + bloodiedOnly,
// baked pool 85), Recover Vitality (10d10).
//
// This lane owns:
//   - pool split + payload own-composition: implicit dice-pattern detection
//     (pool/dieType), scaling wiring, explicit-isDicePool arithmetic path,
//     flat auto.pool fallback, full-payload toEqual default pins
//   - resourceKey auto-generation ('<lowername>Pool') for dice pools, null for
//     flat pools without one
//   - the channel_divinity resourceCost gate AT THIS SEAM: exact-string refusal
//     popup + ability_use log, non-CD bypass (no runtime read at all),
//     class_levels default when the runtime key is unset
//   - resolveChannelDivinityCharges exported contract — this module is its home
//     (radianceOfDawn + inspiringSmite suites pin their own consumption lanes)
//   - creatureTargets scan wiring: getCombatContext(campaign), per-creature
//     isWithinRange filtering, exact 4-key target shape, auto.range → feet
//     (real rangeToFeet), 60 ft default, null outcomes when nothing resolves
//   - restoringTouchConditions extraction from specialActions 'Restoring Touch'
//
// NOT owned here:
//   - resolveHealingPoolExpression / evaluateAutoExpression internals
//     → automationExpressions.test.js
//   - isWithinRange internals → rangeCheck.test.js; rangeToFeet internals
//     → rangeValidation.test.js
//   - healing_pool display info card → automationInfoBuilder/healing.test.js
//     (separate display module, same automation type name)
//   - channel_divinity gates of OTHER handlers (conditionHandler,
//     saveAttackHandler, spellCastHandler…) — each has its own suite
//   - class channel_divinity data tables → classRules*.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// Combat context + range check mocked so the scan seam is deterministic
// (the real getCombatContext fetches; jsdom failure-null was accidental).
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// rangeValidation.js stays REAL (rangeToFeet) but imports isDistanceInRange
// from this module — keep that export live as a pure delegate.
vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
  isWithinRangeOf: vi.fn(),
  isDistanceInRange: (dist, rangeFt) => dist != null && dist <= rangeFt,
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, resolveChannelDivinityCharges } from './healingPoolHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

// MERGE overrides (top level and automation) — never replace wholesale.
function makeAction(overrides = {}) {
  const { automation: automationOverrides, ...top } = overrides;
  return {
    name: 'Warrior of the Gods',
    ...top,
    automation: {
      type: 'healing_pool',
      poolExpression: '4d12',
      ...automationOverrides,
    },
  };
}

function mockRuntime({ charges } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'channelDivinityCharges') return charges !== undefined ? charges : null;
    return null;
  });
}

// inRange: predicate over creature name → isWithinRange verdict.
function mockCombat({ summary = null, inRange = () => true } = {}) {
  damageUtils.getCombatContext.mockResolvedValue(summary);
  rangeCheck.isWithinRange.mockImplementation((_source, target) => Promise.resolve(inRange(target)));
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingPoolHandler — CLA-163 healing_pool lane', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRuntime();
    mockCombat();
    logService.addEntry.mockResolvedValue(undefined);
  });

  describe('modal envelope + pool split', () => {
    it('builds the full healingPool modal payload from the prod dice-pool shape (Warrior of the Gods)', async () => {
      const result = await handle(makeAction(), { level: 17 }, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('healingPool');
      // Implicit dice detection (pool 4, dieType 12), auto-generated
      // resourceKey, and every composition default — full-shape pin.
      expect(result.payload).toEqual({
        name: 'Warrior of the Gods',
        pool: 4,
        poolExpression: '4d12',
        isDicePool: true,
        dieType: 12,
        resourceKey: 'warriorofthegodsPool',
        alsoCures: [],
        cureCost: 5,
        range: '',
        resourceCost: '',
        bloodiedOnly: false,
        restoringTouchConditions: [],
        maxDicePerUse: '',
        creatureTargets: null,
      });
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
    });

    it('passes explicit optional automation fields through (explicit isDicePool + arithmetic expression)', async () => {
      const action = makeAction({
        automation: {
          poolExpression: '12',
          isDicePool: true,
          dieType: 'd6',
          maxDicePerUse: '3',
          resourceKey: 'spell_slot',
        },
      });

      const result = await handle(action, { level: 3 }, campaignName, mapName);

      expect(result.payload.isDicePool).toBe(true);
      // explicit-flag lane evaluates arithmetic for pool, passes dieType
      // through VERBATIM as authored string 'd6' (quirk of the explicit path —
      // implicit detection would parse it to integer 12)
      expect(result.payload.pool).toBe(12);
      expect(result.payload.dieType).toBe('d6');
      expect(result.payload.maxDicePerUse).toBe('3');
      expect(result.payload.resourceKey).toBe('spell_slot');
      expect(result.payload.poolExpression).toBe('12');
    });

    it('wires the scaling table through the split (4d12 bumps at 6/12/17)', async () => {
      const scaling = { '6': '5d12', '12': '6d12', '17': '7d12' };

      const lvl5 = await handle(makeAction({ automation: { scaling } }), { level: 5 }, campaignName, mapName);
      expect(lvl5.payload.pool).toBe(4);
      expect(lvl5.payload.poolExpression).toBe('4d12');

      const lvl10 = await handle(makeAction({ automation: { scaling } }), { level: 10 }, campaignName, mapName);
      expect(lvl10.payload.isDicePool).toBe(true);
      expect(lvl10.payload.pool).toBe(5);
      expect(lvl10.payload.poolExpression).toBe('5d12');
      expect(lvl10.payload.dieType).toBe(12);

      const lvl17 = await handle(makeAction({ automation: { scaling } }), { level: 17 }, campaignName, mapName);
      expect(lvl17.payload.pool).toBe(7);
      expect(lvl17.payload.poolExpression).toBe('7d12');
    });

    it('flat pool lane: non-dice expression stays isDicePool false, pool comes from auto.pool (Preserve Life shape)', async () => {
      // Preserve Life shape: expression is NOT dice notation even at level 17;
      // the baked numeric pool is what ships.
      const result = await handle(
        makeAction({
          name: 'Preserve Life',
          automation: { poolExpression: '5 * cleric_level', pool: 85, resourceKey: 'preserveLifePool' },
        }),
        { level: 17 },
        campaignName,
        mapName,
      );

      expect(result.payload.isDicePool).toBe(false);
      expect(result.payload.pool).toBe(85);
      expect(result.payload.poolExpression).toBe('5 * cleric_level');
      expect(result.payload.dieType).toBe(null);
      expect(result.payload.resourceKey).toBe('preserveLifePool');

      // no baked pool, no resourceKey: flat lane does NOT auto-generate a
      // resourceKey (that is dice-pool-only) and pool floors at 0
      const bare = await handle(
        makeAction({ automation: { poolExpression: '5 * level' } }),
        { level: 3 },
        campaignName,
        mapName,
      );
      expect(bare.payload.isDicePool).toBe(false);
      expect(bare.payload.pool).toBe(0);
      expect(bare.payload.resourceKey).toBe(null);
    });
  });

  describe('channel_divinity resourceCost gate (Preserve Life shape)', () => {
    const preserveLifeAction = {
      name: 'Preserve Life',
      automation: {
        type: 'healing_pool',
        poolExpression: '5 * cleric_level',
        pool: 85,
        resourceKey: 'preserveLifePool',
        resourceCost: 'channel_divinity',
        bloodiedOnly: true,
      },
    };
    const clericStats = {
      name: 'Divine_Cleric',
      level: 17,
      class: { class_levels: Array.from({ length: 17 }, (_, i) => ({ level: i + 1, channel_divinity: i === 16 ? 3 : undefined })) },
    };

    it('returns the healing pool modal when Channel Divinity charges remain', async () => {
      mockRuntime({ charges: 3 });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.resourceCost).toBe('channel_divinity');
      expect(result.payload.bloodiedOnly).toBe(true);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('refuses with popup and logs when no Channel Divinity charges remain', async () => {
      mockRuntime({ charges: 0 });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.automation).toBe(preserveLifeAction.automation);
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Divine_Cleric',
          abilityName: 'Preserve Life',
        }),
      );
    });

    it('survives a rejected log write on the refusal path (console.error, still popup)', async () => {
      mockRuntime({ charges: 0 });
      logService.addEntry.mockRejectedValueOnce(new Error('log down'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[healingPoolHandler]'), expect.any(Error));
      });
      consoleError.mockRestore();
    });

    it('does not gate non-channel-divinity healing_pool features at 0 charges (no runtime read at all)', async () => {
      mockRuntime({ charges: 0 });

      const result = await handle(
        makeAction({
          name: 'ElderPaladin',
          automation: { poolExpression: '5 * paladin level', resourceKey: 'layOnHandsPool' },
        }),
        { name: 'ElderPaladin', level: 10 },
        campaignName,
        mapName,
      );

      expect(result.type).toBe('modal');
      expect(result.payload.resourceCost).toBe('');
      // gate skipped entirely — the charge key is never consulted
      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('defaults charges from class_levels when runtime key is unset', async () => {
      mockRuntime(); // charges null → fall back to class data (level 17 → 3)

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Divine_Cleric', 'channelDivinityCharges');
    });
  });

  describe('resolveChannelDivinityCharges (exported contract, consumed by radianceOfDawn + inspiringSmite)', () => {
    it('stored runtime charges win; string values coerce to numbers; missing class data floors max at 2', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'channelDivinityCharges') return '0';
        return null;
      });
      const clericStats = {
        name: 'Divine_Cleric',
        level: 17,
        class: { class_levels: Array.from({ length: 17 }, (_, i) => ({ level: i + 1, channel_divinity: i === 16 ? 3 : undefined })) },
      };

      // stored '0' coerces to 0 — NOT shadowed by the class max of 3
      expect(resolveChannelDivinityCharges(clericStats)).toEqual({ currentCharges: 0, maxCharges: 3 });

      // unset → currentCharges mirrors class-derived max
      mockRuntime();
      expect(resolveChannelDivinityCharges(clericStats)).toEqual({ currentCharges: 3, maxCharges: 3 });

      // no class data at all → hard default max 2
      expect(resolveChannelDivinityCharges({ name: 'BareHero', level: 1 })).toEqual({ currentCharges: 2, maxCharges: 2 });
    });
  });

  describe('creatureTargets scan', () => {
    it('scans at 60 ft default, filters by isWithinRange, pins the exact 4-key target shape', async () => {
      mockCombat({
        summary: {
          creatures: [
            { name: 'Goblin', type: 'humanoid', currentHp: 7, maxHp: 7, initiative: 14 },
            { name: 'Troll', type: 'monstrosity', currentHp: 45, maxHp: 84 },
          ],
        },
        inRange: (name) => name === 'Goblin',
      });

      const result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Warrior of the Gods', 'Goblin', 60);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Warrior of the Gods', 'Troll', 60);
      // out-of-range Troll dropped; extra creature keys (initiative) stripped
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Goblin', type: 'humanoid', currentHp: 7, maxHp: 7 },
      ]);
    });

    it('honors auto.range through real rangeToFeet (30 ft → 30)', async () => {
      mockCombat({ summary: { creatures: [{ name: 'Goblin', type: 'humanoid', currentHp: 7, maxHp: 7 }] } });

      await handle(
        makeAction({ automation: { type: 'healing_pool', poolExpression: '5 * cleric_level', range: '30 ft' } }),
        { name: 'Divine_Cleric', level: 17 },
        campaignName,
        mapName,
      );

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Divine_Cleric', 'Goblin', 30);
    });

    it('creatureTargets stays null with no combat context, empty creatures, or nothing in range', async () => {
      // no summary (fetch-less mocked null) → scan skipped entirely
      mockCombat({ summary: null });
      let result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);
      expect(result.payload.creatureTargets).toBe(null);
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();

      // empty creatures array
      mockCombat({ summary: { creatures: [] } });
      result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);
      expect(result.payload.creatureTargets).toBe(null);
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();

      // creatures present but all out of range
      mockCombat({
        summary: { creatures: [{ name: 'Troll', type: 'monstrosity', currentHp: 45, maxHp: 84 }] },
        inRange: () => false,
      });
      result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);
      expect(result.payload.creatureTargets).toBe(null);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoringTouchConditions from specialActions', () => {
    it('extracts cureConditions when Restoring Touch feature exists, returns empty array otherwise', async () => {
      // positive case: feature found with cureConditions
      const playerStats = {
        specialActions: [
          {
            name: 'Restoring Touch',
            automation: { cureConditions: ['Bloodied', 'Unconscious'] },
          },
          { name: 'Other Feature' },
        ],
      };

      let result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([
        'Bloodied',
        'Unconscious',
      ]);

      // negative cases: none of these produce cureConditions
      const negativeCases = [
        { specialActions: [{ name: 'Other Feature' }] },
        { specialActions: [{ name: 'Restoring Touch' }] },
        { specialActions: [{ name: 'Restoring Touch', automation: {} }] },
        { specialActions: [{ name: 'Restoring Touch', automation: null }] },
        {},
        { specialActions: null },
      ];

      for (const stats of negativeCases) {
        result = await handle(makeAction(), stats, campaignName, mapName);
        expect(result.payload.restoringTouchConditions).toEqual([]);
      }
    });
  });
});
