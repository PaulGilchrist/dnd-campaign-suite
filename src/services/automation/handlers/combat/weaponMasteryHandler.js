import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { collectWeaponMastery } from '../../../combat/automation/automationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
const MASTERY_EFFECTS = {
    Push: {
        label: 'Push (10 ft)',
        description: 'Push the creature up to 10 feet straight away from you if it is Large or smaller.',
        effect: 'push',
        value: 10,
        sizeLimit: 'large_or_smaller',
    },
    Topple: {
        label: 'Topple (Prone)',
        description: 'Force the creature to make a Constitution saving throw or fall Prone.',
        effect: 'topple',
        requiresSave: true,
        saveAbility: 'CON',
    },
    Sap: {
        label: 'Sap (Disadvantage)',
        description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.',
        effect: 'disadvantage_next_attack',
    },
    Slow: {
        label: 'Slow (Speed -10 ft)',
        description: 'Reduce the creature\'s Speed by 10 feet until the start of your next turn.',
        effect: 'speed_reduction',
        value: 10,
    },
    Vex: {
        label: 'Vex (Advantage)',
        description: 'You have Advantage on your next attack roll against that creature before the end of your next turn.',
        effect: 'next_attack_advantage',
        value: 5,
        perTarget: true,
    },
    Cleave: {
        label: 'Cleave (Extra Attack)',
        description: 'Make a melee attack roll with the weapon against a second creature within 5 feet of the first.',
        effect: 'cleave',
        oncePerTurn: true,
    },
    Nick: {
        label: 'Nick (Extra Attack)',
        description: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action.',
        effect: 'nick',
        oncePerTurn: true,
    },
    Graze: {
        label: 'Graze (Miss Damage)',
        description: 'If your attack roll misses, deal damage equal to your ability modifier.',
        effect: 'graze',
    },
};

export { MASTERY_EFFECTS, buildMasteryDescription };

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const availableMasteries = auto.masteries || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} available${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    return {
        type: 'modal',
        modalName: 'weaponMastery',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName,
            availableMasteries,
        },
    };
}

export async function applyPostDamageMasteryEffects(attackName, playerStats, campaignName, combatSummary) {
    const available = collectWeaponMastery(attackName, playerStats);
    const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
    const targetName = combatSummary?.lastAttack?.targetName;
    if (!targetName) return;

    for (const masteryName of allMasteries) {
        const mastery = MASTERY_EFFECTS[masteryName];
        if (!mastery) continue;
        if (masteryName === 'Graze') continue;
        if (masteryName === 'Topple') continue;
        if (masteryName === 'Nick') {
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: masteryName,
                description: `${playerStats.name} used ${masteryName} on ${targetName} — Light weapon extra attack available as part of Attack action.`,
                targetName: targetName,
            }).catch(() => {});
            continue;
        }
        if (masteryName !== 'Slow') {
            const alreadyApplied = getRuntimeValue(campaignName, `_${masteryName}_appliedTarget`, campaignName);
            if (alreadyApplied === targetName) { continue; }
            setRuntimeValue(campaignName, `_${masteryName}_appliedTarget`, targetName, campaignName);
        }
        await applyMasteryEffect(masteryName, playerStats, campaignName, targetName);
    }
}

