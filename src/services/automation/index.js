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
import { handle as handleExtraAction } from './handlers/extraActionHandler.js';
import { handle as handleDamageReduction } from './handlers/damageReductionHandler.js';
import { handle as handleOpenHandTechnique } from './handlers/openHandTechniqueHandler.js';
import { handle as handleReactionSaveHeal } from './handlers/reactionSaveHealHandler.js';
import { handle as handleCountercharm } from './handlers/countercharmHandler.js';
import { handle as handleFontOfInspiration } from './handlers/fontOfInspirationHandler.js';
import { handle as handleMultiTarget } from './handlers/multiTargetHandler.js';
import { handle as handleDivineOrder } from './handlers/divineOrderHandler.js';
import { handle as handleNaturesSanctuary, handleMove as handleNaturesSanctuaryMove } from './handlers/naturesSanctuaryHandler.js';
import { handle as handleStarryForm } from './handlers/starryFormHandler.js';
import { handle as handleCosmicOmen } from './handlers/cosmicOmenHandler.js';
import { handle as handleTwinklingConstellation } from './handlers/twinklingConstellationHandler.js';
import { handle as handleTacticalMind } from './handlers/tacticalMindHandler.js';
import { handle as handleCombatSuperiority } from './handlers/combatSuperiorityHandler.js';
import { handle as handleKnowEnemy } from './handlers/knowEnemyHandler.js';
import { handle as handleWarBond } from './handlers/warBondHandler.js';
import { handle as handleWarMagicCantrip } from './handlers/warMagicCantripHandler.js';
import { handle as handleWarMagicSpell } from './handlers/warMagicSpellHandler.js';
import { handle as handleArcaneCharge } from './handlers/arcaneChargeHandler.js';
import { handle as handlePsionicStrike } from './handlers/psionicStrikeHandler.js';
import { handle as handleProtectiveField } from './handlers/protectiveFieldHandler.js';
import { handle as handleTelekineticMovement } from './handlers/telekineticMovementHandler.js';
import { handle as handleTelekineticLeap } from './handlers/telekineticLeapHandler.js';
import { handle as handleTelekineticThrust } from './handlers/telekineticThrustHandler.js';
import { handle as handleGuardedMind } from './handlers/guardedMindHandler.js';
import { handle as handleBulwarkOfForce } from './handlers/bulwarkOfForceHandler.js';
import { handle as handleConcentrationBonusAttack } from './handlers/concentrationBonusAttackHandler.js';
import { handle as handleDamageTypeModifier } from './handlers/damageTypeModifierHandler.js';
import { handle as handleSuperiorDefense } from './handlers/superiorDefenseHandler.js';
import { handle as handleHandOfUltimateMercy } from './handlers/handOfUltimateMercyHandler.js';
import { handle as handleCloakOfShadows } from './handlers/cloakOfShadowsHandler.js';
import { handle as handleSacredWeapon } from './handlers/sacredWeaponHandler.js';
import { handle as handleSmiteOfProtection } from './handlers/smiteOfProtectionHandler.js';
import { handle as handleHolyNimbus } from './handlers/holyNimbusHandler.js';
import { handle as handleInspiringSmite } from './handlers/inspiringSmiteHandler.js';
import { handle as handlePeerlessAthlete } from './handlers/peerlessAthleteHandler.js';
import { handle as handleGloriousDefense } from './handlers/gloriousDefenseHandler.js';
import { handle as handleLivingLegend } from './handlers/livingLegendHandler.js';
import { handle as handleUndyingSentinel } from './handlers/undyingSentinelHandler.js';
import { handle as handleElderChampion } from './handlers/elderChampionHandler.js';
import { handle as handleVowOfEnmity } from './handlers/vowOfEnmityHandler.js';
import { handle as handleRelentlessAvenger } from './handlers/relentlessAvengerHandler.js';
import { handle as handleSoulOfVengeance } from './handlers/soulOfVengeanceHandler.js';
import { handle as handleAvengingAngel } from './handlers/avengingAngelHandler.js';
import { handle as handlePrimalCompanionSummon, handleCommand as handlePrimalCompanionCommand, handleRestore as handlePrimalCompanionRestore, handleBonusActionCommand as handlePrimalCompanionBonusActionCommand, applyBonusActionCommand as applyPrimalCompanionBonusActionCommand } from './handlers/primalCompanionHandler.js';
import { handle as handlePrimalCompanionSpellShare, applySpellShare as applyPrimalCompanionSpellShare } from './handlers/primalCompanionSpellShareHandler.js';
import { handle as handleBeguilingTwist } from './handlers/beguilingTwistHandler.js';
import { handle as handleFeyReinforcements, confirmFeyReinforcement as handleFeyReinforcementsConfirm } from './handlers/feyReinforcementsHandler.js';
import { handle as handleMistyWanderer, confirmMistyWanderer as handleMistyWandererConfirm } from './handlers/mistyWandererHandler.js';
import { handle as handleShadowyDodge } from './handlers/shadowyDodgeHandler.js';
import { handle as handleMistyEscape } from './handlers/mistyEscapeHandler.js';
import { handle as handleHunterPrey } from './handlers/hunterPreyHandler.js';
import { handle as handleDefensiveTactics } from './handlers/defensiveTacticsHandler.js';
import { handle as handleSuperiorHunterPrey } from './handlers/superiorHunterPreyHandler.js';
import { handle as handleSuperiorHunterDefense } from './handlers/superiorHunterDefenseHandler.js';
import { handle as handleBonusActionChoice } from './handlers/bonusActionChoiceHandler.js';
import { handle as handleSteadyAim } from './handlers/steadyAimHandler.js';
import { handle as handleStrokeOfLuck } from './handlers/strokeOfLuckHandler.js';
import { handle as handleMageHandControl } from './handlers/mageHandControlHandler.js';
import { handle as handleSpellThief } from './handlers/spellThiefHandler.js';
import { handle as handlePsychicTeleportation } from './handlers/psychicTeleportationHandler.js';
import { handle as handleFastHands } from './handlers/fastHandsHandler.js';
import { handle as handleStealthAttack } from './handlers/stealthAttackHandler.js';
import { handle as handleUseMagicDevice } from './handlers/useMagicDeviceHandler.js';
import { handle as handleRevelationInFlesh } from './handlers/revelationInFleshHandler.js';
import { handle as handleWarpingImplosion } from './handlers/warpingImplosionHandler.js';
import { handle as handleRestoreBalance } from './handlers/restoreBalanceHandler.js';
import { handle as handleBastionOfLaw } from './handlers/bastionOfLawHandler.js';
import { handle as handleTranseOfOrder } from './handlers/transeOfOrderHandler.js';
import { handle as handleClockworkCavalcade } from './handlers/clockworkCavalcadeHandler.js';
import { handle as handleElementalAffinity } from './handlers/elementalAffinityHandler.js';
import { handle as handleDragonWings } from './handlers/dragonWingsHandler.js';
import { handle as handleDragonCompanion, confirmDragonCompanion as handleDragonCompanionConfirm } from './handlers/dragonCompanionHandler.js';
import { handle as handleWildMagicSurge, handleTamedSurge as handleWildMagicTamed, handleFeatsOfChaos as handleFeatsOfChaosAdvantage, onFeatsOfChaosActivate as onFeatsOfChaosActivate, onFeatsOfChaosConsume as onFeatsOfChaosConsume, onTamedSurgeSelected as onWildMagicTamedSelected, onDoubleRollSelected } from './handlers/wildMagicSurgeHandler.js';
import { handle as handleMagicalCunning } from './handlers/magicalCunningHandler.js';
import { handle as handleContactPatron } from './handlers/contactPatronHandler.js';
import { handle as handleBeguilingDefenses } from './handlers/beguilingDefensesHandler.js';
import { handle as handleBewitchingMagic } from './handlers/bewitchingMagicHandler.js';
import { handle as handleStepsOfTheFey } from './handlers/stepsOfTheFeyHandler.js';

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
    extra_action: handleExtraAction,
    combat_stance: handleCombatStance,
    damage_aura: handleGenericPopup,
    attack_rider: handleAttackRider,
    damage_modifier: handleGenericPopup,
    spell_modifier: handleSpellModifier,
    temp_hp_buff: handleTempHpBuff,
    conditional_disadvantage: handleGenericPopup,
    conditional_advantage: handleGenericPopup,
    passive_rule: handleGenericPopup,
    auto_reroll: handleAutoReroll,
    reaction_damage: handleReactionDamage,
    reaction_debuff: handleReactionDebuff,
    damage_reduction: handleDamageReduction,
    open_hand_technique: handleOpenHandTechnique,
    reaction_save_heal: handleReactionSaveHeal,
    mastery_rider: handleWeaponMastery,
    revivification: handleRevivification,
     bardic_inspiration: handleBardicInspiration,
     bardic_inspiration_use: handleBardicInspirationUse,
     reaction_bonus: handleReactionBonus,
     post_cast_rider: handlePostCastRider,
     post_cast_self_heal: handleGenericPopup,
      bardic_inspiration_defense: handleBardicInspirationDefense,
      bardic_inspiration_offense: handleBardicInspirationOffense,
        countercharm: handleCountercharm,
        font_of_inspiration: handleFontOfInspiration,
        multi_target_spread: handleMultiTarget,
        divine_order: handleDivineOrder,
        nature_sanctuary: handleNaturesSanctuary,
        nature_sanctuary_move: handleNaturesSanctuaryMove,
        moonlight_step_rider: handleGenericPopup,
        shadow_step_rider: handleGenericPopup,
        starry_form: handleStarryForm,
        cosmic_omen: handleCosmicOmen,
        twinkling_constellations: handleTwinklingConstellation,
        tactical_mind: handleTacticalMind,
        combat_superiority: handleCombatSuperiority,
        know_enemy: handleKnowEnemy,
        war_bond_summon: handleWarBond,
        war_magic_cantrip: handleWarMagicCantrip,
        war_magic_spell: handleWarMagicSpell,
        arcane_charge: handleArcaneCharge,
        psionic_strike: handlePsionicStrike,
        protective_field: handleProtectiveField,
        telekinetic_movement: handleTelekineticMovement,
        telekinetic_leap: handleTelekineticLeap,
        telekinetic_thrust: handleTelekineticThrust,
        guarded_mind: handleGuardedMind,
        bulwark_of_force: handleBulwarkOfForce,
        concentration_bonus_attack: handleConcentrationBonusAttack,
        damage_type_modifier: handleDamageTypeModifier,
        superior_defense: handleSuperiorDefense,
        hand_of_ultimate_mercy: handleHandOfUltimateMercy,
        cloak_of_shadows: handleCloakOfShadows,
        sacred_weapon: handleSacredWeapon,
        post_cast_smite_cover: handleSmiteOfProtection,
        holy_nimbus: handleHolyNimbus,
        post_cast_inspiring_smite: handleInspiringSmite,
        peerless_athlete: handlePeerlessAthlete,
        glorious_defense: handleGloriousDefense,
        living_legend: handleLivingLegend,
        undying_sentinel: handleUndyingSentinel,
        elder_champion: handleElderChampion,
        vow_of_enmity: handleVowOfEnmity,
        relentless_avenger: handleRelentlessAvenger,
        soul_of_vengeance: handleSoulOfVengeance,
        avenging_angel: handleAvengingAngel,
        primal_companion_summon: handlePrimalCompanionSummon,
        primal_companion_command: handlePrimalCompanionCommand,
        primal_companion_restore: handlePrimalCompanionRestore,
        primal_companion_bonus_action_command: handlePrimalCompanionBonusActionCommand,
        primal_companion_bonus_action_command_apply: applyPrimalCompanionBonusActionCommand,
        primal_companion_double_strike: handleGenericPopup,
        primal_companion_spell_share: handlePrimalCompanionSpellShare,
        primal_companion_spell_share_apply: applyPrimalCompanionSpellShare,
        primal_companion_dodge: handleGenericPopup,
        reaction_save: handleBeguilingTwist,
        fey_reinforcements: handleFeyReinforcements,
        fey_reinforcements_confirm: handleFeyReinforcementsConfirm,
        misty_wanderer: handleMistyWanderer,
        misty_wanderer_confirm: handleMistyWandererConfirm,
        shadowy_dodge: handleShadowyDodge,
        misty_escape: handleMistyEscape,
        beguiling_defenses: handleBeguilingDefenses,
        bewitching_magic: handleBewitchingMagic,
        hunter_prey: handleHunterPrey,
        defensive_tactics: handleDefensiveTactics,
        superior_hunter_prey: handleSuperiorHunterPrey,
        superior_hunter_defense: handleSuperiorHunterDefense,
        bonus_action_choice: handleBonusActionChoice,
        steady_aim: handleSteadyAim,
        stroke_of_luck: handleStrokeOfLuck,
        mage_hand_control: handleMageHandControl,
        spell_thief: handleSpellThief,
        psychic_teleportation: handlePsychicTeleportation,
        fast_hands: handleFastHands,
        stealth_attack: handleStealthAttack,
        use_magic_device: handleUseMagicDevice,
        revelation_in_flesh: handleRevelationInFlesh,
        warping_implosion: handleWarpingImplosion,
         restore_balance: handleRestoreBalance,
         bastion_of_law: handleBastionOfLaw,
         transe_of_order: handleTranseOfOrder,
          clockwork_cavalcade: handleClockworkCavalcade,
          elemental_affinity: handleElementalAffinity,
            dragon_wings: handleDragonWings,
            dragon_companion: handleDragonCompanion,
            dragon_companion_confirm: handleDragonCompanionConfirm,
            wild_magic_surge: handleWildMagicSurge,
            wild_magic_tamed: handleWildMagicTamed,
            feats_of_chaos: handleFeatsOfChaosAdvantage,
            feats_of_chaos_activate: onFeatsOfChaosActivate,
            feats_of_chaos_consume: onFeatsOfChaosConsume,
            wild_magic_tamed_selected: onWildMagicTamedSelected,
            wild_magic_double_roll_selected: onDoubleRollSelected,
            magical_cunning: handleMagicalCunning,
            contact_patron: handleContactPatron,
            steps_of_the_fey: handleStepsOfTheFey,
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
