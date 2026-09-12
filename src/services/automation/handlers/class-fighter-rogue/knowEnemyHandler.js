import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getMonsterData } from '../../../../services/npcs/monsterUtils.js';
import { resolveMonsterIRV } from '../../../../services/npcs/monsterIrvUtils.js';
import { getCombatContext, getTargetFromAttacker } from '../../../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

async function resolveTargetName(playerStats, campaignName) {
    try {
        const combatContext = await getCombatContext(campaignName);
        if (!combatContext) return null;
        const target = getTargetFromAttacker(combatContext, playerStats.name);
        return target ? target.name : null;
    } catch (error) { console.warn('[knowEnemyHandler] No combat context:', error); return null; }
}

async function resolveTargetIRV(targetName) {
    if (!targetName) return null;
    try {
        const monsterData = await getMonsterData(targetName, null);
        return monsterData ? resolveMonsterIRV(monsterData) : null;
    } catch (error) { console.warn('[knowEnemyHandler] Monster data not found for target:', error); return null; }
}

function buildIravLines(irvInfo) {
    let text = '';
    if (irvInfo.immunities.length > 0) {
        text += `Immunities: ${irvInfo.immunities.join(', ')}\n`;
    }
    if (irvInfo.resistances.length > 0) {
        text += `Resistances: ${irvInfo.resistances.join(', ')}\n`;
    }
    if (irvInfo.vulnerabilities.length > 0) {
        text += `Vulnerabilities: ${irvInfo.vulnerabilities.join(', ')}\n`;
    }
    if (irvInfo.conditionImmunities.length > 0) {
        text += `Condition Immunities: ${irvInfo.conditionImmunities.join(', ')}\n`;
    }
    if (irvInfo.immunities.length === 0 && irvInfo.resistances.length === 0 && irvInfo.vulnerabilities.length === 0 && irvInfo.conditionImmunities.length === 0) {
        text += `No immunities, resistances, vulnerabilities, or condition immunities.\n`;
    }
    return text;
}

function buildUserDescription(action, auto, targetName, irvInfo, iravLines, usedRelentless, dieValue) {
    let description = `${action.name}: Expend 1 Superiority Die to discern enemy strengths and weaknesses.\n`;
    if (usedRelentless) {
        description += `Rolled d${dieValue} for ${dieValue} (Relentless).\n`;
    }
    description += `Target: ${targetName || 'None (not in combat)'}.\n`;
    description += `Range: ${auto.range || '30 ft'}.\n\n`;
    description += irvInfo ? iravLines : `No monster data found for target. The target may be a player character or a custom NPC.\n`;
    return description;
}

function buildLogDescription(playerName, auto, targetName, usedRelentless, dieValue, iravLines) {
    let logDescription = `Know Your Enemy used by ${playerName}`;
    if (targetName) {
        logDescription += ` against ${targetName}`;
    }
    if (usedRelentless) {
        logDescription += ` (Relentless - free d${dieValue} die)`;
    }
    logDescription += `.\nRange: ${auto.range || '30 ft'}.\n`;
    logDescription += iravLines;
    return logDescription;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const usesKey = 'superiorityDice';
    const defaultMax = auto.uses_max || 4;

    const storedUses = getRuntimeValue(playerStats.name, usesKey, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : defaultMax;

    const hasRelentless = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
    const storedRound = getRuntimeValue(playerStats.name, 'relentlessUsedRound', campaignName);
    const currentRound = getCurrentCombatRound(campaignName);
    // CLA-286: round-keyed self-re-arming latch (CLA-109 pattern).
    const relentlessUsed = hasRelentless && storedRound != null && Number(storedRound) >= Number(currentRound);
    const relentlessAvailable = hasRelentless && !relentlessUsed;

    if (currentUses <= 0 && !relentlessAvailable) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    let dieValue = 0;
    let usedRelentless = false;

    if (relentlessAvailable && currentUses <= 0) {
        const superiorityDieSize = evaluateAutoExpression(auto.dieExpression || 'superiority_die', playerStats);
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        await setRuntimeValue(playerStats.name, 'relentlessUsedRound', currentRound, campaignName);
        usedRelentless = true;
    } else {
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    // Get target from combat context
    const targetName = await resolveTargetName(playerStats, campaignName);

    // Look up monster data for target
    const irvInfo = await resolveTargetIRV(targetName);
    const iravLines = irvInfo ? buildIravLines(irvInfo) : '';

    const description = buildUserDescription(action, auto, targetName, irvInfo, iravLines, usedRelentless, dieValue);
    const logDescription = buildLogDescription(playerStats.name, auto, targetName, usedRelentless, dieValue, iravLines);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: logDescription,
    }).catch((e) => { console.error("[knowEnemyHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}
