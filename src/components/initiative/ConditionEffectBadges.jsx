import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js'
import CreatureBadge from '../common/CreatureBadge.jsx'

function getEffectDescription(label) {
    if (EFFECT_DESCRIPTIONS[label]) return EFFECT_DESCRIPTIONS[label]
    if (label.startsWith('Speed -')) return 'Speed is reduced by the amount shown.'
    if (label.startsWith('+') && label.includes('to hit')) return 'Attackers gain the shown bonus to hit this creature.'
    return label
}

function removeConditionByKey(creatureName, conditionKey, campaignName) {
    const conditions = getRuntimeValue(creatureName, 'activeConditions') || []
    const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionKey.toLowerCase())
    setRuntimeValue(creatureName, 'activeConditions', filtered, campaignName)
}

function removeTargetEffect(targetName, effectType, campaignName) {
    const existingEffects = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = existingEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target
        return !(teTarget === targetName && te.effect === effectType)
    })
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName)
}

function removeTargetEffectsByTypes(targetName, effectTypes, campaignName) {
    const existingEffects = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = existingEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target
        return !(teTarget === targetName && effectTypes.includes(te.effect))
    })
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName)
}

function removeBuffsByTypes(creatureName, buffEffects, campaignName) {
    const buffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []
    const filtered = buffs.filter(b => !buffEffects.includes(b.effect))
    setRuntimeValue(creatureName, 'activeBuffs', filtered, campaignName)
}

const EFFECT_TO_SEMANTIC = {
    'effect-stealth-attack': 'effect-neutral',
    'effect-speed-zero': 'effect-debuff',
    'effect-target-disadv': 'effect-buff',
    'effect-cannot-act': 'effect-debuff',
}

function resolveCls(cls) {
    return EFFECT_TO_SEMANTIC[cls] || cls
}

const findDirect = (ctx, effect) => (ctx.targetEffects || []).find(te => te.effect === effect && te.target === ctx.creatureName)

const findResolved = (ctx, effect) => (ctx.targetEffects || []).find(te => {
    const teTarget = Array.isArray(te.target) ? te.target[0] : te.target
    return te.effect === effect && teTarget === ctx.creatureName
})

function buildAttackAdvantageBadge(ctx) {
    const reasons = ctx.effects.attackAdvantageReasons || []
    const reasonText = reasons.length > 0 ? reasons.join(', ') : ''
    const buffTypes = []
    if (ctx.hasVowBuff || reasons.includes('Vow of Enmity')) buffTypes.push('vow_of_enmity')
    if (ctx.hasAdvAndSavesBuff || reasons.includes('Zealous Presence')) buffTypes.push('advantage_attacks_and_saves')
    const teTypes = ['advantage_attacks', 'foresight', 'next_attack_advantage', 'clairvoyant_combatant']
    return { label: 'Adv', cls: 'effect-buff', icon: 'fa-arrow-up', removable: true, removeAction: 'remove_derived', effectTypes: [...teTypes, ...buffTypes], tooltip: `Advantage on attack rolls${reasonText ? ' (' + reasonText + ')' : ''}` }
}

function buildTargetAdvantageBadge(ctx) {
    const reasons = ctx.effects.targetAdvantageReasons || []
    const reasonText = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
    const teTypes = ['reckless_attack', 'clairvoyant_combatant', 'crusher_enhanced_critical', 'distracting_strike_advantage', 'faerie_fire']
    return { label: 'Adv vs', cls: 'effect-debuff', icon: 'fa-arrow-up', removable: true, removeAction: 'remove_derived', effectTypes: teTypes, tooltip: `Attackers have advantage on attack rolls against this creature${reasonText}` }
}

function buildSaveAdvantageBadge(ctx) {
    const reasons = (ctx.effects.saveAdvantageReasons || []).length > 0 ? ctx.effects.saveAdvantageReasons.join(', ') : 'Advantage on saving throws'
    const teTypes = ['advantage_saves', 'foresight']
    const buffTypes = []
    if (ctx.hasAdvAndSavesBuff || reasons.includes('Zealous Presence')) buffTypes.push('advantage_attacks_and_saves')
    if (reasons.includes('Vow of Enmity')) buffTypes.push('vow_of_enmity')
    return { label: 'Adv Save', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'remove_derived', effectTypes: [...teTypes, ...buffTypes], tooltip: `Advantage on saving throws${reasons !== 'Advantage on saving throws' ? ' (' + reasons + ')' : ''}` }
}

