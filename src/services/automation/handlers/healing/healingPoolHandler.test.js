// @maintained-by-ai 2026-11-27 — deterministic mocked-seam lane: runtime store, logService,
// combat context, and rangeCheck are all mocked at module level. Expression utils
// (automationExpressions), liveTargetHp, and rangeToFeet run REAL — they own suites
// elsewhere (automationExpressions.test.js, liveTargetHp.test.js,
// rangeValidation.test.js). Determinism: bare vi.fn factories with ALL defaults
// re-installed in beforeEach after resetAllMocks, FROZEN Date.now, no *Once
// chains, no mid-test re-harnesses — multi-leg families ride it.each.
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
//     popup + full-row ability_use log (frozen timestamp), gate-ORDER
//     zero-read-of-later-channel pin (refusal never reaches combat scan),
//     non-CD bypass (no runtime read at all), class_levels default when the
//     runtime key is unset
//   - resolveChannelDivinityCharges exported contract — this module is its home
//     (radianceOfDawn + inspiringSmite suites pin their own consumption lanes)
//   - creatureTargets scan wiring: getCombatContext(campaign), per-creature
//     isWithinRange filtering, exact 4-key target shape (bucket-first leg is
//     integration-only — precedence semantics belong to liveTargetHp.test.js),
//     auto.range → feet (real rangeToFeet), 60 ft default, null outcomes when
//     nothing resolves
//   - restoringTouchConditions extraction from specialActions 'Restoring Touch'
//
// NOT owned here:
//   - pool SPEND / per-target drain: the modal suites (HealingPoolModal.*)
//     spend what this payload declares, and massHealHandler owns its separate
//     spell-slot pool arithmetic — neither restates this composition lane
//   - resolveHealingPoolExpression / evaluateAutoExpression internals
//     → automationExpressions.test.js
//   - bucket-vs-row HP precedence → liveTargetHp.test.js
//   - isWithinRange internals → rangeCheck.test.js; rangeToFeet internals
//     → rangeValidation.test.js
//   - healing_pool display info card → automationInfoBuilder/healing.test.js
//     (separate display module, same automation type name)
//   - channel_divinity gates of OTHER handlers (conditionHandler,
//     saveAttackHandler, spellCastHandler…) — each has its own suite
//   - class channel_divinity data tables → classRules*.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const FROZEN_NOW = 1_735_300_000_000;

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

