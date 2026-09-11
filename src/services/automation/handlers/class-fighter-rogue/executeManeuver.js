import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import {
    findManeuver,
    checkSuperiorityDice,
    expendSuperiorityDie,
    rollManeuverDie,
    buildManeuverNotFoundPopup,
    buildNoDiceRemainingPopup,
    processManeuverSaveResult,
    buildManeuverSaveDescription,
    filterMeleeAttacks,
} from './combatSuperiorityUtils.js';

export async function executeManeuver(action, playerStats, campaignName, maneuverName) {
    const auto = action.automation;
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(action.name, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    if (targetName && maneuver.sizeLimit) {
        const sizeCheck = await validateSizeLimit(maneuver, targetName, campaignName, playerStats);
        if (!sizeCheck.valid) {
            return {
                type: 'popup',
                refused: true,
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: sizeCheck.description,
                    automation: auto,
                },
                logEntries: [{
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: maneuver.name,
                    description: sizeCheck.description,
                }],
            };
        }
    }

    const { dieValue, dieDescription, expendedDie, superiorityDieSize } = rollManeuverDie(maneuver, playerStats, campaignName, auto.dieExpression);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    let description = `${maneuver.name}: ${dieDescription}`;

    if (targetName && !NO_TARGET_SUFFIX_EFFECTS.has(maneuver.effect)) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
        description += await applyDamageBonusRider(maneuver, auto, targetName, dieValue, playerStats, campaignName);
    }

    if (maneuver.saveType && targetName) {
        description += await runManeuverSave(maneuver, auto, targetName, playerStats, campaignName);
    }
    else if (maneuver.saveType) {
        const saveDc = buildSaveDc(auto, playerStats);
        description += buildManeuverSaveDescription(maneuver, saveDc);
    }

    if (maneuver.effect === 'next_attack_advantage' || maneuver.effect === 'distracting_strike_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
        if (targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const newEffect = {
                target: targetName,
                source: playerStats.name,
                effect: 'distracting_strike_advantage',
                value: null,
                duration: 'until_end_of_turn',
            };
            await setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
        }
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` Choose a willing ally to add ${dieValue} to their next attack's damage roll.`;
        return buildGrantAttackModal(maneuver, auto, description, dieValue, playerStats, campaignName);
    }

    if (maneuver.effect === 'ac_bonus_and_swap') {
        description += ` You or an ally gains +${dieValue} AC until the start of your next turn.`;
        return buildBaitAndSwitchModal(maneuver, auto, description, dieValue, playerStats, campaignName);
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
        await setRuntimeValue(playerStats.name, 'baitAndSwitchActive', true, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchBonus', dieValue, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchSource', maneuver.name, campaignName);
        await addExpiration(playerStats.name, playerStats.name, [
            { type: 'bait_and_switch_clear' }
        ], campaignName, undefined, playerStats.name);
    }

    if (maneuver.effect === 'advantage_and_damage') {
        await setRuntimeValue(playerStats.name, 'feintingAttackDieValue', dieValue, campaignName);
        const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const currentRound = getCurrentCombatRound();
        const newEffect = {
            target: playerStats.name,
            source: maneuver.name,
            effect: 'next_attack_advantage',
            vexTarget: targetName || null,
            value: null,
            duration: 'until_end_of_turn',
            appliedRound: currentRound,
        };
        await setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: maneuver.name, target: playerStats.name }
        ], campaignName, 2);
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', dieValue, campaignName);
        description += ` You take the Dash action. Add ${dieValue} to the damage roll of your next melee hit this turn.`;
    }

    if (maneuver.effect === 'temp_hp') {
        return buildRallyModal(maneuver, description, dieValue, playerStats, campaignName);
    }

    if (maneuver.effect === 'damage_reduction') {
        description += await runDamageReduction(maneuver, playerStats, dieValue, campaignName);
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        return runRiposte(maneuver, auto, description, targetName, dieValue, superiorityDieSize, playerStats, campaignName);
    }

    if (maneuver.effect === 'secondary_damage') {
        return runSweepingAttack(maneuver, auto, dieDescription, dieValue, targetName, playerStats, campaignName);
    }

    if (maneuver.effect === 'attack_roll_bonus') {
        description += ` Add ${dieValue} to the attack roll.`;
    }

    if (maneuver.actionType === 'skill_check') {
        description += ` Add ${dieValue} to the ability check.`;
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };

    return {
        type: 'popup',
        effect: maneuver.effect,
        dieValue,
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
            automation: auto,
        },
        logEntries: [logEntry],
    };
}

// Effects that carry no explicit target suffix in the maneuver description.
const NO_TARGET_SUFFIX_EFFECTS = new Set([
    'ac_bonus_disengage',
    'ac_bonus_and_swap',
    'damage_reduction',
    'dash_and_damage',
]);