function buildAbilityCheckDisadvBadge(ctx) {
    const abilityNames = ctx.effects.abilityCheckDisadvantageAbilities.map(a => a.substring(0, 3).toLowerCase()).join(', ')
    return { label: `Check Disadv (${abilityNames})`, cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'hex_ability_check_disadvantage' }
}

function buildAbilityCheckAdvantageBadge(ctx) {
    const abilityNames = ctx.effects.abilityCheckAdvantageAbilities.map(a => a.substring(0, 3).toLowerCase()).join(', ')
    return { label: `Adv Check (${abilityNames})`, cls: 'effect-buff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'enhance_ability' }
}

function buildAbilityCheckAdvantageAllBadge(ctx) {
    const reasons = ctx.effects.abilityCheckAdvantageReasons || []
    const reasonText = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
    return { label: 'Adv Check', cls: 'effect-buff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'advantage_abilities', tooltip: `Advantage on all ability checks${reasonText ? ' (' + reasonText + ')' : ''}` }
}

function buildNoOABadge(ctx) {
    const noOASources = [...new Set(ctx.targetEffects.filter(te => te.effect === 'no_opportunity_attacks' && te.source).map(te => te.source))]
    return { label: 'No OA', cls: 'effect-debuff', icon: 'fa-ban', removable: true, removeAction: 'target_effect', effectType: 'no_opportunity_attacks', tooltip: noOASources.length > 0 ? `No Opportunity Attacks (from ${noOASources.join(', ')})` : undefined }
}

function buildSaveDisadvBadge(ctx) {
    const reasons = (ctx.effects.saveDisadvantage || []).length > 0 ? ` (${ctx.effects.saveDisadvantage.join(', ')})` : ''
    return { label: `Save Disadv${reasons}`, cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'hex_save_disadvantage' }
}

function buildDisadvNextAttackBadge(ctx) {
    const def = getEffectDefinition('disadvantage_next_attack')
    return { label: def.label, cls: 'effect-debuff', icon: def.icon, removable: true, removeAction: 'target_effect', effectType: 'disadvantage_next_attack', tooltip: `Disadvantage on its next attack roll (from ${ctx.te.source || 'unknown'})` }
}

function buildPerceptionDisadvBadge(ctx) {
    const def = getEffectDefinition('disadvantage_perception_checks')
    return { label: def.label, cls: 'effect-debuff', icon: def.icon, removable: true, removeAction: 'target_effect', effectType: 'disadvantage_perception_checks', tooltip: `Disadvantage on Wisdom (Perception) checks (from ${ctx.te.source || 'unknown'})` }
}

function buildPassWithoutTraceBadge(ctx) {
    const def = getEffectDefinition('pass_without_trace_bonus')
    return { label: def.label, cls: 'effect-buff', icon: def.icon, removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'pass_without_trace_bonus', tooltip: `Pass Without Trace from ${ctx.te.source || 'unknown'}: +10 bonus to Dexterity (Stealth) checks and leaves no tracks (Concentration, up to 1 hour)` }
}

function buildBaneBadge(ctx) {
    const casterName = ctx.te?.source || 'unknown'
    const displayLabel = ctx.te?.displayLabel || 'Bane'
    const isSelf = casterName === ctx.creatureName
    return { label: displayLabel, cls: isSelf ? 'effect-buff' : 'effect-debuff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'bane_penalty', tooltip: `${displayLabel} from ${casterName}: -1d4 on attack rolls and saving throws` }
}

function buildEnfeebleBadge(ctx) {
    const rayDc = ctx.te?.dc || 0
    return { label: 'Enfeeblement', cls: 'effect-debuff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'ray_of_enfeeble_debuff', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: rayDc, ability: 'con' }) : undefined, tooltip: `Ray of Enfeeblement from ${ctx.te?.source || 'unknown'}: -1d8 to damage rolls, Disadvantage on STR checks. Click to reroll the CON save (DC ${rayDc}); a success ends the spell.` }
}

function buildProtectionFromPoisonBadge(ctx) {
    return { label: 'Protection from Poison', cls: 'effect-buff', icon: 'fa-shield-halved', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'protection_from_poison', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'poisoned', label: 'Poisoned', dc: ctx.te.dc || 0, ability: 'con' }) : undefined, tooltip: `Protection from Poison from ${ctx.te.source || 'unknown'}: Resistance to poison damage. Advantage on saving throws against being poisoned. Concentration` }
}

function buildOttoDanceBadge(ctx) {
    const danceDc = ctx.te.dc || 0
    return { label: "Otto's Irresistible Dance", cls: 'effect-debuff', icon: 'fa-music', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'ottos_irresistible_dance', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'charmed', label: 'Charmed', dc: danceDc, ability: 'wis' }) : undefined, tooltip: `Otto's Irresistible Dance from ${ctx.te.source || 'unknown'}: Charmed, Speed 0, Disadvantage on Dexterity saving throws and attack rolls. Click to reroll the WIS save (DC ${danceDc}); a success ends the spell.` }
}

