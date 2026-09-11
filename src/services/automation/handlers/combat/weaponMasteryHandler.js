import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { collectWeaponMastery } from '../../../combat/automation/automationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { validateSizeLimit } from '../class-fighter-rogue/executeManeuver.js';
const MASTERY_EFFECTS = {
    Topple: {
        label: 'Topple (Prone)',
        description: 'Force the creature to make a Constitution saving throw or fall Prone.',
        effect: 'topple',
        requiresSave: true,
        saveAbility: 'CON',
    },
    Sap: {
        label: 'Disadvantage on Next Attack',
        description: 'The creature has Disadvantage on its next attack roll before the start of your next turn.',
        effect: 'disadvantage_next_attack',
    },
    Slow: {
        label: 'Speed -10 ft',
        description: 'Reduce the creature\'s Speed by 10 feet until the start of your next turn.',
        effect: 'speed_reduction',
        value: 10,
    },
    Vex: {
        label: 'Advantage on Next Attack',
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
    Push: {
        label: 'Push (10 ft)',
        description: 'Push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
        effect: 'push',
        value: 10,
        sizeLimit: 'large_or_smaller',
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
    }).catch((e) => { console.error("[weaponMasteryHandler:log-error]", e); });

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

export async function applyPostDamageMasteryEffects(attackName, playerStats, campaignName, _combatSummary) {
    const available = collectWeaponMastery(attackName, playerStats);
    const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const targetName = lastAttack?.targetName;
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
            }).catch((e) => { console.error("[weaponMasteryHandler:log-error]", e); });
            continue;
        }
        if (masteryName !== 'Slow') {
            const alreadyApplied = getRuntimeValue('campaign', `_${masteryName}_appliedTarget`, campaignName);
            if (alreadyApplied === targetName) { continue; }
            setRuntimeValue('campaign', `_${masteryName}_appliedTarget`, targetName, campaignName);
        }
        await applyMasteryEffect(masteryName, playerStats, campaignName, targetName);
    }
}

export async function applyMasteryEffect(masteryName, playerStats, campaignName, targetName) {
    const mastery = MASTERY_EFFECTS[masteryName];
    if (!mastery) return null;

    // Check once-per-turn for Cleave
    if (mastery.oncePerTurn && masteryName === 'Cleave') {
        const skip = await checkOncePerTurn(masteryName, '_Cleave_UsedRound', playerStats.name, campaignName);
        if (skip) return skip;
    }

    // Nick: once per turn, writes a plain round number the row consumers
    // (attackCalc2024 / CharBonusActions) compare against getCurrentCombatRound().
    // It is a self-mode flag, so no targetEffect is written.
    if (mastery.oncePerTurn && masteryName === 'Nick') {
        return await applyNickMastery(playerStats, campaignName, targetName);
    }

    // Push: instant push of a Large-or-smaller target up to 10 ft straight
    // away (no save). Mirrors the shieldBash instant push write+log shape;
    // size gate reuses the MN-015 validateSizeLimit resolution (monster data
    // first, then combatSummary target.size).
    if (masteryName === 'Push') {
        return await applyPushMastery(mastery, playerStats, campaignName, targetName);
    }

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    let newEffect = {
        target: targetName,
        source: masteryName,
        option: masteryName,
        effect: mastery.effect,
        value: mastery.value || null,
        duration: 'until_start_of_next_turn',
    };
    if (masteryName === 'Graze') {
        newEffect = buildGrazeEffect(newEffect, playerStats);
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
    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    // Mark once-per-turn for Cleave
    if (mastery.oncePerTurn && masteryName === 'Cleave') {
        await markOncePerTurn(masteryName, '_Cleave_UsedRound', playerStats, campaignName);
    }

    const desc = buildMasteryDescription(masteryName, targetName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: masteryName,
        description: `${playerStats.name} applied ${masteryName} to ${targetName}`,
        targetName: targetName,
    }).catch((e) => { console.error("[weaponMasteryHandler:log-error]", e); });

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

async function applyNickMastery(playerStats, campaignName, targetName) {
    const currentRound = getCurrentCombatRound(campaignName);
    if (getRuntimeValue(playerStats.name, '_Nick_UsedRound', campaignName) === currentRound) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Nick',
                description: `${playerStats.name} can use Nick only once per turn.`,
            },
        };
    }
    setRuntimeValue(playerStats.name, '_Nick_UsedRound', currentRound, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Nick',
        description: `${playerStats.name} used Nick${targetName ? ` on ${targetName}` : ''} — Light weapon extra attack is now part of the Attack action.`,
        targetName: targetName || null,
    }).catch((e) => { console.error('[weaponMasteryHandler:log-error]', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Nick',
            description: buildMasteryDescription('Nick', targetName),
            automation: { type: 'mastery_rider', masteries: ['Nick'] },
        },
    };
}

async function applyPushMastery(mastery, playerStats, campaignName, targetName) {
    const sizeCheck = await validateSizeLimit({ name: 'Push', sizeLimit: 'large_or_smaller' }, targetName, campaignName, playerStats);
    if (!sizeCheck.valid) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Push',
            description: `${playerStats.name} attacked ${targetName} with a Push weapon but did not push it — ${sizeCheck.description}`,
            targetName: targetName,
        }).catch((e) => { console.error('[weaponMasteryHandler:log-error]', e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Push',
                description: sizeCheck.description,
            },
        };
    }
    const storedPushEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const pushEffect = {
        target: targetName,
        source: 'Push',
        option: 'Push',
        effect: 'push',
        value: mastery.value,
        duration: 'instant',
    };
    setRuntimeValue('campaign', 'targetEffects', [...storedPushEffects, pushEffect], campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Push',
        description: `${playerStats.name} used Push on ${targetName} — pushed ${mastery.value} feet straight away.`,
        targetName: targetName,
    }).catch((e) => { console.error('[weaponMasteryHandler:log-error]', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Push',
            description: buildMasteryDescription('Push', targetName),
            automation: { type: 'mastery_rider', masteries: ['Push'] },
        },
    };
}

function buildGrazeEffect(newEffect, playerStats) {
    const grazeAbilityName = playerStats.automation?.passives?.find(p => p.type === 'weapon_mastery_choice' && p.name === 'Graze')?.abilityName || 'Strength';
    const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
    return {
        ...newEffect,
        abilityName: grazeAbilityName,
        abilityMod: grazeAbility?.bonus || 0,
        duration: 'until_end_of_turn',
    };
}

function buildMasteryDescription(masteryName, targetName) {
    const target = targetName || 'target';
    switch (masteryName) {
        case 'Topple': return `${masteryName}: ready to force a CON save vs Prone.`;
        case 'Sap': return `${masteryName} applied to ${target} — Disadvantage on next attack roll.`;
        case 'Slow': return `${masteryName} applied to ${target} — Speed reduced by 10 ft.`;
        case 'Vex': return `${masteryName} applied to ${target} — you have Advantage on next attack.`;
        case 'Cleave': return `${masteryName} — make an extra attack against a second creature within 5 ft.`;
        case 'Graze': return `${masteryName} — deal damage equal to ability modifier on a miss.`;
        case 'Nick': return `${masteryName} — make Light weapon extra attack as part of Attack action.`;
        case 'Push': return `${masteryName} applied to ${target} — pushed up to 10 feet straight away from you.`;
        default: return `${masteryName} applied to ${target}.`;
    }
}
