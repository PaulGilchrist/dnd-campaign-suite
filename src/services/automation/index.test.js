// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';

// ── Module-level mocks (must use inline factories due to hoisting) ─

vi.mock('./handlers/combat/saveOnlyHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'save_only' }),
}));
vi.mock('./handlers/combat/saveAttackHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'save_attack' }),
}));
vi.mock('./handlers/healing/healingHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'shared_healing' }),
}));
vi.mock('./handlers/buffs/buffHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'buff' }),
}));
vi.mock('./handlers/buffs/conditionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'condition' }),
}));
vi.mock('./handlers/resources/sorceryHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'shared_sorcery' }),
}));
vi.mock('./handlers/spells/spellCastHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'spell_cast' }),
}));
vi.mock('./handlers/combat/initiativeHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'initiative' }),
}));
vi.mock('./handlers/resources/resourcePoolHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'resource_pool' }),
}));
vi.mock('./handlers/resources/fontOfMagicHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'font_of_magic' }),
}));
vi.mock('./handlers/healing/healingPoolHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'healing_pool' }),
}));

vi.mock('./handlers/combat/combatStanceHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'combat_stance' }),
}));
vi.mock('./handlers/combat/attackRiderHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'attack_rider' }),
}));
vi.mock('./handlers/buffs/tempHpBuffHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'temp_hp' }),
}));
vi.mock('./handlers/combat/autoRerollHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'auto_reroll' }),
}));
vi.mock('./handlers/reactions/reactionDamageHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'reaction_damage' }),
}));
vi.mock('./handlers/reactions/reactionDebuffHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'reaction_debuff' }),
}));
vi.mock('./handlers/combat/weaponMasteryHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'weapon_mastery' }),
}));
vi.mock('./handlers/buffs/buffAllyHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'buff_ally' }),
}));
vi.mock('./handlers/healing/revivificationHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'revivification' }),
}));
vi.mock('./handlers/class-bard/bardicInspirationHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'bardic_inspiration' }),
}));
vi.mock('./handlers/combat/bonusActionAttackHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'bonus_action_attack' }),
}));
vi.mock('./handlers/class-bard/bardicInspirationUseHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'bardic_inspiration_use' }),
}));
vi.mock('./handlers/reactions/reactionBonusHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'reaction_bonus' }),
}));
vi.mock('./handlers/combat/postCastRiderHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'post_cast_rider' }),
}));
vi.mock('./handlers/class-bard/bardicInspirationDefenseHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'bardic_inspiration_defense' }),
}));
vi.mock('./handlers/class-bard/bardicInspirationOffenseHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'bardic_inspiration_offense' }),
}));
vi.mock('./handlers/class-cleric-paladin/divineSparkHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'divine_spark' }),
}));
vi.mock('./handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'divine_intervention' }),
}));
vi.mock('./handlers/combat/extraActionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'extra_action' }),
}));
vi.mock('./handlers/spells/eyebiteHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'eyebite' }),
}));
vi.mock('./handlers/combat/damageReductionHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'damage_reduction' }),
}));
vi.mock('./handlers/class-sorcerer/protectiveFieldHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'protective_field' }),
}));
vi.mock('./handlers/class-wizard/SavantHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'savant' }),
}));
vi.mock('./handlers/buffs/encouragingSongHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'encouraging_song' }),
}));
vi.mock('../../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn().mockReturnValue({ type: 'popup', payload: { type: 'automation_info', description: 'test' } }),
}));

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [{ name: 'Strength', bonus: 2 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return { name: 'Test Action', automation: { ...automation } };
}

// ── Tests ───────────────────────────────────────────────────────

describe('executeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/early returns', () => {
    it.each([
      [null, 'null action'],
      [undefined, 'undefined action'],
      [{}, 'empty object'],
      [{ automation: null }, 'null automation'],
    ])('returns null for %s (%s)', async (action, _label) => {
      expect(await executeHandler(action, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action.automation.type is not in HANDLER_MAP', async () => {
      const result = await executeHandler(
        makeAction({ type: 'nonexistent_type' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );
      expect(result).toBeNull();
    });
  });

  describe('handler routing', () => {
    it.each([
      ['save_only', './handlers/combat/saveOnlyHandler.js'],
      ['save_attack', './handlers/combat/saveAttackHandler.js'],
      ['healing', './handlers/healing/healingHandler.js'],
      ['self_healing', './handlers/healing/healingHandler.js'],
      ['temp_buff', './handlers/buffs/buffHandler.js'],
      ['set_condition', './handlers/buffs/conditionHandler.js'],
      ['sorcery_aura', './handlers/resources/sorceryHandler.js'],
      ['sorcery_incarnate', './handlers/resources/sorceryHandler.js'],
      ['free_spell', './handlers/spells/spellCastHandler.js'],
      ['initiative_action', './handlers/combat/initiativeHandler.js'],
      ['resource_pool', './handlers/resources/resourcePoolHandler.js'],
      ['font_of_magic', './handlers/resources/fontOfMagicHandler.js'],
      ['healing_pool', './handlers/healing/healingPoolHandler.js'],
      ['combat_stance', './handlers/combat/combatStanceHandler.js'],
      ['attack_rider', './handlers/combat/attackRiderHandler.js'],
      ['temp_hp_buff', './handlers/buffs/tempHpBuffHandler.js'],
      ['auto_reroll', './handlers/combat/autoRerollHandler.js'],
      ['reaction_damage', './handlers/reactions/reactionDamageHandler.js'],
      ['reaction_debuff', './handlers/reactions/reactionDebuffHandler.js'],
      ['mastery_rider', './handlers/combat/weaponMasteryHandler.js'],
      ['buff_ally', './handlers/buffs/buffAllyHandler.js'],
      ['revivification', './handlers/healing/revivificationHandler.js'],
      ['bardic_inspiration', './handlers/class-bard/bardicInspirationHandler.js'],
      ['bardic_inspiration_use', './handlers/class-bard/bardicInspirationUseHandler.js'],
      ['reaction_bonus', './handlers/reactions/reactionBonusHandler.js'],
      ['post_cast_rider', './handlers/combat/postCastRiderHandler.js'],
      ['bardic_inspiration_defense', './handlers/class-bard/bardicInspirationDefenseHandler.js'],
      ['bardic_inspiration_offense', './handlers/class-bard/bardicInspirationOffenseHandler.js'],
      ['divine_spark', './handlers/class-cleric-paladin/divineSparkHandler.js'],
      ['divine_intervention', './handlers/class-cleric-paladin/divineInterventionHandler.js'],
      ['bonus_action_attack', './handlers/combat/bonusActionAttackHandler.js'],
      ['extra_action', './handlers/combat/extraActionHandler.js'],
      ['eyebite', './handlers/spells/eyebiteHandler.js'],
    ])('routes "%s" to its handler with all 4 arguments and returns the handler result', async (type, _modulePath) => {
      const expectedReturn = { type, handled: true };

      // Capture the mock from the imported module via dynamic import
      const mockModule = await import(_modulePath);

      mockModule.handle.mockResolvedValue(expectedReturn);

      const action = makeAction({ type });
      const playerStats = makePlayerStats();

      const result = await executeHandler(action, playerStats, campaignName, mapName);

      expect(mockModule.handle).toHaveBeenCalledTimes(1);
      expect(mockModule.handle).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, undefined);
      expect(result).toBe(expectedReturn);
    });
  });



  describe('unmapped types', () => {
    it.each([
      'bonus_attacks',
      'damage_aura',
      'damage_modifier',
      'conditional_disadvantage',
      'conditional_advantage',
      'passive_rule',
      'post_cast_self_heal',
      'unknown_type',
    ])('returns null for unmapped type "%s"', async (type) => {
      const result = await executeHandler(makeAction({ type }), makePlayerStats(), campaignName, mapName);
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    let originalConsoleError;

    beforeEach(() => {
      originalConsoleError = console.error;
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('returns a popup when handler throws', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      healingHandle.mockRejectedValue(new Error('boom'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('includes action.name in the error popup description', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      action.name = 'Cure Wounds';
      healingHandle.mockRejectedValue(new Error('boom'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toBe('Failed to execute Cure Wounds');
    });

    it('logs the error to console.error', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      healingHandle.mockRejectedValue(new Error('boom'));

      await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(console.error).toHaveBeenCalledWith(
        '[automation] Handler healing/undefined failed:',
        expect.any(Error),
      );
    });

    it('passes the original action object to the handler', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const action = makeAction({ type: 'healing' });
      const playerStats = makePlayerStats();
      healingHandle.mockResolvedValue({ ok: true });

      await executeHandler(action, playerStats, campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, undefined);
    });

    it('returns the handler result unchanged on success', async () => {
      const { handle: buffAllyHandle } = await import('./handlers/buffs/buffAllyHandler.js');
      const action = makeAction({ type: 'buff_ally' });
      const expectedReturn = { type: 'modal', modalName: 'buffModal', payload: { duration: 1 } };
      buffAllyHandle.mockResolvedValue(expectedReturn);

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBe(expectedReturn);
    });
  });

  describe('spell_modifier handler', () => {
    it('returns automation_info popup for non-Metamagic types', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Quickened Spell';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Quickened Spell');
    });

    it('returns null for Metamagic type', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      action.name = 'Metamagic';

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });

  describe('damage_reduction handler', () => {
    it('routes to protectiveField when automation.cost.resource is psionicEnergy', async () => {
      const action = makeAction({
        type: 'damage_reduction',
        cost: { resource: 'psionicEnergy' },
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('protective_field');
    });

    it.each([
      [{ resource: 'something_else' }, 'other resource type'],
      [undefined, 'missing cost'],
      [{}],
    ])('routes to damageReduction when cost is %s', async (cost, _label) => {
      const action = makeAction({
        type: 'damage_reduction',
        cost,
      });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.result).toBe('damage_reduction');
    });
  });

  describe('auto array handling', () => {
    it('selects passive_rule entry when it has a registered handler', async () => {
      const action = {
        name: 'Guarded Mind',
        automation: [
          { type: 'passive_rule', effect: 'abjuration_savant' },
          { type: 'auto_reroll' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it('selects first entry with a registered handler when no passive_rule present', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'auto_reroll', action: 'Bonus Action' },
          { type: 'auto_reroll' },
        ],
      };

      const { handle: autoRerollHandle } = await import('./handlers/combat/autoRerollHandler.js');
      autoRerollHandle.mockResolvedValue({ result: 'auto_reroll' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'auto_reroll' });
    });

    it('returns null when auto array has no actionable entries', async () => {
      const action = {
        name: 'Test',
        automation: [
          { type: 'passive_rule', effect: 'unknown_savant' },
          { type: 'unknown_type' },
        ],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when auto array is empty', async () => {
      const action = {
        name: 'Test',
        automation: [],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when auto array contains null entries', async () => {
      const action = {
        name: 'Test',
        automation: [null, null],
      };

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });

    it('passes characters 5th argument to handler when provided', async () => {
      const action = makeAction({ type: 'auto_reroll' });
      const characters = [{ name: 'Char1' }, { name: 'Char2' }];

      const { handle: autoRerollHandle } = await import('./handlers/combat/autoRerollHandler.js');
      autoRerollHandle.mockResolvedValue({ result: 'auto_reroll' });

      await executeHandler(action, makePlayerStats(), campaignName, mapName, characters);

      expect(autoRerollHandle).toHaveBeenCalledWith(
        expect.any(Object), makePlayerStats(), campaignName, mapName, characters,
      );
    });

    it('passes undefined as 5th argument when characters is not provided', async () => {
      const action = makeAction({ type: 'auto_reroll' });

      const { handle: autoRerollHandle } = await import('./handlers/combat/autoRerollHandler.js');
      autoRerollHandle.mockResolvedValue({ result: 'auto_reroll' });

      await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(autoRerollHandle).toHaveBeenCalledWith(
        expect.any(Object), makePlayerStats(), campaignName, mapName, undefined,
      );
    });
  });

  describe('passive_rule handler', () => {
    it.each([
      'abjuration_savant',
      'divination_savant',
      'evocation_savant',
      'illusion_savant',
    ])('routes %s passive_rule to savant handler', async (effect) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({ result: 'savant' });
    });

    it.each([
      ['unknown_savant', 'unknown effect'],
      [undefined, 'no effect field'],
    ])('returns null for passive_rule with %s', async (effect, _label) => {
      const action = makeAction({ type: 'passive_rule', effect });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBeNull();
    });
  });
});
