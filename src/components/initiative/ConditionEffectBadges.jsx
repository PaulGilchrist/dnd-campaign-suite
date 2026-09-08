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

function pushStealthAttackBadge(badges, creatureName, campaignName) {
    if (creatureName && campaignName && (getRuntimeValue(creatureName, 'stealthAttackCost', campaignName) ?? 0) > 0) {
        badges.push({ label: 'Stealth Attack', cls: 'effect-neutral', icon: 'fa-eye-slash', removable: true, removeAction: 'stealth_attack' })
    }
}

function pushDisadvNextAttackBadge(badges, targetEffects, creatureName) {
    const effect = (targetEffects || []).find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target
        return te.effect === 'disadvantage_next_attack' && teTarget === creatureName
    })
    if (!effect) return
    const def = getEffectDefinition('disadvantage_next_attack')
    badges.push({ label: def.label, cls: 'effect-debuff', icon: def.icon, removable: true, removeAction: 'target_effect', effectType: 'disadvantage_next_attack', tooltip: `Disadvantage on its next attack roll (from ${effect.source || 'unknown'})` })
}

function pushPassWithoutTraceBadge(badges, targetEffects, creatureName, isLocalhost) {
    const pwtEffect = (targetEffects || []).find(te => te.effect === 'pass_without_trace_bonus' && te.target === creatureName)
    if (!pwtEffect) return
    const casterName = pwtEffect.source || 'unknown'
    const pwtDef = getEffectDefinition('pass_without_trace_bonus')
    badges.push({ label: pwtDef.label, cls: 'effect-buff', icon: pwtDef.icon, removable: isLocalhost, removeAction: 'target_effect', effectType: 'pass_without_trace_bonus', tooltip: `Pass Without Trace from ${casterName}: +10 bonus to Dexterity (Stealth) checks and leaves no tracks (Concentration, up to 1 hour)` })
}

function pushPerceptionDisadvBadge(badges, targetEffects, creatureName) {
    const effect = (targetEffects || []).find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target
        return te.effect === 'disadvantage_perception_checks' && teTarget === creatureName
    })
    if (!effect) return
    const def = getEffectDefinition('disadvantage_perception_checks')
    badges.push({ label: def.label, cls: 'effect-debuff', icon: def.icon, removable: true, removeAction: 'target_effect', effectType: 'disadvantage_perception_checks', tooltip: `Disadvantage on Wisdom (Perception) checks (from ${effect.source || 'unknown'})` })
}

function pushNoOATeBadge(badges, targetEffects) {
    const noOASources = [...new Set(targetEffects.filter(te => te.effect === 'no_opportunity_attacks' && te.source).map(te => te.source))]
    badges.push({ label: 'No OA', cls: 'effect-debuff', icon: 'fa-ban', removable: true, removeAction: 'target_effect', effectType: 'no_opportunity_attacks', tooltip: noOASources.length > 0 ? `No Opportunity Attacks (from ${noOASources.join(', ')})` : undefined })
}

function pushNoOAMoveBadges(badges, creatureName, campaignName) {
    if (!creatureName || !campaignName) return
    // CLA-353: the tactical_shift_no_oa passive is always-on for lv5+ 2024 Fighters —
    // it must NOT light this badge. Tactical Shift protection renders via the
    // no_opportunity_attacks te badge written at Second Wind activation.
    const noOA = getRuntimeValue(creatureName, 'inspiringMovementNoOA', campaignName)
    if (noOA) {
        badges.push({ label: 'Insp. Move', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'inspiring_move' })
    }
    pushManeuveringMoveBadge(badges, creatureName, campaignName)
}

