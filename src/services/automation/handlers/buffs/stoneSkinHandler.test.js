// @maintained-by-ai
// Owner of the Stone Skin automation handler contract: target-selection popup shape,
// activeBuffs/stoneSkinDamageTypes runtime writes, buff replace/append semantics,
// expiry registration, concentration save-DC sourcing, and logging. Fully mocked and
// deterministic. Two-stage flow wiring lives in useSpellMetamagicFlow suites (which
// mock this handler); concentration clearing lives in cleanupConcentrationEffects;
// CharSummary resistance merging reads the real getter but owns display-side dedup.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle, applyStoneSkin, isStoneSkinActive, getStoneSkinDamageTypes } from './stoneSkinHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestWizard';
const TARGET_NAME = 'Ally1';

const DEFAULT_DAMAGE_TYPES = ['Bludgeoning', 'Piercing', 'Slashing'];

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER_NAME,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stone Skin',
    automation: {
      type: 'protection_from_energy',
      damageTypes: DEFAULT_DAMAGE_TYPES,
      duration: 'Concentration, up to 1 hour',
      ...automation,
    },
  };
}

function makeCombatContext(creatureNames = []) {
  return {
    creatures: creatureNames.map((name) => ({ name })),
  };
}

function activeBuffsWritten() {
  const callArgs = useRuntimeState.setRuntimeValue.mock.calls.find(
    (c) => c[1] === 'activeBuffs'
  );
  return callArgs[2];
}

function stubApplyReads(storedBuffs = []) {
  useRuntimeState.getRuntimeValue.mockReturnValue(storedBuffs);
  combatData.getCombatSummary.mockReturnValue(makeCombatContext([PLAYER_NAME, TARGET_NAME]));
}

// ── Tests ─────────────────────────────────────────────────────────