// Level-17 cleric: channel_divinity 3 at the top step, undefined below.
const clericStats = {
  name: 'Divine_Cleric',
  level: 17,
  class: { class_levels: Array.from({ length: 17 }, (_, i) => ({ level: i + 1, channel_divinity: i === 16 ? 3 : undefined })) },
};

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
  let consoleError;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRuntime();
    mockCombat();
    logService.addEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    Date.now.mockRestore();
    consoleError.mockRestore();
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

    it.each([
      [5, 4, '4d12'],
      [10, 5, '5d12'],
      [17, 7, '7d12'],
    ])('wires the scaling table through the split (level %i → %s)', async (level, pool, expression) => {
      const scaling = { '6': '5d12', '12': '6d12', '17': '7d12' };

      const result = await handle(makeAction({ automation: { scaling } }), { level }, campaignName, mapName);

      expect(result.payload.isDicePool).toBe(true);
      expect(result.payload.pool).toBe(pool);
      expect(result.payload.poolExpression).toBe(expression);
      expect(result.payload.dieType).toBe(12);
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

    it('returns the healing pool modal when Channel Divinity charges remain', async () => {
      mockRuntime({ charges: 3 });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.resourceCost).toBe('channel_divinity');
      expect(result.payload.bloodiedOnly).toBe(true);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('refuses with popup, full-row ability_use log, and never reaches the combat scan when charges are 0', async () => {
      mockRuntime({ charges: 0 });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Preserve Life',
        automationType: 'healing_pool',
        description: 'No Channel Divinity charges remaining.',
        automation: preserveLifeAction.automation,
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Divine_Cleric',
        abilityName: 'Preserve Life',
        description: 'Divine_Cleric attempted to use Preserve Life but has no Channel Divinity charges remaining.',
        timestamp: FROZEN_NOW,
      });
      // gate ORDER: the refusal short-circuits before the pool split/scan —
      // combat context and range checks are never consulted
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('survives a rejected log write on the refusal path (console.error, still popup)', async () => {
      mockRuntime({ charges: 0 });
      logService.addEntry.mockRejectedValue(new Error('log down'));

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[healingPoolHandler]'), expect.any(Error));
      });
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
    it.each([
      ["stored '0' coerces and is NOT shadowed by the class max of 3", '0', clericStats, { currentCharges: 0, maxCharges: 3 }],
      ['unset runtime key mirrors the class-derived max', null, clericStats, { currentCharges: 3, maxCharges: 3 }],
      ['no class data at all floors max at 2', null, { name: 'BareHero', level: 1 }, { currentCharges: 2, maxCharges: 2 }],
    ])('resolveChannelDivinityCharges: %s', (_label, stored, stats, expected) => {
      mockRuntime({ charges: stored });

      expect(resolveChannelDivinityCharges(stats)).toEqual(expected);
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

    it.each([
      ['live bucket currentHitPoints/hitPoints win over the stale cs row', 134, 143, { currentHp: 134, maxHp: 143 }],
      ['empty-string bucket (no-data fingerprint) falls back to the cs row', '', null, { currentHp: 100, maxHp: 100 }],
    ])('target rows: %s (EH 2026-11-13, integration at this seam)', async (_label, bucketCurrent, bucketMax, expectedHp) => {
      // GET-proved drift face: real heals wrote the bucket to 134/143 while the
      // combatSummary player row stayed at 100/100 — the chooser must show what
      // the target modal shows one click later. Precedence SEMANTICS belong to
      // liveTargetHp.test.js; these legs pin only that the scan wires them in.
      mockCombat({ summary: { creatures: [{ name: 'Fighting_Rogue', type: 'player', currentHp: 100, maxHp: 100 }] } });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Fighting_Rogue' && key === 'currentHitPoints') return bucketCurrent;
        if (name === 'Fighting_Rogue' && key === 'hitPoints') return bucketMax;
        return null;
      });

      const result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Fighting_Rogue', type: 'player', ...expectedHp },
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

    it.each([
      ['no combat context', { summary: null }, 0],
      ['empty creatures array', { summary: { creatures: [] } }, 0],
      [
        'creatures present but all out of range',
        { summary: { creatures: [{ name: 'Troll', type: 'monstrosity', currentHp: 45, maxHp: 84 }] }, inRange: () => false },
        1,
      ],
    ])('creatureTargets stays null with %s (scan consulted %i time(s))', async (_label, combat, rangeCalls) => {
      mockCombat(combat);

      const result = await handle(makeAction(), { name: 'Warrior of the Gods', level: 5 }, campaignName, mapName);

      expect(result.payload.creatureTargets).toBe(null);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledTimes(rangeCalls);
    });
  });

  describe('restoringTouchConditions from specialActions', () => {
    it('extracts cureConditions from the Restoring Touch feature amid other features', async () => {
      const playerStats = {
        specialActions: [
          {
            name: 'Restoring Touch',
            automation: { cureConditions: ['Bloodied', 'Unconscious'] },
          },
          { name: 'Other Feature' },
        ],
      };

      const result = await handle(makeAction(), playerStats, campaignName, mapName);

      expect(result.payload.restoringTouchConditions).toEqual(['Bloodied', 'Unconscious']);
    });

    it.each([
      ['other feature only', { specialActions: [{ name: 'Other Feature' }] }],
      ['Restoring Touch without automation', { specialActions: [{ name: 'Restoring Touch' }] }],
      ['Restoring Touch with empty automation', { specialActions: [{ name: 'Restoring Touch', automation: {} }] }],
      ['Restoring Touch with null automation', { specialActions: [{ name: 'Restoring Touch', automation: null }] }],
      ['no specialActions key', {}],
      ['null specialActions', { specialActions: null }],
    ])('restoringTouchConditions falls back to [] when %s', async (_label, stats) => {
      const result = await handle(makeAction(), stats, campaignName, mapName);

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });
  });
});
