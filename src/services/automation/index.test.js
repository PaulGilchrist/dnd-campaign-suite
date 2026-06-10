import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('./handlers/saveOnlyHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/saveAttackHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/healingHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/buffHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/conditionHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/sorceryHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/spellCastHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/initiativeHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/genericPopupHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/resourcePoolHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/fontOfMagicHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/healingPoolHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/spellModifierHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/combatStanceHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/reactionDamageHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/reactionDebuffHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/attackRiderHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/tempHpBuffHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/weaponMasteryHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/buffAllyHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/revivificationHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/bardicInspirationHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/autoRerollHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/bardicInspirationUseHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/reactionBonusHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/postCastRiderHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/bardicInspirationDefenseHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/bardicInspirationOffenseHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/divineSparkHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/divineInterventionHandler.js', () => ({ handle: vi.fn() }));
vi.mock('./handlers/bonusActionAttackHandler.js', () => ({ handle: vi.fn() }));

// ── Imports ────────────────────────────────────────────────────

import { executeHandler } from './index.js';
import * as saveOnlyHandler from './handlers/saveOnlyHandler.js';
import * as saveAttackHandler from './handlers/saveAttackHandler.js';
import * as healingHandler from './handlers/healingHandler.js';
import * as buffHandler from './handlers/buffHandler.js';
import * as conditionHandler from './handlers/conditionHandler.js';
import * as sorceryHandler from './handlers/sorceryHandler.js';
import * as spellCastHandler from './handlers/spellCastHandler.js';
import * as initiativeHandler from './handlers/initiativeHandler.js';
import * as genericPopupHandler from './handlers/genericPopupHandler.js';
import * as resourcePoolHandler from './handlers/resourcePoolHandler.js';
import * as fontOfMagicHandler from './handlers/fontOfMagicHandler.js';
import * as healingPoolHandler from './handlers/healingPoolHandler.js';
import * as spellModifierHandler from './handlers/spellModifierHandler.js';
import * as combatStanceHandler from './handlers/combatStanceHandler.js';
import * as reactionDamageHandler from './handlers/reactionDamageHandler.js';
import * as reactionDebuffHandler from './handlers/reactionDebuffHandler.js';
import * as attackRiderHandler from './handlers/attackRiderHandler.js';
import * as tempHpBuffHandler from './handlers/tempHpBuffHandler.js';
import * as weaponMasteryHandler from './handlers/weaponMasteryHandler.js';
import * as buffAllyHandler from './handlers/buffAllyHandler.js';
import * as revivificationHandler from './handlers/revivificationHandler.js';
import * as bardicInspirationHandler from './handlers/bardicInspirationHandler.js';
import * as autoRerollHandler from './handlers/autoRerollHandler.js';
import * as bardicInspirationUseHandler from './handlers/bardicInspirationUseHandler.js';
import * as reactionBonusHandler from './handlers/reactionBonusHandler.js';
import * as postCastRiderHandler from './handlers/postCastRiderHandler.js';
import * as bardicInspirationDefenseHandler from './handlers/bardicInspirationDefenseHandler.js';
import * as bardicInspirationOffenseHandler from './handlers/bardicInspirationOffenseHandler.js';
import * as divineSparkHandler from './handlers/divineSparkHandler.js';
import * as divineInterventionHandler from './handlers/divineInterventionHandler.js';
import * as bonusActionAttackHandler from './handlers/bonusActionAttackHandler.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [
      { name: 'Strength', bonus: 2 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Action',
    automation: {
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('executeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/early returns', () => {
    it('returns null when action is null', async () => {
      const result = await executeHandler(null, makePlayerStats(), campaignName, mapName);
      expect(result).toBeNull();
    });

    it('returns null when action is undefined', async () => {
      const result = await executeHandler(undefined, makePlayerStats(), campaignName, mapName);
      expect(result).toBeNull();
    });

    it('returns null when action.automation is missing', async () => {
      const action = { name: 'No Automation' };
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);
      expect(result).toBeNull();
    });

    it('returns null when action.automation.type is not in HANDLER_MAP', async () => {
      const action = makeAction({ type: 'unknown_type' });
      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);
      expect(result).toBeNull();
    });
  });

  describe('handler routing', () => {
    it('calls the correct handler for save_only type', async () => {
      const action = makeAction({ type: 'save_only' });
      saveOnlyHandler.handle.mockResolvedValue({ result: 'saved' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(saveOnlyHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'saved' });
    });

    it('calls the correct handler for save_attack type', async () => {
      const action = makeAction({ type: 'save_attack' });
      saveAttackHandler.handle.mockResolvedValue({ result: 'saved_attack' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(saveAttackHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'saved_attack' });
    });

    it('calls the correct handler for healing type', async () => {
      const action = makeAction({ type: 'healing' });
      healingHandler.handle.mockResolvedValue({ result: 'healed' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'healed' });
    });

    it('calls the correct handler for self_healing type (same as healing)', async () => {
      const action = makeAction({ type: 'self_healing' });
      healingHandler.handle.mockResolvedValue({ result: 'self_healed' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'self_healed' });
    });

    it('calls the correct handler for set_condition type', async () => {
      const action = makeAction({ type: 'set_condition' });
      conditionHandler.handle.mockResolvedValue({ result: 'conditioned' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(conditionHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'conditioned' });
    });

    it('calls the correct handler for buff_ally type', async () => {
      const action = makeAction({ type: 'buff_ally' });
      buffAllyHandler.handle.mockResolvedValue({ result: 'buffed_ally' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(buffAllyHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'buffed_ally' });
    });

    it('calls the correct handler for divine_spark type', async () => {
      const action = makeAction({ type: 'divine_spark' });
      divineSparkHandler.handle.mockResolvedValue({ result: 'divine_spark_result' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(divineSparkHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'divine_spark_result' });
    });

    it('calls the correct handler for divine_intervention type', async () => {
      const action = makeAction({ type: 'divine_intervention' });
      divineInterventionHandler.handle.mockResolvedValue({ result: 'intervention' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(divineInterventionHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'intervention' });
    });

    it('calls the correct handler for temp_buff type', async () => {
      const action = makeAction({ type: 'temp_buff' });
      buffHandler.handle.mockResolvedValue({ result: 'buffed' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(buffHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'buffed' });
    });

    it('calls the correct handler for sorcery_aura type', async () => {
      const action = makeAction({ type: 'sorcery_aura' });
      sorceryHandler.handle.mockResolvedValue({ result: 'aura' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(sorceryHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'aura' });
    });

    it('calls the correct handler for sorcery_incarnate type', async () => {
      const action = makeAction({ type: 'sorcery_incarnate' });
      sorceryHandler.handle.mockResolvedValue({ result: 'incarnate' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(sorceryHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'incarnate' });
    });

    it('calls the correct handler for free_spell type', async () => {
      const action = makeAction({ type: 'free_spell' });
      spellCastHandler.handle.mockResolvedValue({ result: 'spell_cast' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(spellCastHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'spell_cast' });
    });

    it('calls the correct handler for initiative_action type', async () => {
      const action = makeAction({ type: 'initiative_action' });
      initiativeHandler.handle.mockResolvedValue({ result: 'initiative' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(initiativeHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'initiative' });
    });

    it('calls the correct handler for resource_pool type', async () => {
      const action = makeAction({ type: 'resource_pool' });
      resourcePoolHandler.handle.mockResolvedValue({ result: 'resource_used' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(resourcePoolHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'resource_used' });
    });

    it('calls the correct handler for font_of_magic type', async () => {
      const action = makeAction({ type: 'font_of_magic' });
      fontOfMagicHandler.handle.mockResolvedValue({ result: 'font_used' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(fontOfMagicHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'font_used' });
    });

    it('calls the correct handler for healing_pool type', async () => {
      const action = makeAction({ type: 'healing_pool' });
      healingPoolHandler.handle.mockResolvedValue({ result: 'pool_heal' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(healingPoolHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'pool_heal' });
    });

    it('calls the correct handler for combat_stance type', async () => {
      const action = makeAction({ type: 'combat_stance' });
      combatStanceHandler.handle.mockResolvedValue({ result: 'stance' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(combatStanceHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'stance' });
    });

    it('calls the correct handler for attack_rider type', async () => {
      const action = makeAction({ type: 'attack_rider' });
      attackRiderHandler.handle.mockResolvedValue({ result: 'rider' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(attackRiderHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'rider' });
    });

    it('calls the correct handler for spell_modifier type', async () => {
      const action = makeAction({ type: 'spell_modifier' });
      spellModifierHandler.handle.mockResolvedValue({ result: 'modified' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(spellModifierHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'modified' });
    });

    it('calls the correct handler for temp_hp_buff type', async () => {
      const action = makeAction({ type: 'temp_hp_buff' });
      tempHpBuffHandler.handle.mockResolvedValue({ result: 'temp_hp' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(tempHpBuffHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'temp_hp' });
    });

    it('calls the correct handler for auto_reroll type', async () => {
      const action = makeAction({ type: 'auto_reroll' });
      autoRerollHandler.handle.mockResolvedValue({ result: 'rerolled' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(autoRerollHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'rerolled' });
    });

    it('calls the correct handler for reaction_damage type', async () => {
      const action = makeAction({ type: 'reaction_damage' });
      reactionDamageHandler.handle.mockResolvedValue({ result: 'damage' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(reactionDamageHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'damage' });
    });

    it('calls the correct handler for reaction_debuff type', async () => {
      const action = makeAction({ type: 'reaction_debuff' });
      reactionDebuffHandler.handle.mockResolvedValue({ result: 'debuff' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(reactionDebuffHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'debuff' });
    });

    it('calls the correct handler for mastery_rider type', async () => {
      const action = makeAction({ type: 'mastery_rider' });
      weaponMasteryHandler.handle.mockResolvedValue({ result: 'mastery' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(weaponMasteryHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'mastery' });
    });

    it('calls the correct handler for revivification type', async () => {
      const action = makeAction({ type: 'revivification' });
      revivificationHandler.handle.mockResolvedValue({ result: 'revived' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(revivificationHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'revived' });
    });

    it('calls the correct handler for bardic_inspiration type', async () => {
      const action = makeAction({ type: 'bardic_inspiration' });
      bardicInspirationHandler.handle.mockResolvedValue({ result: 'inspiration' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(bardicInspirationHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'inspiration' });
    });

    it('calls the correct handler for bardic_inspiration_use type', async () => {
      const action = makeAction({ type: 'bardic_inspiration_use' });
      bardicInspirationUseHandler.handle.mockResolvedValue({ result: 'inspiration_used' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(bardicInspirationUseHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'inspiration_used' });
    });

    it('calls the correct handler for reaction_bonus type', async () => {
      const action = makeAction({ type: 'reaction_bonus' });
      reactionBonusHandler.handle.mockResolvedValue({ result: 'bonus' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(reactionBonusHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'bonus' });
    });

    it('calls the correct handler for post_cast_rider type', async () => {
      const action = makeAction({ type: 'post_cast_rider' });
      postCastRiderHandler.handle.mockResolvedValue({ result: 'post_cast' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(postCastRiderHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'post_cast' });
    });

    it('calls the correct handler for bardic_inspiration_defense type', async () => {
      const action = makeAction({ type: 'bardic_inspiration_defense' });
      bardicInspirationDefenseHandler.handle.mockResolvedValue({ result: 'defense' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(bardicInspirationDefenseHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'defense' });
    });

    it('calls the correct handler for bardic_inspiration_offense type', async () => {
      const action = makeAction({ type: 'bardic_inspiration_offense' });
      bardicInspirationOffenseHandler.handle.mockResolvedValue({ result: 'offense' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(bardicInspirationOffenseHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'offense' });
    });

    it('calls the correct handler for bonus_action_attack type', async () => {
      const action = makeAction({ type: 'bonus_action_attack' });
      bonusActionAttackHandler.handle.mockResolvedValue({ result: 'bonus_attack' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(bonusActionAttackHandler.handle).toHaveBeenCalledWith(action, expect.any(Object), campaignName, mapName);
      expect(result).toEqual({ result: 'bonus_attack' });
    });
  });

  describe('error handling', () => {
    it('returns error popup when handler throws an exception', async () => {
      const action = makeAction({ type: 'healing' });
      healingHandler.handle.mockRejectedValue(new Error('handler failed'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('error popup includes action.name in description', async () => {
      const action = makeAction({ type: 'healing' });
      action.name = 'Cure Wounds';
      healingHandler.handle.mockRejectedValue(new Error('handler failed'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toBe('Failed to execute Cure Wounds');
    });

    it('error popup has type popup with automation_info payload', async () => {
      const action = makeAction({ type: 'save_only' });
      saveOnlyHandler.handle.mockRejectedValue(new Error('fail'));

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('passes all 4 arguments to handler', async () => {
      const action = makeAction({ type: 'healing' });
      const ps = makePlayerStats();
      healingHandler.handle.mockResolvedValue({ result: 'ok' });

      await executeHandler(action, ps, campaignName, mapName);

      expect(healingHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, mapName);
    });

    it('passes result from matched handler through', async () => {
      const action = makeAction({ type: 'buff_ally' });
      const expected = { type: 'modal', modalName: 'buffModal', payload: { duration: 1 } };
      buffAllyHandler.handle.mockResolvedValue(expected);

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(result).toBe(expected);
    });
  });

  describe('handler mapping verification', () => {
    it('sorcery_aura and sorcery_incarnate both map to same handler', async () => {
      const ps = makePlayerStats();
      sorceryHandler.handle.mockResolvedValue({ result: 'sorcery' });

      await executeHandler(makeAction({ type: 'sorcery_aura' }), ps, campaignName, mapName);
      const firstCall = sorceryHandler.handle.mock.calls[0];

      await executeHandler(makeAction({ type: 'sorcery_incarnate' }), ps, campaignName, mapName);
      const secondCall = sorceryHandler.handle.mock.calls[1];

      expect(firstCall).toHaveLength(secondCall.length);
    });

    it('healing and self_healing both map to same handler', async () => {
      const ps = makePlayerStats();
      healingHandler.handle.mockResolvedValue({ result: 'heal' });

      await executeHandler(makeAction({ type: 'healing' }), ps, campaignName, mapName);
      const firstCall = healingHandler.handle.mock.calls[0];

      await executeHandler(makeAction({ type: 'self_healing' }), ps, campaignName, mapName);
      const secondCall = healingHandler.handle.mock.calls[1];

      expect(firstCall).toHaveLength(secondCall.length);
    });

    it('bonus_attacks maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'bonus_attacks' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'bonus' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalledOnce();
      expect(result).toEqual({ result: 'bonus' });
    });

    it('extra_action maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'extra_action' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'extra' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'extra' });
    });

    it('damage_aura maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'damage_aura' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'aura_dmg' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'aura_dmg' });
    });

    it('damage_modifier maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'damage_modifier' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'mod' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'mod' });
    });

    it('conditional_disadvantage maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'conditional_disadvantage' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'disadvantage' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'disadvantage' });
    });

    it('conditional_advantage maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'conditional_advantage' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'advantage' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'advantage' });
    });

    it('passive_rule maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'passive_rule' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'passive' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'passive' });
    });

    it('post_cast_self_heal maps to genericPopup handler', async () => {
      const action = makeAction({ type: 'post_cast_self_heal' });
      genericPopupHandler.handle.mockResolvedValue({ result: 'self_heal' });

      const result = await executeHandler(action, makePlayerStats(), campaignName, mapName);

      expect(genericPopupHandler.handle).toHaveBeenCalled();
      expect(result).toEqual({ result: 'self_heal' });
    });
  });
});