function buildTashasLaughterBadge(ctx) {
    const laughterDc = ctx.te.dc || 0
    return { label: "Tasha's Hideous Laughter", cls: 'effect-debuff', icon: 'fa-music', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'tashas_hideous_laughter', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'prone', label: 'Prone', dc: laughterDc, ability: 'wis' }) : undefined, tooltip: `Tasha's Hideous Laughter from ${ctx.te.source || 'unknown'}: Prone and Incapacitated. Click to reroll the WIS save (DC ${laughterDc}); a success ends the spell.` }
}

function buildMazeBadge(ctx) {
    const mazeDc = ctx.te.dc || 20
    return { label: 'Mazed', cls: 'effect-debuff', icon: 'fa-dungeon', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'maze', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'incapacitated', label: 'Incapacitated', dc: mazeDc, ability: 'int' }) : undefined, tooltip: `Mazed by ${ctx.te.source || 'unknown'}: Incapacitated in a labyrinthine demiplane. No one can attack or be attacked. Click to attempt a DC ${mazeDc} INT (Investigation) check to escape.` }
}

function buildConfusionBadge(ctx) {
    const confusionDc = ctx.te.dc || 0
    return { label: 'Confused', cls: 'effect-debuff', icon: 'fa-circle-notch', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'confusion', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'confused', label: 'Confused', dc: confusionDc, ability: 'wis' }) : undefined, tooltip: `Confused by ${ctx.te.source || 'unknown'}: can't take Bonus Actions or Reactions. At start of turn rolls 1d10 behavior (1: move random direction; 2-6: does nothing; 7-8: Attack action vs random creature within reach; 9-10: chooses behavior). End of turn, repeats WIS save (DC ${confusionDc}); success ends the spell. Click to roll the WIS save.` }
}

function buildForcecageBadge(ctx) {
    const forcecageDc = ctx.te.dc || 0
    return { label: 'Forcecaged', cls: 'effect-debuff', icon: 'fa-dungeon', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'forcecage', onClick: ctx.onRollConditionSave ? () => ctx.onRollConditionSave(ctx.creatureName, { key: 'forcecaged', label: 'Forcecaged', dc: forcecageDc, ability: 'cha' }) : undefined, tooltip: `Trapped in a Forcecage from ${ctx.te.source || 'unknown'}: can't leave by nonmagical means, and no attack, spell, or effect can pass between inside and outside the prison. Click to attempt a CHA save (DC ${forcecageDc}); on success the creature can use teleportation or interplanar travel to exit.` }
}