export async function applyMasteryEffect(masteryName, playerStats, campaignName, targetName) {
    const mastery = MASTERY_EFFECTS[masteryName];
    if (!mastery) return null;

    if (mastery.sizeLimit && targetName && masteryName === 'Push') {
        const sizeOrder = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
        const maxAllowedIndex = mastery.sizeLimit === 'large_or_smaller'
            ? sizeOrder.indexOf('Large')
            : mastery.sizeLimit === 'medium_or_smaller'
                ? sizeOrder.indexOf('Medium')
                : mastery.sizeLimit === 'one_size_larger'
                    ? sizeOrder.indexOf(playerStats.size || 'Medium') + 1
                    : sizeOrder.length;
        const cs = await getCombatContext(campaignName);
        if (cs) {
            const target = cs.creatures?.find(c => c.name === targetName);
            if (target) {
                const targetSizeIndex = sizeOrder.indexOf(target.size || 'Medium');
                if (targetSizeIndex > maxAllowedIndex) {
                    return {
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: masteryName,
                            description: `${masteryName}: Target is ${target.size} (too large — only ${mastery.sizeLimit === 'large_or_smaller' ? 'Large or smaller' : mastery.sizeLimit === 'medium_or_smaller' ? 'Medium or smaller' : 'up to one size larger than you'} affected).`,
                        },
                    };
                }
            }
        }
    }

    // Check once-per-turn for Cleave
    if (mastery.oncePerTurn && masteryName === 'Cleave') {
        const currentRound = getCurrentCombatRound();
        const usedKey = `_Cleave_UsedRound`;
        const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
        if (usedRound === currentRound) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: masteryName,
                    description: `${masteryName} can only be used once per turn.`,
                },
            };
        }
    }

    // Check once-per-turn for Nick
    if (mastery.oncePerTurn && masteryName === 'Nick') {
        const currentRound = getCurrentCombatRound();
        const usedKey = `_Nick_UsedRound`;
        const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
        if (usedRound === currentRound) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: masteryName,
                    description: `${masteryName} can only be used once per turn.`,
                },
            };
        }
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    let newEffect = {
        target: targetName,
        source: masteryName,
        option: masteryName,
        effect: mastery.effect,
        value: mastery.value || null,
        duration: 'until_start_of_next_turn',
    };
    if (masteryName === 'Graze') {
        const grazeAbilityName = playerStats.automation?.passives?.find(p => p.type === 'weapon_mastery_choice' && p.name === 'Graze')?.abilityName || 'Strength';
        const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
        newEffect = {
            ...newEffect,
            abilityName: grazeAbilityName,
            abilityMod: grazeAbility?.bonus || 0,
            duration: 'until_end_of_turn',
        };
    }
    if (masteryName === 'Vex') {
        const currentRound = getCurrentCombatRound();
        newEffect = {
            ...newEffect,
            target: playerStats.name,
            vexTarget: targetName,
            appliedRound: currentRound,
        };
        addExpiration(playerStats.name, targetName, [
            { type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Vex', target: targetName }
        ], campaignName, 2);
    }
    if (masteryName === 'Sap') {
        const currentRound = getCurrentCombatRound();
        newEffect = {
            ...newEffect,
            appliedRound: currentRound,
        };
        addExpiration(playerStats.name, targetName, [
            { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'Sap', target: targetName }
        ], campaignName, undefined, playerStats.name);
    }
    if (masteryName === 'Slow') {
        const existingSlowForTarget = storedEffects.filter(
            te => te.target === targetName && te.effect === 'speed_reduction' && te.source === 'Slow'
        );
        if (existingSlowForTarget.length > 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: masteryName,
                    description: `${masteryName}: Target already has Speed reduction from Slow — additional reductions don't stack.`,
                },
            };
        }
        addExpiration(playerStats.name, targetName, [
            { type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'Slow', target: targetName }
        ], campaignName, 1);
    }
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    // Mark once-per-turn for Cleave
    if (mastery.oncePerTurn && masteryName === 'Cleave') {
        const currentRound = getCurrentCombatRound();
        await setRuntimeValue(playerStats.name, `_Cleave_UsedRound`, currentRound, campaignName);
    }

    // Mark once-per-turn for Nick
    if (mastery.oncePerTurn && masteryName === 'Nick') {
        const currentRound = getCurrentCombatRound();
        await setRuntimeValue(playerStats.name, `_Nick_UsedRound`, currentRound, campaignName);
    }

    const desc = buildMasteryDescription(masteryName, targetName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: masteryName,
        description: `${playerStats.name} applied ${masteryName} to ${targetName}`,
        targetName: targetName,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: masteryName,
            description: desc,
            automation: { type: 'mastery_rider', masteries: [masteryName] },
        },
    };
}

function buildMasteryDescription(masteryName, targetName) {
    const target = targetName || 'target';
    switch (masteryName) {
        case 'Push': return `${masteryName} applied to ${target} — pushed up to 10 ft away.`;
        case 'Topple': return `${masteryName}: ready to force a CON save vs Prone.`;
        case 'Sap': return `${masteryName} applied to ${target} — Disadvantage on next attack roll.`;
        case 'Slow': return `${masteryName} applied to ${target} — Speed reduced by 10 ft.`;
        case 'Vex': return `${masteryName} applied to ${target} — you have Advantage on next attack.`;
        case 'Cleave': return `${masteryName} — make an extra attack against a second creature within 5 ft.`;
        case 'Graze': return `${masteryName} — deal damage equal to ability modifier on a miss.`;
        case 'Nick': return `${masteryName} — make Light weapon extra attack as part of Attack action.`;
        default: return `${masteryName} applied to ${target}.`;
    }
}
