import { handle as handleSaveOnly } from './handlers/saveOnlyHandler.js';
import { handle as handleSaveAttack } from './handlers/saveAttackHandler.js';
import { handle as handleHealing } from './handlers/healingHandler.js';
import { handle as handleBuff } from './handlers/buffHandler.js';
import { handle as handleCondition } from './handlers/conditionHandler.js';
import { handle as handleSorcery } from './handlers/sorceryHandler.js';
import { handle as handleSpellCast } from './handlers/spellCastHandler.js';
import { handle as handleInitiative } from './handlers/initiativeHandler.js';
import { handle as handleGenericPopup } from './handlers/genericPopupHandler.js';
import { handle as handleResourcePool } from './handlers/resourcePoolHandler.js';
import { handle as handleFontOfMagic } from './handlers/fontOfMagicHandler.js';
import { handle as handleHealingPool } from './handlers/healingPoolHandler.js';
import { handle as handleSpellModifier } from './handlers/spellModifierHandler.js';
import { handle as handleCombatStance } from './handlers/combatStanceHandler.js';
import { handle as handleReactionDamage } from './handlers/reactionDamageHandler.js';
import { handle as handleReactionDebuff } from './handlers/reactionDebuffHandler.js';
import { handle as handleAttackRider } from './handlers/attackRiderHandler.js';
import { handle as handleTempHpBuff } from './handlers/tempHpBuffHandler.js';
import { handle as handleWeaponMastery } from './handlers/weaponMasteryHandler.js';
import { handle as handleBuffAlly } from './handlers/buffAllyHandler.js';
import { handle as handleRevivification } from './handlers/revivificationHandler.js';
import { handle as handleBardicInspiration } from './handlers/bardicInspirationHandler.js';
import { handle as handleAutoReroll } from './handlers/autoRerollHandler.js';
import { handle as handleBardicInspirationUse } from './handlers/bardicInspirationUseHandler.js';
import { handle as handleReactionBonus } from './handlers/reactionBonusHandler.js';
import { handle as handlePostCastRider } from './handlers/postCastRiderHandler.js';
import { handle as handleBardicInspirationDefense } from './handlers/bardicInspirationDefenseHandler.js';
import { handle as handleBardicInspirationOffense } from './handlers/bardicInspirationOffenseHandler.js';
import { handle as handleDivineSpark } from './handlers/divineSparkHandler.js';
import { handle as handleDivineIntervention } from './handlers/divineInterventionHandler.js';
import { handle as handleBonusActionAttack } from './handlers/bonusActionAttackHandler.js';

const HANDLER_MAP = {
    save_only: handleSaveOnly,
    save_attack: handleSaveAttack,
    healing: handleHealing,
    self_healing: handleHealing,
    temp_buff: handleBuff,
    set_condition: handleCondition,
    sorcery_aura: handleSorcery,
    sorcery_incarnate: handleSorcery,
    free_spell: handleSpellCast,
    initiative_action: handleInitiative,
    bonus_attacks: handleGenericPopup,
    bonus_action_attack: handleBonusActionAttack,
    buff_ally: handleBuffAlly,
    resource_pool: handleResourcePool,
    divine_spark: handleDivineSpark,
    divine_intervention: handleDivineIntervention,
    font_of_magic: handleFontOfMagic,
    healing_pool: handleHealingPool,
    extra_action: handleGenericPopup,
    combat_stance: handleCombatStance,
    damage_aura: handleGenericPopup,
    attack_rider: handleAttackRider,
    damage_bonus: handleGenericPopup,
    spell_modifier: handleSpellModifier,
    temp_hp_buff: handleTempHpBuff,
    conditional_disadvantage: handleGenericPopup,
    conditional_advantage: handleGenericPopup,
    passive_rule: handleGenericPopup,
    auto_reroll: handleAutoReroll,
    reaction_damage: handleReactionDamage,
    reaction_debuff: handleReactionDebuff,
    mastery_rider: handleWeaponMastery,
    revivification: handleRevivification,
     bardic_inspiration: handleBardicInspiration,
     bardic_inspiration_use: handleBardicInspirationUse,
     reaction_bonus: handleReactionBonus,
     post_cast_rider: handlePostCastRider,
     post_cast_self_heal: handleGenericPopup,
     bardic_inspiration_defense: handleBardicInspirationDefense,
     bardic_inspiration_offense: handleBardicInspirationOffense,
};

export async function executeHandler(action, playerStats, campaignName, mapName) {
    if (!action?.automation) return null;

    const handler = HANDLER_MAP[action.automation.type];
    if (!handler) return null;

    try {
        return await handler(action, playerStats, campaignName, mapName);
      } catch (e) {
          console.error(`[automation] Handler ${action.automation.type} failed:`, e);
          return { type: 'popup', payload: { type: 'automation_info', name: action.name, description: `Failed to execute ${action.name}` } };
      }
}