const BADGE_SPECS = [
    {
        guard: ctx => ctx.creatureName && ctx.campaignName && (getRuntimeValue(ctx.creatureName, 'stealthAttackCost', ctx.campaignName) ?? 0) > 0,
        build: () => ({ label: 'Stealth Attack', cls: 'effect-neutral', icon: 'fa-eye-slash', removable: true, removeAction: 'stealth_attack' }),
    },
    {
        guard: ctx => ctx.effects.speedReduction,
        build: ctx => ({ label: ctx.effects.speedReduction >= 1000 ? 'Speed 0' : `Speed -${ctx.effects.speedReduction}`, cls: 'effect-debuff', icon: 'fa-minus', removable: true, removeAction: 'target_effect', effectType: 'speed_reduction' }),
    },
    {
        guard: ctx => ctx.effects.noAdvantageAgainst,
        build: () => ({ label: 'No Adv vs', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'remove_derived', effectTypes: ['blur', 'foresight', 'escape_the_horde', 'protection', 'multiattack_defense'] }),
    },
    {
        guard: ctx => ctx.effects.targetDisadvantageCount > 0 && !ctx.effects.noAdvantageAgainst,
        build: () => ({ label: 'Disadv vs', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'remove_derived', effectTypes: ['blur', 'foresight', 'escape_the_horde', 'protection', 'multiattack_defense', 'clairvoyant_combatant'] }),
    },
    {
        guard: ctx => ctx.effects.targetAttackDisadvantageCount > 0,
        build: () => ({ label: 'Attack Disadv', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'target_effect', effectType: 'slasher_enhanced_critical' }),
    },
    {
        guard: ctx => ctx.effects.attackAdvantageCount > 0,
        build: buildAttackAdvantageBadge,
    },
    {
        guard: ctx => ctx.effects.targetAdvantageCount > 0,
        build: buildTargetAdvantageBadge,
    },
    {
        guard: ctx => ctx.effects.saveAdvantageCount > 0,
        build: buildSaveAdvantageBadge,
    },
    {
        guard: ctx => ctx.effects.dexSaveAdvantageCount > 0,
        build: () => ({ label: 'Adv DEX Save', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'remove_derived', effectTypes: ['dodge'], tooltip: 'Advantage on Dexterity saving throws' }),
    },
    {
        guard: ctx => ctx.effects.riderSaveDisadvantage,
        build: () => ({ label: 'Save Disadv', cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'disadvantage_on_next_save' }),
    },
    {
        guard: ctx => ctx.effects.saveDisadvantageCount > 0,
        build: buildSaveDisadvBadge,
    },
    {
        guard: ctx => ctx.effects.abilityCheckDisadvantageAbilities?.length > 0,
        build: buildAbilityCheckDisadvBadge,
    },
    {
        guard: ctx => ctx.effects.abilityCheckAdvantageAbilities?.length > 0,
        build: buildAbilityCheckAdvantageBadge,
    },
    {
        guard: ctx => ctx.effects.abilityCheckAdvantage && !ctx.effects.abilityCheckAdvantageAbilities,
        build: buildAbilityCheckAdvantageAllBadge,
    },
    {
        guard: ctx => ctx.effects.riderAttackBonus > 0,
        build: ctx => ({ label: `+${ctx.effects.riderAttackBonus} to hit`, cls: 'effect-debuff', icon: 'fa-bullseye', removable: true, removeAction: 'target_effect', effectType: 'next_attack_bonus' }),
    },
    {
        guard: ctx => ctx.effects.riderCannotOpportunityAttack,
        build: buildNoOABadge,
    },
    {
        // CLA-353: the tactical_shift_no_oa passive is always-on for lv5+ 2024 Fighters —
        // it must NOT light this badge. Tactical Shift protection renders via the
        // no_opportunity_attacks te badge written at Second Wind activation.
        guard: ctx => ctx.creatureName && ctx.campaignName && getRuntimeValue(ctx.creatureName, 'inspiringMovementNoOA', ctx.campaignName),
        build: () => ({ label: 'Insp. Move', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'inspiring_move' }),
    },
    {
        guard: ctx => ctx.creatureName && ctx.campaignName && getRuntimeValue(ctx.creatureName, 'maneuveringStepNoOA', ctx.campaignName),
        build: ctx => ({ label: 'Mnv. Move', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'maneuvering_move', tooltip: `Can move up to half their Speed as a Reaction without provoking Opportunity Attacks from ${getRuntimeValue(ctx.creatureName, 'maneuveringStepNoOASource', ctx.campaignName) || 'the attacker'}` }),
    },
    {
        guard: ctx => {
            const remarkableNoOA = getRuntimeValue(ctx.creatureName, 'remarkableAthleteNoOA', ctx.campaignName)
            return ctx.creatureName && ctx.campaignName && remarkableNoOA
        },
        build: () => ({ label: 'No OA (Crit)', cls: 'effect-buff', icon: 'fa-ban', removable: true, removeAction: 'remarkable_no_oa' }),
    },
    {
        guard: ctx => ctx.hasSpeedyOpportunityDisadvantage,
        build: () => ({ label: 'OA Disadv', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'oa_disadv' }),
    },
    {
        guard: ctx => ctx.hasSpeedyDifficultTerrainIgnore,
        build: () => ({ label: 'No Difficult Terrain on Dash', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'difficult_terrain_ignore' }),
    },
    {
        guard: ctx => ctx.coronaDisadvantage,
        build: () => ({ label: 'Disadv Fire/Radiant', cls: 'effect-debuff', icon: 'fa-sun', removable: true, removeAction: 'corona_disadvantage' }),
    },
    {
        find: ctx => findResolved(ctx, 'disadvantage_next_attack'),
        build: buildDisadvNextAttackBadge,
    },
    {
        find: ctx => findResolved(ctx, 'disadvantage_perception_checks'),
        build: buildPerceptionDisadvBadge,
    },
    {
        find: ctx => findDirect(ctx, 'taunting_step'),
        build: ctx => ({ label: 'Taunted', cls: 'effect-debuff', icon: 'fa-wand-sparkles', removable: true, removeAction: 'taunting_step', effectType: 'taunting_step', tooltip: `Disadvantage on attack rolls vs creatures other than ${ctx.te.source || 'you'}` }),
    },
    {
        find: ctx => findDirect(ctx, 'compelled_duel'),
        build: ctx => ({ label: 'Compelled Duel', cls: 'effect-debuff', icon: 'fa-hand-fist', removable: true, removeAction: 'target_effect', effectType: 'compelled_duel', tooltip: `Disadvantage on attack rolls vs creatures other than ${ctx.te.source || 'you'} (Concentration, up to 1 minute)` }),
    },
    {
        find: ctx => findDirect(ctx, 'sanctuary'),
        build: ctx => ({ label: 'Sanctuary', cls: 'effect-buff', icon: 'fa-shield-halved', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'sanctuary', tooltip: `Sanctuary from ${ctx.te.source || 'unknown'}: Creatures targeting this creature with attack rolls or damaging spells must succeed on a WIS save or lose the attack/spell. Does not protect from areas of effect. Spell ends if the warded creature attacks, casts a spell, or deals damage.` }),
    },
    {
        find: ctx => findDirect(ctx, 'bane_penalty'),
        guard: ctx => ctx.effects.banePenalty,
        build: buildBaneBadge,
    },
    {
        find: ctx => findDirect(ctx, 'ray_of_enfeeble_debuff'),
        guard: ctx => ctx.effects.rayOfEnfeebleDamageReduction,
        build: buildEnfeebleBadge,
    },
    {
        find: ctx => findDirect(ctx, 'resistance_damage_reduction'),
        guard: ctx => ctx.effects.resistanceDamageReduction,
        build: ctx => ({ label: 'Resistance', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'resistance_damage_reduction', tooltip: `Resistance from ${ctx.te?.source || 'unknown'}: reduces ${ctx.te?.chosenType || 'unknown'} damage by 1d4 (once per turn)` }),
    },
    {
        find: ctx => findDirect(ctx, 'bless_bonus'),
        guard: ctx => ctx.effects.blessBonus,
        build: ctx => ({ label: 'Bless', cls: 'effect-buff', icon: 'fa-hands', removable: true, removeAction: 'target_effect', effectType: 'bless_bonus', tooltip: `Bless from ${ctx.te?.source || 'unknown'}: +1d4 on attack rolls and saving throws` }),
    },
    {
        find: ctx => findDirect(ctx, 'beacon_of_hope'),
        guard: ctx => ctx.effects.beaconOfHope,
        build: ctx => ({ label: 'Beacon of Hope', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: true, removeAction: 'target_effect', effectType: 'beacon_of_hope', tooltip: `Beacon of Hope from ${ctx.te?.source || 'unknown'}: Advantage on WIS saves, death saves, and maximized healing` }),
    },
    {
        guard: ctx => ctx.effects.hasteActive,
        build: () => ({ label: 'Hasted', cls: 'effect-buff', icon: 'fa-bolt', removable: true, removeAction: 'remove_haste', tooltip: 'Haste: Speed doubled, +2 AC, Advantage on DEX saves, Extra action (Attack, Dash, Disengage, Hide, Use Object)' }),
    },
    {
        guard: ctx => ctx.effects.barkskinActive,
        build: () => ({ label: 'Barkskin', cls: 'effect-buff', icon: 'fa-tree', removable: true, removeAction: 'remove_barkskin', tooltip: 'Barkskin: AC set to 17' }),
    },
    {
        find: ctx => findDirect(ctx, 'silenced'),
        build: ctx => ({ label: 'Silenced', cls: 'effect-debuff', icon: 'fa-volume-xmark', removable: true, removeAction: 'target_effect', effectType: 'silenced', tooltip: `Silenced by ${ctx.te.source || 'unknown'} — Deafened, cannot cast spells with Verbal components` }),
    },
    {
        find: ctx => findDirect(ctx, 'globe_barrier'),
        build: ctx => ({ label: 'Globe of Invulnerability', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'globe_barrier', tooltip: `Protected by Globe of Invulnerability from ${ctx.te.source || 'unknown'} — spells of 5th level or lower blocked` }),
    },
    {
        find: ctx => findDirect(ctx, 'antimagic_field'),
        build: ctx => ({ label: 'Antimagic Field', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'antimagic_field', tooltip: `Affected by Antimagic Field from ${ctx.te.source || 'unknown'} — only weapon attacks allowed` }),
    },
    {
        find: ctx => findDirect(ctx, 'regenerate'),
        build: ctx => ({ label: 'Regenerate', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'regenerate', tooltip: `Regenerate from ${ctx.te.source || 'unknown'}: 4d8+15 initial heal, 1 HP per turn, full HP on expiration` }),
    },
    {
        find: ctx => findDirect(ctx, 'aura_of_life'),
        build: ctx => ({ label: 'Aura of Life', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'aura_of_life', tooltip: `Aura of Life from ${ctx.te.source || 'unknown'}: Resistance to Necrotic damage, HP maximum can't be reduced, Regains 1 HP at start of turn if at 0 HP` }),
    },
    {
        find: ctx => findDirect(ctx, 'aura_of_purity'),
        build: ctx => ({ label: 'Aura of Purity', cls: 'effect-buff', icon: 'fa-shield-halved', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'aura_of_purity', tooltip: `Aura of Purity from ${ctx.te.source || 'unknown'}: Resistance to Poison damage, Advantage on saves vs Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, Stunned` }),
    },
    {
        find: ctx => findDirect(ctx, 'circle_of_power'),
        build: ctx => ({ label: 'Circle of Power', cls: 'effect-buff', icon: 'fa-shield-halved', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'circle_of_power', tooltip: `Circle of Power from ${ctx.te.source || 'unknown'}: Advantage on saving throws, no damage on successful save vs half-damage effects` }),
    },
    {
        find: ctx => findDirect(ctx, 'pass_without_trace_bonus'),
        build: buildPassWithoutTraceBadge,
    },
    {
        find: ctx => findDirect(ctx, 'heroism'),
        build: ctx => ({ label: 'Heroism', cls: 'effect-buff', icon: 'fa-dragon', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'heroism', tooltip: `Heroism from ${ctx.te.source || 'unknown'}: Immune to Frightened, gains temp HP at start of each turn (Concentration, up to 1 minute)` }),
    },
    {
        find: ctx => findDirect(ctx, 'holy_aura'),
        build: ctx => ({ label: 'Holy Aura', cls: 'effect-buff', icon: 'fa-sun', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'holy_aura', tooltip: `Holy Aura from ${ctx.te.source || 'unknown'}: Advantage on saving throws, other creatures have Disadvantage on attack rolls against you. Fiends/Undead that hit an affected creature must succeed on CON save or be Blinded` }),
    },
    {
        // Warding Bond: from activeBuffs (not targetEffects)
        find: ctx => ctx.activeBuffs.find(b => b.effect === 'warding_bond'),
        build: ctx => ({ label: 'Warding Bond', cls: 'effect-buff', icon: 'fa-ring', removable: ctx.isLocalhost, removeAction: 'remove_buff', tooltip: `Warding Bond from ${ctx.te.sourceCharacter || 'unknown'}: AC +1, saves +1, resistance to all damage. Caster takes same damage.` }),
    },
    {
        find: ctx => findResolved(ctx, 'protection_from_evil_and_good'),
        build: ctx => ({ label: 'Protection from Evil and Good', cls: 'effect-buff', icon: 'fa-shield-halved', removable: ctx.isLocalhost, removeAction: 'remove_pfeag', effectType: 'protection_from_evil_and_good', tooltip: `Protection from Evil and Good from ${ctx.te.source || 'unknown'}: Aberrations, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attack rolls against target. Target can't gain Charmed or Frightened conditions from those types.` }),
    },
    {
        find: ctx => findResolved(ctx, 'protection_from_poison'),
        build: buildProtectionFromPoisonBadge,
    },
    {
        find: ctx => findDirect(ctx, 'ottos_irresistible_dance'),
        build: buildOttoDanceBadge,
    },
    {
        find: ctx => findDirect(ctx, 'tashas_hideous_laughter'),
        build: buildTashasLaughterBadge,
    },
    {
        find: ctx => findDirect(ctx, 'banishment'),
        build: ctx => ({ label: 'Banished', cls: 'effect-debuff', icon: 'fa-door-open', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'banishment', tooltip: `Banished by ${ctx.te.source || 'unknown'}: Incapacitated in demiplane. ${ctx.te.permanent ? 'Permanent banishment - target will not return.' : 'Concentration, up to 1 minute.'}` }),
    },
    {
        find: ctx => findDirect(ctx, 'maze'),
        build: buildMazeBadge,
    },
    {
        find: ctx => findDirect(ctx, 'imprisonment'),
        build: ctx => ({ label: 'Imprisoned', cls: 'effect-debuff', icon: 'fa-dungeon', removable: ctx.isLocalhost, removeAction: 'target_effect', effectType: 'imprisonment', tooltip: `Imprisoned by ${ctx.te.source || 'unknown'}: ${ctx.te.prisonType || 'Slumber'}. ${ctx.te.duration || 'Until dispelled'}` }),
    },
    {
        find: ctx => findDirect(ctx, 'confusion'),
        build: buildConfusionBadge,
    },
    {
        find: ctx => findResolved(ctx, 'forcecage'),
        build: buildForcecageBadge,
    },
]