describe('stoneSkinHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns target selection popup listing every creature (caster included) with automation passthrough', async () => {
      const action = makeAction();
      damageUtils.getCombatContext.mockResolvedValue(
        makeCombatContext([TARGET_NAME, PLAYER_NAME])
      );

      const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'stoneSkin_target_selection',
          name: 'Stone Skin',
          creatureTargets: [TARGET_NAME, PLAYER_NAME],
          automation: action.automation,
        },
      });
    });

    it('returns empty creatureTargets when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([]));

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('defaults automation to empty object when missing from action', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeCombatContext([TARGET_NAME]));

      const result = await handle({ name: 'Stone Skin' }, makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result.payload.type).toBe('stoneSkin_target_selection');
      expect(result.payload.automation).toEqual({});
    });

    it('returns info popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, 'TestMap');

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Stone Skin',
          description: 'No combat context found. Cannot apply Stone Skin.',
          automation: makeAction().automation,
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('applyStoneSkin', () => {
    it('returns null with no side effects when targetName is missing', async () => {
      for (const target of [null, '']) {
        expect(await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, target)).toBeNull();
      }

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('writes resistance buff, damage-type key, expiry, and confirmation popup for a fresh target', async () => {
      const action = makeAction();
      stubApplyReads([]);

      const result = await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Stone Skin',
          automationType: 'protection_from_energy',
          description: 'Stone Skin applied to Ally1. They now have Resistance to Bludgeoning, Piercing, and Slashing damage.',
          automation: action.automation,
        },
      });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'activeBuffs',
        [{
          name: 'Stone Skin',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: DEFAULT_DAMAGE_TYPES,
          sourceCharacter: PLAYER_NAME,
        }],
        CAMPAIGN_NAME,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        TARGET_NAME,
        'stoneSkinDamageTypes',
        DEFAULT_DAMAGE_TYPES,
        CAMPAIGN_NAME,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: PLAYER_NAME,
        targetName: TARGET_NAME,
        effects: [{ type: 'remove_active_buff', buffName: 'Stone Skin' }],
        campaignName: CAMPAIGN_NAME,
      });
    });

    it('defaults damage types and duration to Bludgeoning/Piercing/Slashing, Concentration up to 1 hour, when automation omits them', async () => {
      const actions = [
        makeAction({ damageTypes: undefined, duration: undefined }),
        makeAction({}), // automation present but empty after stripping
        { name: 'Stone Skin' },
      ];
      for (const action of actions) {
        useRuntimeState.setRuntimeValue.mockClear();
        stubApplyReads([]);
        await applyStoneSkin(action, makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

        const buff = activeBuffsWritten().find((b) => b.name === 'Stone Skin');
        expect(buff).toEqual({
          name: 'Stone Skin',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: DEFAULT_DAMAGE_TYPES,
          sourceCharacter: PLAYER_NAME,
        });
      }
    });

    it('uses custom duration from automation when provided', async () => {
      stubApplyReads([]);

      await applyStoneSkin(
        makeAction({ duration: 'Concentration, up to 10 minutes' }),
        makePlayerStats(),
        CAMPAIGN_NAME,
        TARGET_NAME
      );

      const buff = activeBuffsWritten().find((b) => b.name === 'Stone Skin');
      expect(buff.duration).toBe('Concentration, up to 10 minutes');
    });

    it('replaces an existing Stone Skin buff at the tail, preserving unrelated buffs', async () => {
      stubApplyReads([
        { name: 'Mage Armor', effect: 'ac_bonus', acValue: 12 },
        { name: 'Stone Skin', effect: 'damage_resistance', resistanceTypes: ['Bludgeoning'] },
      ]);

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      expect(activeBuffsWritten()).toEqual([
        { name: 'Mage Armor', effect: 'ac_bonus', acValue: 12 },
        {
          name: 'Stone Skin',
          effect: 'damage_resistance',
          duration: 'Concentration, up to 1 hour',
          resistanceTypes: DEFAULT_DAMAGE_TYPES,
          sourceCharacter: PLAYER_NAME,
        },
      ]);
    });

    it('appends the buff to existing unrelated buffs when no Stone Skin is present', async () => {
      stubApplyReads([
        { name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 },
        { name: 'Bless', effect: 'ability_check_bless' },
      ]);

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      const buffs = activeBuffsWritten();
      expect(buffs).toHaveLength(3);
      expect(buffs[0]).toEqual({ name: 'Shield of Faith', effect: 'ac_bonus', acBonus: 2 });
      expect(buffs[1]).toEqual({ name: 'Bless', effect: 'ability_check_bless' });
      expect(buffs[2]).toEqual({
        name: 'Stone Skin',
        effect: 'damage_resistance',
        duration: 'Concentration, up to 1 hour',
        resistanceTypes: DEFAULT_DAMAGE_TYPES,
        sourceCharacter: PLAYER_NAME,
      });
    });

    it('treats missing or non-array activeBuffs store as empty', async () => {
      for (const stored of [null, undefined, 'not-an-array']) {
        useRuntimeState.setRuntimeValue.mockClear();
        stubApplyReads(stored);

        await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

        expect(activeBuffsWritten()).toEqual([
          {
            name: 'Stone Skin',
            effect: 'damage_resistance',
            duration: 'Concentration, up to 1 hour',
            resistanceTypes: DEFAULT_DAMAGE_TYPES,
            sourceCharacter: PLAYER_NAME,
          },
        ]);
      }
    });

    it('registers concentration with save DC from spellAbilities.saveDc', async () => {
      const summary = makeCombatContext([PLAYER_NAME, TARGET_NAME]);
      stubApplyReads([]);

      await applyStoneSkin(
        makeAction(),
        makePlayerStats({ spellAbilities: { saveDc: 15 } }),
        CAMPAIGN_NAME,
        TARGET_NAME
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        PLAYER_NAME,
        'Stone Skin',
        15,
        TARGET_NAME,
      );
    });

    it('computes save DC as 8 + proficiency when spellAbilities is missing', async () => {
      const summary = makeCombatContext([PLAYER_NAME, TARGET_NAME]);
      stubApplyReads([]);

      await applyStoneSkin(makeAction(), makePlayerStats({ proficiency: 4 }), CAMPAIGN_NAME, TARGET_NAME);

      // 8 + 4 = 12
      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        summary,
        PLAYER_NAME,
        'Stone Skin',
        12,
        TARGET_NAME,
      );
    });

    it('logs the cast to the campaign log', async () => {
      stubApplyReads([]);

      await applyStoneSkin(makeAction(), makePlayerStats(), CAMPAIGN_NAME, TARGET_NAME);

      expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
        type: 'ability_use',
        characterName: PLAYER_NAME,
        abilityName: 'Stone Skin',
        description: 'TestWizard cast Stone Skin on Ally1. Target has Resistance to Bludgeoning, Piercing, and Slashing damage.',
        targetName: TARGET_NAME,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('isStoneSkinActive', () => {
    it('reads activeBuffs and returns true when Stone Skin damage_resistance buff is present, alone or among others', () => {
      for (const buffs of [
        [{ name: 'Stone Skin', effect: 'damage_resistance' }],
        [
          { name: 'Mage Armor', effect: 'ac_bonus' },
          { name: 'Stone Skin', effect: 'damage_resistance' },
          { name: 'Shield', effect: 'ac_bonus' },
        ],
      ]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(buffs);
        expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(true);
      }

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(TARGET_NAME, 'activeBuffs', CAMPAIGN_NAME);
    });

    it('returns false when name or effect does not match', () => {
      for (const buffs of [
        [{ name: 'Protection from Energy', effect: 'damage_resistance' }],
        [{ name: 'Stone Skin', effect: 'ac_bonus' }],
        [
          { name: 'Mage Armor', effect: 'ac_bonus' },
          { name: 'Shield', effect: 'ac_bonus' },
        ],
      ]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(buffs);
        expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
      }
    });

    it('returns false when activeBuffs is empty, null, or undefined', () => {
      for (const stored of [[], null, undefined]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(stored);
        expect(isStoneSkinActive(TARGET_NAME, CAMPAIGN_NAME)).toBe(false);
      }
    });
  });

  describe('getStoneSkinDamageTypes', () => {
    it('reads the stoneSkinDamageTypes key and passes the stored value through', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(DEFAULT_DAMAGE_TYPES);

      expect(getStoneSkinDamageTypes(TARGET_NAME, CAMPAIGN_NAME)).toEqual(DEFAULT_DAMAGE_TYPES);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(TARGET_NAME, 'stoneSkinDamageTypes', CAMPAIGN_NAME);
    });

    it('passes through null or undefined when nothing is stored', () => {
      for (const stored of [null, undefined]) {
        useRuntimeState.getRuntimeValue.mockReturnValue(stored);
        expect(getStoneSkinDamageTypes(TARGET_NAME, CAMPAIGN_NAME)).toBe(stored);
      }
    });
  });
});