// MN-012: attack riders used from the pending-prompt path
// ("Combat Superiority — Use Maneuver") have no pipeline consumer for
// the rolled die — apply it to the target directly (CLA-192 pattern:
// await applyDamageToTarget and let it log hp_change).
async function applyDamageBonusRider(maneuver, auto, targetName, dieValue, playerStats, campaignName) {
    if (!(maneuver.actionType === 'attack_rider' && targetName)) return '';
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack?.hit) return '';
    const cs = await getCombatContext(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const dmgType = lastAttack.damageType || maneuver.damageType || 'force';
    const applyResult = await applyDamageToTarget(cs, targetName, dieValue, [dmgType], campaignName, characters, false, playerStats.name);
    if (applyResult && applyResult.finalDamage > 0) {
        return ` ${targetName} takes ${applyResult.finalDamage} ${dmgType} damage.`;
    }
    return '';
}

async function runManeuverSave(maneuver, auto, targetName, playerStats, campaignName) {
    const saveDc = buildSaveDc(auto, playerStats);
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: maneuver.saveType,
        saveDc,
    });

    const saveResult = await promise;
    const success = saveResult.success;

    let description = ` Target made ${maneuver.saveType} save DC ${saveDc}: ${success ? 'Success' : 'Failure'}.`;
    description += await processManeuverSaveResult(maneuver, targetName, saveDc, success, playerStats, campaignName);
    return description;
}

async function buildGrantAttackModal(maneuver, auto, description, dieValue, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const allies = (cs?.creatures || []).filter(c => c.name !== playerStats.name);
    const options = allies.map(a => ({ label: a.name, value: a.name }));

    if (options.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No allies available to receive the attack.`,
                automation: auto,
            },
        };
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };
    return {
        type: 'modal',
        modalName: 'commanderStrikeChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            options,
            description,
        },
        logEntries: [logEntry],
    };
}

async function buildBaitAndSwitchModal(maneuver, auto, description, dieValue, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const allies = cs?.creatures?.filter(c =>
        c.name !== playerStats.name
    ) || [];
    const options = [
        { label: `Myself (${playerStats.name})`, value: playerStats.name },
        ...allies.map(a => ({ label: a.name, value: a.name })),
    ];
    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };
    return {
        type: 'modal',
        modalName: 'baitAndSwitchChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            options,
            description,
        },
        logEntries: [logEntry],
    };
}

async function buildRallyModal(maneuver, description, dieValue, playerStats, campaignName) {
    const fighterLevel = playerStats.level || 1;
    const extraHpRaw = maneuver.extraHpExpression
        ? evaluateAutoExpression(maneuver.extraHpExpression, playerStats)
        : Math.floor(fighterLevel / 2);
    const extraHp = typeof extraHpRaw === 'number' ? Math.floor(extraHpRaw) : Math.floor(fighterLevel / 2);
    const totalHp = dieValue + extraHp;
    const cs = await getCombatContext(campaignName);
    const allies = cs?.creatures?.filter(c => c.name !== playerStats.name) || [];
    if (allies.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No allies available to receive Rally.`,
            },
        };
    }
    const allyOptions = allies.map(a => ({ label: a.name, value: a.name }));
    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${maneuver.name}: Choose an ally to gain temporary hit points.`,
    };
    return {
        type: 'modal',
        modalName: 'rallyChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            allyOptions,
            totalHp,
            extraHp,
            description,
        },
        logEntries: [logEntry],
    };
}

async function runDamageReduction(maneuver, playerStats, dieValue, campaignName) {
    const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
    const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
    const mod = Math.max(strMod, dexMod);
    const reduction = dieValue + mod;
    let description = ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
    const storedMaxHp = getRuntimeValue(playerStats.name, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
    const maxHp = storedMaxHp != null ? Number(storedMaxHp) : (storedCurrentHp || 10);
    const currentHp = storedCurrentHp != null ? Number(storedCurrentHp) : 10;
    const newHp = Math.min(maxHp, currentHp + reduction);
    if (newHp !== currentHp) {
        await setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
    }
    description += ` HP restored: ${currentHp} → ${newHp}.`;
    return description;
}

async function runRiposte(maneuver, auto, description, targetName, dieValue, superiorityDieSize, playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, 'pendingRiposteDieValue', dieValue, campaignName);

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const riposteTarget = lastAttack?.attackerName || targetName;

    if (riposteTarget && riposteTarget !== targetName) {
        description = description.replace(`Target: ${targetName}.`, `Target: ${riposteTarget}.`);
    }

    const meleeAttacks = filterMeleeAttacks(playerStats.attacks);
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No melee attack available.`,
                automation: auto,
            },
        };
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };
    const popupPayload = {
        type: 'automation_info',
        name: maneuver.name,
        description,
        automation: auto,
    };
    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName: riposteTarget,
        },
        context: {
            superiorityDieValue: dieValue,
            superiorityDieSize: superiorityDieSize,
            baseDamageFormula: attack.damage,
            baseDamageType: attack.damageType,
        },
        logEntries: [logEntry],
        popup: popupPayload,
    };
}