const BUFF_EFFECT_HANDLERS = {
    advantage_attacks_and_saves: (effects, buff) => {
        effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
        effects.attackAdvantageReasons.push(buff.name)
        effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1
        effects.saveAdvantageReasons.push(buff.name)
    },
    vow_of_enmity: (effects, buff) => {
        effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
        effects.attackAdvantageReasons.push(buff.name)
    },
    dodge: (effects) => {
        effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1
        effects.dexSaveAdvantageCount = (effects.dexSaveAdvantageCount || 0) + 1
    },
    clairvoyant_combatant: (effects) => {
        effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
        effects.attackAdvantageReasons.push('Clairvoyant Combatant')
    },
    haste: (effects) => { effects.hasteActive = true },
    barkskin: (effects) => { effects.barkskinActive = true },
}

function applyActiveBuffs(effects, activeBuffs) {
    if (!Array.isArray(activeBuffs)) return
    for (const buff of activeBuffs) {
        const handler = BUFF_EFFECT_HANDLERS[buff.effect]
        if (handler) handler(effects, buff)
    }
}

function applyVowOfEnmity(effects, allCreatures, creatureName, campaignName) {
    if (!allCreatures?.length || !campaignName) return
    const hasVow = allCreatures.some(c => getRuntimeValue(c.name, 'vowOfEnmityTarget', campaignName) === creatureName)
    if (!hasVow) return
    effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
    effects.attackAdvantageReasons.push('Vow of Enmity')
}

