// @improved-by-ai
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
    it('returns null when action is null', async () => {
      expect(await executeHandler(null, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action is undefined', async () => {
      expect(await executeHandler(undefined, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action is an object with no automation property', async () => {
      expect(await executeHandler({}, makePlayerStats(), campaignName, mapName)).toBeNull();
    });

    it('returns null when action.automation is null', async () => {
      expect(await executeHandler({ automation: null }, makePlayerStats(), campaignName, mapName)).toBeNull();
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

  describe('shared handler mapping', () => {
    it('routes both "healing" and "self_healing" to the same handler', async () => {
      const { handle: healingHandle } = await import('./handlers/healing/healingHandler.js');
      const expectedReturn = { result: 'healed' };
      healingHandle.mockResolvedValue(expectedReturn);

      await executeHandler(makeAction({ type: 'healing' }), makePlayerStats(), campaignName, mapName);
      await executeHandler(makeAction({ type: 'self_healing' }), makePlayerStats(), campaignName, mapName);

      expect(healingHandle).toHaveBeenCalledTimes(2);
      expect(healingHandle).toHaveBeenNthCalledWith(1, expect.objectContaining({ automation: { type: 'healing' } }), expect.any(Object), campaignName, mapName, undefined);
      expect(healingHandle).toHaveBeenNthCalledWith(2, expect.objectContaining({ automation: { type: 'self_healing' } }), expect.any(Object), campaignName, mapName, undefined);
    });

    it('routes both "sorcery_aura" and "sorcery_incarnate" to the same handler', async () => {
      const { handle: sorceryHandle } = await import('./handlers/resources/sorceryHandler.js');
      const expectedReturn = { result: 'sorcery' };
      sorceryHandle.mockResolvedValue(expectedReturn);

      await executeHandler(makeAction({ type: 'sorcery_aura' }), makePlayerStats(), campaignName, mapName);
      await executeHandler(makeAction({ type: 'sorcery_incarnate' }), makePlayerStats(), campaignName, mapName);

      expect(sorceryHandle).toHaveBeenCalledTimes(2);
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
});