// MN-018: Sweeping Attack must offer a real chooser for a creature within
// 5 feet of the ORIGINAL target and re-use the ORIGINAL attack roll vs that
// creature's AC. The die is already expended above. Stash the pending
// payload (RAW combatants — CLA-326 crash lesson) so executeSweepingAttack
// can run the AC test + apply damage on confirm. No phantom damage claim.
async function runSweepingAttack(maneuver, auto, dieDescription, dieValue, targetName, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const damageType = lastAttack?.damageType || maneuver.damageType || (console.error('[MN-018] Sweeping Attack: no original attack damageType in lastAttack'), 'Slashing');
    const attackBonus = lastAttack?.bonus || 0;
    const originalTotal = lastAttack?.total ?? attackBonus;
    const originalD20Roll = lastAttack?.d20Roll ?? (originalTotal - attackBonus);

    const candidates = (cs?.creatures || []).filter(c =>
        c.name !== targetName && c.name !== playerStats.name
    );
    const rawSecondary = [];
    for (const c of candidates) {
        // 5 ft of the original target gate (gridless resolves LENIENT per §7).
        const ok = await isWithinRange(targetName, c.name, 5);
        if (ok) rawSecondary.push(c);
    }

    if (rawSecondary.length === 0) {
        const desc = `${maneuver.name}: ${dieDescription} No other creature is within 5 feet of ${targetName || 'the original target'}.`;
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: maneuver.name, description: desc, automation: auto },
            logEntries: [{ type: 'ability_use', characterName: playerStats.name, abilityName: maneuver.name, description: desc }],
        };
    }

    await setRuntimeValue(playerStats.name, 'pendingSweepingAttack', {
        dieValue,
        damageType,
        primaryTarget: targetName,
        targetName,
        originalTotal,
        originalD20Roll,
        attackBonus,
        secondaryTargets: rawSecondary,
    }, campaignName);

    const chooserDescription = `${maneuver.name}: ${dieDescription} Choose a creature within 5 feet of ${targetName || 'the original target'} — the original attack roll (${originalTotal}) is reused against its AC; if it would hit, it takes ${dieValue} ${damageType} damage.`;

    return {
        type: 'modal',
        modalName: 'sweepingAttackTarget',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            damageType,
            primaryTarget: targetName,
            targetName,
            secondaryTargets: rawSecondary,
            description: chooserDescription,
        },
        logEntries: [{
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description: `${maneuver.name}: ${dieDescription} Expend 1 Superiority Die.`,
        }],
    };
}

export async function validateSizeLimit(maneuver, targetName, campaignName, playerStats) {
    if (!maneuver.sizeLimit || !targetName) return { valid: true };
    const sizeOrder = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    let maxAllowed;
    if (maneuver.sizeLimit === 'large_or_smaller') {
        maxAllowed = sizeOrder.indexOf('Large');
    }
    else if (maneuver.sizeLimit === 'medium_or_smaller') {
        maxAllowed = sizeOrder.indexOf('Medium');
    }
    else if (maneuver.sizeLimit === 'one_size_larger') {
        maxAllowed = sizeOrder.indexOf(playerStats?.size || 'Medium') + 1;
    }
    if (maxAllowed == null) return { valid: true };
    const cs = await getCombatContext(campaignName);
    if (!cs) return { valid: true };
    const target = cs.creatures?.find(c => c.name === targetName);
    if (!target) return { valid: true };
    // MN-015: monsters.json is the size ground truth (suffix-strip 'Hill Giant 1' -> 'Hill Giant',
    // getMonsterData pattern from knowEnemyHandler/spellGates resolveHumanoids); fall back to
    // target.size (combatSummary, populated by encounterToInitiative for EB joins).
    const monsterData = await getMonsterData(targetName, null);
    const targetSize = monsterData?.size || target.size || 'Medium';
    const targetSizeIndex = sizeOrder.indexOf(targetSize);
    if (targetSizeIndex > maxAllowed) {
        const sizeLabel = maneuver.sizeLimit === 'large_or_smaller'
            ? 'Large or smaller'
            : maneuver.sizeLimit === 'medium_or_smaller'
                ? 'Medium or smaller'
                : `up to one size larger than you`;
        return {
            valid: false,
            description: `${maneuver.name}: Target is ${targetSize} (too large — only ${sizeLabel} affected).`,
        };
    }
    return { valid: true };
}