function dedupeByLabel(badges) {
    const seenLabels = new Set()
    return badges.filter(b => {
        if (seenLabels.has(b.label)) return false
        seenLabels.add(b.label)
        return true
    })
}

const REMOVE_HANDLERS = {
    condition: (badge, ctx) => removeConditionByKey(ctx.creatureName, badge.removeKey, ctx.campaignName),
    target_effect: (badge, ctx) => removeTargetEffect(ctx.creatureName, badge.effectType, ctx.campaignName),
    taunting_step: (badge, ctx) => removeTargetEffect(ctx.creatureName, badge.effectType, ctx.campaignName),
    remove_pfeag: (badge, ctx) => {
        removeTargetEffect(ctx.creatureName, 'protection_from_evil_and_good', ctx.campaignName)
        const buffs = getRuntimeValue(ctx.creatureName, 'activeBuffs', ctx.campaignName) || []
        const filteredBuffs = buffs.filter(b => !(b.name === 'Protection from Evil and Good' && b.effect === 'protection_from_evil_and_good'))
        setRuntimeValue(ctx.creatureName, 'activeBuffs', filteredBuffs, ctx.campaignName)
        setRuntimeValue(ctx.creatureName, 'protectionFromEvilAndGoodWardedTypes', [], ctx.campaignName)
    },
    remove_derived: (badge, ctx) => {
        if (badge.effectTypes?.length > 0) removeTargetEffectsByTypes(ctx.creatureName, badge.effectTypes, ctx.campaignName)
    },
    remove_haste: (badge, ctx) => {
        removeTargetEffectsByTypes(ctx.creatureName, ['haste'], ctx.campaignName)
        removeBuffsByTypes(ctx.creatureName, ['haste'], ctx.campaignName)
    },
    remove_barkskin: (badge, ctx) => {
        removeTargetEffectsByTypes(ctx.creatureName, ['barkskin'], ctx.campaignName)
        removeBuffsByTypes(ctx.creatureName, ['barkskin'], ctx.campaignName)
    },
    inspiring_move: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'inspiringMovementNoOA', false, ctx.campaignName),
    maneuvering_move: (badge, ctx) => {
        setRuntimeValue(ctx.creatureName, 'maneuveringStepGranted', null, ctx.campaignName)
        setRuntimeValue(ctx.creatureName, 'maneuveringStepNoOA', null, ctx.campaignName)
        setRuntimeValue(ctx.creatureName, 'maneuveringStepNoOASource', null, ctx.campaignName)
    },
    remarkable_no_oa: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'remarkableAthleteNoOA', false, ctx.campaignName),
    oa_disadv: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'hasSpeedyOpportunityDisadvantage', false, ctx.campaignName),
    difficult_terrain_ignore: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'hasSpeedyDifficultTerrainIgnore', false, ctx.campaignName),
    corona_disadvantage: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'coronaDisadvantage', false, ctx.campaignName),
    stealth_attack: (badge, ctx) => setRuntimeValue(ctx.creatureName, 'stealthAttackCost', 0, ctx.campaignName),
    vow_of_enmity: (badge, ctx) => {
        const vowCreature = ctx.allCreatures?.find(c => getRuntimeValue(c.name, 'vowOfEnmityTarget', ctx.campaignName) === ctx.creatureName)
        if (vowCreature) setRuntimeValue(vowCreature.name, 'vowOfEnmityTarget', null, ctx.campaignName)
    },
    remove_buff: (badge, ctx) => {
        const buffs = getRuntimeValue(ctx.creatureName, 'activeBuffs', ctx.campaignName) || []
        const filtered = buffs.filter(b => b.effect !== 'advantage_attacks_and_saves' && b.effect !== 'vow_of_enmity' && b.effect !== 'dodge' && b.effect !== 'haste' && b.effect !== 'warding_bond')
        setRuntimeValue(ctx.creatureName, 'activeBuffs', filtered, ctx.campaignName)
    },
}