function pushManeuveringMoveBadge(badges, creatureName, campaignName) {
    if (!creatureName || !campaignName) return
    if (!getRuntimeValue(creatureName, 'maneuveringStepNoOA', campaignName)) return
    const maneuveringSource = getRuntimeValue(creatureName, 'maneuveringStepNoOASource', campaignName) || 'the attacker'
    badges.push({ label: 'Mnv. Move', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'maneuvering_move', tooltip: `Can move up to half their Speed as a Reaction without provoking Opportunity Attacks from ${maneuveringSource}` })
}

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, allCreatures, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, isLocalhost, coronaDisadvantage, playerStats: _playerStats, characters: _characters, activeMapName: _activeMapName, onRollConditionSave }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects, false, false, false, false, null, false, false, false, false, false, false, false, false, false, false, false, false)
    const activeBuffs = creatureName && campaignName ? (getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []) : []
    if (Array.isArray(activeBuffs)) {
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_and_saves') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push(buff.name)
                effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1
                effects.saveAdvantageReasons.push(buff.name)
            }
            if (buff.effect === 'vow_of_enmity') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push(buff.name)
            }
            if (buff.effect === 'dodge') {
                effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1
                effects.dexSaveAdvantageCount = (effects.dexSaveAdvantageCount || 0) + 1
            }
            if (buff.effect === 'clairvoyant_combatant') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push('Clairvoyant Combatant')
            }
            if (buff.effect === 'haste') {
                effects.hasteActive = true
            }
            if (buff.effect === 'barkskin') {
                effects.barkskinActive = true
            }
        }
    }
    const badges = []
    // Check if any creature has Vow of Enmity against this creature
    if (allCreatures?.length && campaignName) {
        const hasVow = allCreatures.some(c => {
            const vowTarget = getRuntimeValue(c.name, 'vowOfEnmityTarget', campaignName);
            return vowTarget === creatureName;
        });
        if (hasVow) {
            effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
            effects.attackAdvantageReasons.push('Vow of Enmity')
        }
    }

    // Pre-scan for derived badge removal: find which buffs contribute
    const safeBuffs = Array.isArray(activeBuffs) ? activeBuffs : []
    const hasVowBuff = safeBuffs.some(b => b.effect === 'vow_of_enmity')
    const hasAdvAndSavesBuff = safeBuffs.some(b => b.effect === 'advantage_attacks_and_saves')

    pushStealthAttackBadge(badges, creatureName, campaignName)
    if (effects.speedReduction) {
        const label = effects.speedReduction >= 1000 ? 'Speed 0' : `Speed -${effects.speedReduction}`
        badges.push({ label, cls: 'effect-debuff', icon: 'fa-minus', removable: true, removeAction: 'target_effect', effectType: 'speed_reduction' })
    }
    if (effects.noAdvantageAgainst) {
        badges.push({ label: 'No Adv vs', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'remove_derived', effectTypes: ['blur', 'foresight', 'escape_the_horde', 'protection', 'multiattack_defense'] })
    }
    if (effects.targetDisadvantageCount > 0 && !effects.noAdvantageAgainst) {
        badges.push({ label: 'Disadv vs', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'remove_derived', effectTypes: ['blur', 'foresight', 'escape_the_horde', 'protection', 'multiattack_defense', 'clairvoyant_combatant'] })
    }
    if (effects.targetAttackDisadvantageCount > 0) {
        badges.push({ label: 'Attack Disadv', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'target_effect', effectType: 'slasher_enhanced_critical' })
    }
    if (effects.attackAdvantageCount > 0) {
        const reasons = effects.attackAdvantageReasons || []
        const reasonText = reasons.length > 0 ? reasons.join(', ') : ''
        const teTypes = ['advantage_attacks', 'foresight', 'next_attack_advantage', 'clairvoyant_combatant']
        const buffTypes = []
        if (hasVowBuff || reasons.includes('Vow of Enmity')) buffTypes.push('vow_of_enmity')
        if (hasAdvAndSavesBuff || reasons.includes('Zealous Presence')) buffTypes.push('advantage_attacks_and_saves')
        badges.push({ label: 'Adv', cls: 'effect-buff', icon: 'fa-arrow-up', removable: true, removeAction: 'remove_derived', effectTypes: [...teTypes, ...buffTypes], tooltip: `Advantage on attack rolls${reasonText ? ' (' + reasonText + ')' : ''}` })
    }
    if (effects.targetAdvantageCount > 0) {
        const reasons = effects.targetAdvantageReasons || []
        const reasonText = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
        const teTypes = ['reckless_attack', 'clairvoyant_combatant', 'crusher_enhanced_critical', 'distracting_strike_advantage', 'faerie_fire']
        badges.push({ label: 'Adv vs', cls: 'effect-debuff', icon: 'fa-arrow-up', removable: true, removeAction: 'remove_derived', effectTypes: teTypes, tooltip: `Attackers have advantage on attack rolls against this creature${reasonText}` })
    }
    if (effects.saveAdvantageCount > 0) {
        const reasons = (effects.saveAdvantageReasons || []).length > 0 ? effects.saveAdvantageReasons.join(', ') : 'Advantage on saving throws'
        const teTypes = ['advantage_saves', 'foresight']
        const buffTypes = []
        if (hasAdvAndSavesBuff || reasons.includes('Zealous Presence')) buffTypes.push('advantage_attacks_and_saves')
        if (reasons.includes('Vow of Enmity')) buffTypes.push('vow_of_enmity')
        badges.push({ label: 'Adv Save', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'remove_derived', effectTypes: [...teTypes, ...buffTypes], tooltip: `Advantage on saving throws${reasons !== 'Advantage on saving throws' ? ' (' + reasons + ')' : ''}` })
    }
    if (effects.dexSaveAdvantageCount > 0) {
        badges.push({ label: 'Adv DEX Save', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'remove_derived', effectTypes: ['dodge'], tooltip: 'Advantage on Dexterity saving throws' })
    }
    if (effects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'disadvantage_on_next_save' })
    if (effects.saveDisadvantageCount > 0) {
      const reasons = (effects.saveDisadvantage || []).length > 0 ? ` (${effects.saveDisadvantage.join(', ')})` : ''
      badges.push({ label: `Save Disadv${reasons}`, cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'hex_save_disadvantage' })
    }
    if (effects.abilityCheckDisadvantageAbilities?.length > 0) {
      const abilityNames = effects.abilityCheckDisadvantageAbilities.map(a => a.substring(0, 3).toLowerCase()).join(', ')
      badges.push({ label: `Check Disadv (${abilityNames})`, cls: 'effect-debuff', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'hex_ability_check_disadvantage' })
    }
    if (effects.abilityCheckAdvantageAbilities?.length > 0) {
      const abilityNames = effects.abilityCheckAdvantageAbilities.map(a => a.substring(0, 3).toLowerCase()).join(', ')
      badges.push({ label: `Adv Check (${abilityNames})`, cls: 'effect-buff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'enhance_ability' })
    }
    if (effects.abilityCheckAdvantage && !effects.abilityCheckAdvantageAbilities) {
      const reasons = effects.abilityCheckAdvantageReasons || []
      const reasonText = reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
      badges.push({ label: 'Adv Check', cls: 'effect-buff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'advantage_abilities', tooltip: `Advantage on all ability checks${reasonText ? ' (' + reasonText + ')' : ''}` })
    }
    if (effects.riderAttackBonus > 0) badges.push({ label: `+${effects.riderAttackBonus} to hit`, cls: 'effect-debuff', icon: 'fa-bullseye', removable: true, removeAction: 'target_effect', effectType: 'next_attack_bonus' })
    if (effects.riderCannotOpportunityAttack) pushNoOATeBadge(badges, targetEffects)
    pushNoOAMoveBadges(badges, creatureName, campaignName)
    const remarkableNoOA = getRuntimeValue(creatureName, 'remarkableAthleteNoOA', campaignName)
    if (creatureName && campaignName && remarkableNoOA) {
        badges.push({ label: 'No OA (Crit)', cls: 'effect-buff', icon: 'fa-ban', removable: true, removeAction: 'remarkable_no_oa' })
    }
    if (hasSpeedyOpportunityDisadvantage) {
        badges.push({ label: 'OA Disadv', cls: 'effect-buff', icon: 'fa-arrow-down', removable: true, removeAction: 'oa_disadv' })
    }
    if (hasSpeedyDifficultTerrainIgnore) {
        badges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-buff', icon: 'fa-person-walking', removable: true, removeAction: 'difficult_terrain_ignore' })
    }
    if (coronaDisadvantage) {
        badges.push({ label: 'Disadv Fire/Radiant', cls: 'effect-debuff', icon: 'fa-sun', removable: true, removeAction: 'corona_disadvantage' })
    }
    pushDisadvNextAttackBadge(badges, targetEffects, creatureName)
    pushPerceptionDisadvBadge(badges, targetEffects, creatureName)
    const tauntingStepEffect = targetEffects?.find(te => te.effect === 'taunting_step' && te.target === creatureName)
    if (tauntingStepEffect) {
        badges.push({ label: 'Taunted', cls: 'effect-debuff', icon: 'fa-wand-sparkles', removable: true, removeAction: 'taunting_step', effectType: 'taunting_step', tooltip: `Disadvantage on attack rolls vs creatures other than ${tauntingStepEffect.source || 'you'}` })
    }
    const compelledDuelEffect = targetEffects?.find(te => te.effect === 'compelled_duel' && te.target === creatureName)
    if (compelledDuelEffect) {
        badges.push({ label: 'Compelled Duel', cls: 'effect-debuff', icon: 'fa-hand-fist', removable: true, removeAction: 'target_effect', effectType: 'compelled_duel', tooltip: `Disadvantage on attack rolls vs creatures other than ${compelledDuelEffect.source || 'you'} (Concentration, up to 1 minute)` })
    }
    const sanctuaryEffect = targetEffects?.find(te => te.effect === 'sanctuary' && te.target === creatureName)
    if (sanctuaryEffect) {
        const casterName = sanctuaryEffect.source || 'unknown'
        badges.push({ label: 'Sanctuary', cls: 'effect-buff', icon: 'fa-shield-halved', removable: isLocalhost, removeAction: 'target_effect', effectType: 'sanctuary', tooltip: `Sanctuary from ${casterName}: Creatures targeting this creature with attack rolls or damaging spells must succeed on a WIS save or lose the attack/spell. Does not protect from areas of effect. Spell ends if the warded creature attacks, casts a spell, or deals damage.` })
    }
    if (effects.banePenalty) {
        const baneEffect = targetEffects?.find(te => te.effect === 'bane_penalty' && te.target === creatureName)
        const casterName = baneEffect?.source || 'unknown'
        const displayLabel = baneEffect?.displayLabel || 'Bane'
        const isSelf = casterName === creatureName
        badges.push({ label: displayLabel, cls: isSelf ? 'effect-buff' : 'effect-debuff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'bane_penalty', tooltip: `${displayLabel} from ${casterName}: -1d4 on attack rolls and saving throws` })
    }
    if (effects.rayOfEnfeebleDamageReduction) {
        const rayEffect = targetEffects?.find(te => te.effect === 'ray_of_enfeeble_debuff' && te.target === creatureName)
        const casterName = rayEffect?.source || 'unknown'
        const rayDc = rayEffect?.dc || 0
        badges.push({ label: 'Enfeeblement', cls: 'effect-debuff', icon: 'fa-hand', removable: true, removeAction: 'target_effect', effectType: 'ray_of_enfeeble_debuff', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: rayDc, ability: 'con' }) : undefined, tooltip: `Ray of Enfeeblement from ${casterName}: -1d8 to damage rolls, Disadvantage on STR checks. Click to reroll the CON save (DC ${rayDc}); a success ends the spell.` })
    }
    if (effects.resistanceDamageReduction) {
        const resEffect = targetEffects?.find(te => te.effect === 'resistance_damage_reduction' && te.target === creatureName)
        const casterName = resEffect?.source || 'unknown'
        const chosenType = resEffect?.chosenType || 'unknown'
        badges.push({ label: 'Resistance', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'resistance_damage_reduction', tooltip: `Resistance from ${casterName}: reduces ${chosenType} damage by 1d4 (once per turn)` })
    }
    if (effects.blessBonus) {
        const blessEffect = targetEffects?.find(te => te.effect === 'bless_bonus' && te.target === creatureName)
        const casterName = blessEffect?.source || 'unknown'
        badges.push({ label: 'Bless', cls: 'effect-buff', icon: 'fa-hands', removable: true, removeAction: 'target_effect', effectType: 'bless_bonus', tooltip: `Bless from ${casterName}: +1d4 on attack rolls and saving throws` })
    }
    if (effects.beaconOfHope) {
        const beaconEffect = targetEffects?.find(te => te.effect === 'beacon_of_hope' && te.target === creatureName)
        const casterName = beaconEffect?.source || 'unknown'
        badges.push({ label: 'Beacon of Hope', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: true, removeAction: 'target_effect', effectType: 'beacon_of_hope', tooltip: `Beacon of Hope from ${casterName}: Advantage on WIS saves, death saves, and maximized healing` })
    }
    if (effects.hasteActive) {
        badges.push({ label: 'Hasted', cls: 'effect-buff', icon: 'fa-bolt', removable: true, removeAction: 'remove_haste', tooltip: 'Haste: Speed doubled, +2 AC, Advantage on DEX saves, Extra action (Attack, Dash, Disengage, Hide, Use Object)' })
    }
    if (effects.barkskinActive) {
        badges.push({ label: 'Barkskin', cls: 'effect-buff', icon: 'fa-tree', removable: true, removeAction: 'remove_barkskin', tooltip: 'Barkskin: AC set to 17' })
    }
    const silenceEffect = targetEffects?.find(te => te.effect === 'silenced' && te.target === creatureName)
    if (silenceEffect) {
        const casterName = silenceEffect.source || 'unknown'
        badges.push({ label: 'Silenced', cls: 'effect-debuff', icon: 'fa-volume-xmark', removable: true, removeAction: 'target_effect', effectType: 'silenced', tooltip: `Silenced by ${casterName} — Deafened, cannot cast spells with Verbal components` })
    }

    const globeEffect = targetEffects?.find(te => te.effect === 'globe_barrier' && te.target === creatureName)
    if (globeEffect) {
        const casterName = globeEffect.source || 'unknown'
        badges.push({ label: 'Globe of Invulnerability', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'globe_barrier', tooltip: `Protected by Globe of Invulnerability from ${casterName} — spells of 5th level or lower blocked` })
    }

    const amfEffect = targetEffects?.find(te => te.effect === 'antimagic_field' && te.target === creatureName)
    if (amfEffect) {
        const casterName = amfEffect.source || 'unknown'
        badges.push({ label: 'Antimagic Field', cls: 'effect-buff', icon: 'fa-shield-halved', removable: true, removeAction: 'target_effect', effectType: 'antimagic_field', tooltip: `Affected by Antimagic Field from ${casterName} — only weapon attacks allowed` })
    }

    const regenEffect = targetEffects?.find(te => te.effect === 'regenerate' && te.target === creatureName)
    if (regenEffect) {
        const casterName = regenEffect.source || 'unknown'
        badges.push({ label: 'Regenerate', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: isLocalhost, removeAction: 'target_effect', effectType: 'regenerate', tooltip: `Regenerate from ${casterName}: 4d8+15 initial heal, 1 HP per turn, full HP on expiration` })
    }

    const auraOfLifeEffect = targetEffects?.find(te => te.effect === 'aura_of_life' && te.target === creatureName)
    if (auraOfLifeEffect) {
        const casterName = auraOfLifeEffect.source || 'unknown'
        badges.push({ label: 'Aura of Life', cls: 'effect-buff', icon: 'fa-heart-pulse', removable: isLocalhost, removeAction: 'target_effect', effectType: 'aura_of_life', tooltip: `Aura of Life from ${casterName}: Resistance to Necrotic damage, HP maximum can't be reduced, Regains 1 HP at start of turn if at 0 HP` })
    }

    const auraOfPurityEffect = targetEffects?.find(te => te.effect === 'aura_of_purity' && te.target === creatureName)
    if (auraOfPurityEffect) {
        const casterName = auraOfPurityEffect.source || 'unknown'
        badges.push({ label: 'Aura of Purity', cls: 'effect-buff', icon: 'fa-shield-halved', removable: isLocalhost, removeAction: 'target_effect', effectType: 'aura_of_purity', tooltip: `Aura of Purity from ${casterName}: Resistance to Poison damage, Advantage on saves vs Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, Stunned` })
    }

    const circleOfPowerEffect = targetEffects?.find(te => te.effect === 'circle_of_power' && te.target === creatureName)
    if (circleOfPowerEffect) {
        const casterName = circleOfPowerEffect.source || 'unknown'
        badges.push({ label: 'Circle of Power', cls: 'effect-buff', icon: 'fa-shield-halved', removable: isLocalhost, removeAction: 'target_effect', effectType: 'circle_of_power', tooltip: `Circle of Power from ${casterName}: Advantage on saving throws, no damage on successful save vs half-damage effects` })
    }

    pushPassWithoutTraceBadge(badges, targetEffects, creatureName, isLocalhost)

    const heroismEffect = targetEffects?.find(te => te.effect === 'heroism' && te.target === creatureName)
    if (heroismEffect) {
        const casterName = heroismEffect.source || 'unknown'
        badges.push({ label: 'Heroism', cls: 'effect-buff', icon: 'fa-dragon', removable: isLocalhost, removeAction: 'target_effect', effectType: 'heroism', tooltip: `Heroism from ${casterName}: Immune to Frightened, gains temp HP at start of each turn (Concentration, up to 1 minute)` })
    }

    const holyAuraEffect = targetEffects?.find(te => te.effect === 'holy_aura' && te.target === creatureName)
    if (holyAuraEffect) {
        const casterName = holyAuraEffect.source || 'unknown'
        badges.push({ label: 'Holy Aura', cls: 'effect-buff', icon: 'fa-sun', removable: isLocalhost, removeAction: 'target_effect', effectType: 'holy_aura', tooltip: `Holy Aura from ${casterName}: Advantage on saving throws, other creatures have Disadvantage on attack rolls against you. Fiends/Undead that hit an affected creature must succeed on CON save or be Blinded` })
    }

    // Warding Bond: from activeBuffs (not targetEffects)
    const wardingBondBuff = safeBuffs?.find(b => b.effect === 'warding_bond')
    if (wardingBondBuff) {
        const sourceChar = wardingBondBuff.sourceCharacter || 'unknown'
        badges.push({ label: 'Warding Bond', cls: 'effect-buff', icon: 'fa-ring', removable: isLocalhost, removeAction: 'remove_buff', tooltip: `Warding Bond from ${sourceChar}: AC +1, saves +1, resistance to all damage. Caster takes same damage.` })
    }

    const pfeagEffect = targetEffects?.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return te.effect === 'protection_from_evil_and_good' && teTarget === creatureName;
    })
    if (pfeagEffect) {
        const casterName = pfeagEffect.source || 'unknown'
        badges.push({ label: 'Protection from Evil and Good', cls: 'effect-buff', icon: 'fa-shield-halved', removable: isLocalhost, removeAction: 'remove_pfeag', effectType: 'protection_from_evil_and_good', tooltip: `Protection from Evil and Good from ${casterName}: Aberrations, Celestials, Elementals, Fey, Fiends, and Undead have Disadvantage on attack rolls against target. Target can't gain Charmed or Frightened conditions from those types.` })
    }

    const pfpEffect = targetEffects?.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return te.effect === 'protection_from_poison' && teTarget === creatureName;
    })
    if (pfpEffect) {
        const casterName = pfpEffect.source || 'unknown'
        badges.push({ label: 'Protection from Poison', cls: 'effect-buff', icon: 'fa-shield-halved', removable: isLocalhost, removeAction: 'target_effect', effectType: 'protection_from_poison', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'poisoned', label: 'Poisoned', dc: pfpEffect.dc || 0, ability: 'con' }) : undefined, tooltip: `Protection from Poison from ${casterName}: Resistance to poison damage. Advantage on saving throws against being poisoned. Concentration` })
    }

    const ottoDanceEffect = targetEffects?.find(te => te.effect === 'ottos_irresistible_dance' && te.target === creatureName)
    if (ottoDanceEffect) {
        const casterName = ottoDanceEffect.source || 'unknown'
        const danceDc = ottoDanceEffect.dc || 0
        badges.push({ label: "Otto's Irresistible Dance", cls: 'effect-debuff', icon: 'fa-music', removable: isLocalhost, removeAction: 'target_effect', effectType: 'ottos_irresistible_dance', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'charmed', label: 'Charmed', dc: danceDc, ability: 'wis' }) : undefined, tooltip: `Otto's Irresistible Dance from ${casterName}: Charmed, Speed 0, Disadvantage on Dexterity saving throws and attack rolls. Click to reroll the WIS save (DC ${danceDc}); a success ends the spell.` })
    }

    const tashasLaughterEffect = targetEffects?.find(te => te.effect === 'tashas_hideous_laughter' && te.target === creatureName)
    if (tashasLaughterEffect) {
        const casterName = tashasLaughterEffect.source || 'unknown'
        const laughterDc = tashasLaughterEffect.dc || 0
        badges.push({ label: "Tasha's Hideous Laughter", cls: 'effect-debuff', icon: 'fa-music', removable: isLocalhost, removeAction: 'target_effect', effectType: 'tashas_hideous_laughter', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'prone', label: 'Prone', dc: laughterDc, ability: 'wis' }) : undefined, tooltip: `Tasha's Hideous Laughter from ${casterName}: Prone and Incapacitated. Click to reroll the WIS save (DC ${laughterDc}); a success ends the spell.` })
    }

    const banishmentEffect = targetEffects?.find(te => te.effect === 'banishment' && te.target === creatureName)
    if (banishmentEffect) {
        const casterName = banishmentEffect.source || 'unknown'
        const permanent = banishmentEffect.permanent
        badges.push({ label: 'Banished', cls: 'effect-debuff', icon: 'fa-door-open', removable: isLocalhost, removeAction: 'target_effect', effectType: 'banishment', tooltip: `Banished by ${casterName}: Incapacitated in demiplane. ${permanent ? 'Permanent banishment - target will not return.' : 'Concentration, up to 1 minute.'}` })
    }

    const mazeEffect = targetEffects?.find(te => te.effect === 'maze' && te.target === creatureName)
    if (mazeEffect) {
        const casterName = mazeEffect.source || 'unknown'
        const mazeDc = mazeEffect.dc || 20
        badges.push({ label: 'Mazed', cls: 'effect-debuff', icon: 'fa-dungeon', removable: isLocalhost, removeAction: 'target_effect', effectType: 'maze', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'incapacitated', label: 'Incapacitated', dc: mazeDc, ability: 'int' }) : undefined, tooltip: `Mazed by ${casterName}: Incapacitated in a labyrinthine demiplane. No one can attack or be attacked. Click to attempt a DC ${mazeDc} INT (Investigation) check to escape.` })
    }

    const imprisonmentEffect = targetEffects?.find(te => te.effect === 'imprisonment' && te.target === creatureName)
    if (imprisonmentEffect) {
        const casterName = imprisonmentEffect.source || 'unknown'
        const prisonType = imprisonmentEffect.prisonType || 'Slumber'
        badges.push({ label: 'Imprisoned', cls: 'effect-debuff', icon: 'fa-dungeon', removable: isLocalhost, removeAction: 'target_effect', effectType: 'imprisonment', tooltip: `Imprisoned by ${casterName}: ${prisonType}. ${imprisonmentEffect.duration || 'Until dispelled'}` })
    }

    const confusionEffect = targetEffects?.find(te => te.effect === 'confusion' && te.target === creatureName)
    if (confusionEffect) {
        const casterName = confusionEffect.source || 'unknown'
        const confusionDc = confusionEffect.dc || 0
        badges.push({ label: 'Confused', cls: 'effect-debuff', icon: 'fa-circle-notch', removable: isLocalhost, removeAction: 'target_effect', effectType: 'confusion', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'confused', label: 'Confused', dc: confusionDc, ability: 'wis' }) : undefined, tooltip: `Confused by ${casterName}: can't take Bonus Actions or Reactions. At start of turn rolls 1d10 behavior (1: move random direction; 2-6: does nothing; 7-8: Attack action vs random creature within reach; 9-10: chooses behavior). End of turn, repeats WIS save (DC ${confusionDc}); success ends the spell. Click to roll the WIS save.` })
    }

    const forcecageEffect = targetEffects?.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return te.effect === 'forcecage' && teTarget === creatureName;
    })
    if (forcecageEffect) {
        const casterName = forcecageEffect.source || 'unknown'
        const forcecageDc = forcecageEffect.dc || 0
        badges.push({ label: 'Forcecaged', cls: 'effect-debuff', icon: 'fa-dungeon', removable: isLocalhost, removeAction: 'target_effect', effectType: 'forcecage', onClick: onRollConditionSave ? () => onRollConditionSave(creatureName, { key: 'forcecaged', label: 'Forcecaged', dc: forcecageDc, ability: 'cha' }) : undefined, tooltip: `Trapped in a Forcecage from ${casterName}: can't leave by nonmagical means, and no attack, spell, or effect can pass between inside and outside the prison. Click to attempt a CHA save (DC ${forcecageDc}); on success the creature can use teleportation or interplanar travel to exit.` })
    }

    // Deduplicate badges by label, keeping the first occurrence
    const seenLabels = new Set()
    const uniqueBadges = badges.filter(b => {
        if (seenLabels.has(b.label)) return false
        seenLabels.add(b.label)
        return true
    })

    const handleRemoveEffect = (badge) => {
        switch (badge.removeAction) {
            case 'condition':
                removeConditionByKey(creatureName, badge.removeKey, campaignName)
                break
            case 'target_effect':
                removeTargetEffect(creatureName, badge.effectType, campaignName)
                break
            case 'remove_pfeag': {
                removeTargetEffect(creatureName, 'protection_from_evil_and_good', campaignName)
                const buffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []
                const filteredBuffs = buffs.filter(b => !(b.name === 'Protection from Evil and Good' && b.effect === 'protection_from_evil_and_good'))
                setRuntimeValue(creatureName, 'activeBuffs', filteredBuffs, campaignName)
                setRuntimeValue(creatureName, 'protectionFromEvilAndGoodWardedTypes', [], campaignName)
                break
            }
            case 'remove_derived':
                if (badge.effectTypes?.length > 0) {
                    removeTargetEffectsByTypes(creatureName, badge.effectTypes, campaignName)
                }
                break
            case 'remove_haste':
                removeTargetEffectsByTypes(creatureName, ['haste'], campaignName)
                removeBuffsByTypes(creatureName, ['haste'], campaignName)
                break
            case 'remove_barkskin':
                removeTargetEffectsByTypes(creatureName, ['barkskin'], campaignName)
                removeBuffsByTypes(creatureName, ['barkskin'], campaignName)
                break
            case 'inspiring_move':
                setRuntimeValue(creatureName, 'inspiringMovementNoOA', false, campaignName)
                break
            case 'maneuvering_move':
                setRuntimeValue(creatureName, 'maneuveringStepGranted', null, campaignName)
                setRuntimeValue(creatureName, 'maneuveringStepNoOA', null, campaignName)
                setRuntimeValue(creatureName, 'maneuveringStepNoOASource', null, campaignName)
                break
            case 'remarkable_no_oa':
                setRuntimeValue(creatureName, 'remarkableAthleteNoOA', false, campaignName)
                break
            case 'oa_disadv':
                setRuntimeValue(creatureName, 'hasSpeedyOpportunityDisadvantage', false, campaignName)
                break
            case 'difficult_terrain_ignore':
                setRuntimeValue(creatureName, 'hasSpeedyDifficultTerrainIgnore', false, campaignName)
                break
            case 'corona_disadvantage':
                setRuntimeValue(creatureName, 'coronaDisadvantage', false, campaignName)
                break
            case 'taunting_step':
                removeTargetEffect(creatureName, badge.effectType, campaignName)
                break
            case 'stealth_attack':
                setRuntimeValue(creatureName, 'stealthAttackCost', 0, campaignName)
                break
            case 'vow_of_enmity': {
                const vowCreature = allCreatures?.find(c => getRuntimeValue(c.name, 'vowOfEnmityTarget', campaignName) === creatureName)
                if (vowCreature) {
                    setRuntimeValue(vowCreature.name, 'vowOfEnmityTarget', null, campaignName)
                }
                break
            }
            case 'remove_buff': {
                const buffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []
                const filtered = buffs.filter(b => b.effect !== 'advantage_attacks_and_saves' && b.effect !== 'vow_of_enmity' && b.effect !== 'dodge' && b.effect !== 'haste' && b.effect !== 'warding_bond')
                setRuntimeValue(creatureName, 'activeBuffs', filtered, campaignName)
                break
            }
        }
    }

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
                    onRemove={() => handleRemoveEffect(b)}
                    onClick={b.onClick}
                    disabled={b.disabled}
                />
            ))}
        </>
    )
}

export default ConditionEffectBadges