function removeBadgeEffect(badge, ctx) {
    const handler = REMOVE_HANDLERS[badge.removeAction]
    if (handler) handler(badge, ctx)
}

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, allCreatures, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, isLocalhost, coronaDisadvantage, playerStats: _playerStats, characters: _characters, activeMapName: _activeMapName, onRollConditionSave }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects({ conditions: condKeys, saveModifiers: [], targetEffects })
    const activeBuffs = creatureName && campaignName ? (getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []) : []
    applyActiveBuffs(effects, activeBuffs)
    // Check if any creature has Vow of Enmity against this creature
    applyVowOfEnmity(effects, allCreatures, creatureName, campaignName)

    const safeBuffs = Array.isArray(activeBuffs) ? activeBuffs : []
    const ctx = {
        effects,
        targetEffects,
        creatureName,
        campaignName,
        isLocalhost,
        onRollConditionSave,
        allCreatures,
        activeBuffs: safeBuffs,
        hasVowBuff: safeBuffs.some(b => b.effect === 'vow_of_enmity'),
        hasAdvAndSavesBuff: safeBuffs.some(b => b.effect === 'advantage_attacks_and_saves'),
        hasSpeedyOpportunityDisadvantage,
        hasSpeedyDifficultTerrainIgnore,
        coronaDisadvantage,
    }

    const badges = []
    for (const spec of BADGE_SPECS) {
        ctx.te = spec.find ? spec.find(ctx) : undefined
        if (!(spec.guard ? spec.guard(ctx) : ctx.te)) continue
        badges.push(spec.build(ctx))
    }

    const uniqueBadges = dedupeByLabel(badges)

    return (
        <>
            {uniqueBadges.map((b, i) => (
                <CreatureBadge
                    key={`${b.label}-${i}`}
                    icon={b.icon}
                    label={b.label}
                    cls={resolveCls(b.cls)}
                    tooltip={b.tooltip || getEffectDescription(b.label)}
                    removable={isLocalhost && b.removable}
                    onRemove={() => removeBadgeEffect(b, ctx)}
                    onClick={b.onClick}
                    disabled={b.disabled}
                />
            ))}
        </>
    )
}

export default ConditionEffectBadges
