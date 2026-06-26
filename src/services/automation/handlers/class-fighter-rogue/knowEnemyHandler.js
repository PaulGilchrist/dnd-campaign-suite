import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../../../services/npcs/monsterUtils.js';
import { getCombatContext, getTargetFromAttacker } from '../../../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const usesKey = 'superiorityDice';
    const defaultMax = auto.uses_max || 4;

    const storedUses = getRuntimeValue(playerStats.name, usesKey, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : defaultMax;

    if (currentUses <= 0) {
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

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    // Get target from combat context
    let targetName = null;
    try {
        const combatContext = await getCombatContext(campaignName);
        if (combatContext) {
            const target = getTargetFromAttacker(combatContext, playerStats.name);
            if (target) {
                targetName = target.name;
            }
        }
    } catch { /* no combat context */ }

    // Look up monster data for target
    let irvInfo = null;
    if (targetName) {
        try {
            const monsterData = await getMonsterData(targetName, null);
            if (monsterData) {
                irvInfo = {
                    immunities: monsterData.damage_immunities || [],
                    resistances: monsterData.damage_resistances || [],
                    vulnerabilities: monsterData.damage_vulnerabilities || [],
                    conditionImmunities: monsterData.condition_immunities || [],
                };
            }
        } catch { /* monster not found */ }
    }

    let description = `${action.name}: Expend 1 Superiority Die to discern enemy strengths and weaknesses.\n`;
    description += `Target: ${targetName || 'None (not in combat)'}.\n`;
    description += `Range: ${auto.range || '30 ft'}.\n\n`;

    if (irvInfo) {
        if (irvInfo.immunities.length > 0) {
            description += `Immunities: ${irvInfo.immunities.join(', ')}\n`;
        }
        if (irvInfo.resistances.length > 0) {
            description += `Resistances: ${irvInfo.resistances.join(', ')}\n`;
        }
        if (irvInfo.vulnerabilities.length > 0) {
            description += `Vulnerabilities: ${irvInfo.vulnerabilities.join(', ')}\n`;
        }
        if (irvInfo.conditionImmunities.length > 0) {
            description += `Condition Immunities: ${irvInfo.conditionImmunities.join(', ')}\n`;
        }
        if (irvInfo.immunities.length === 0 && irvInfo.resistances.length === 0 && irvInfo.vulnerabilities.length === 0 && irvInfo.conditionImmunities.length === 0) {
            description += `No immunities, resistances, vulnerabilities, or condition immunities.\n`;
        }
    } else {
        description += `No monster data found for target. The target may be a player character or a custom NPC.\n`;
    }

    let logDescription = `Know Your Enemy used by ${playerStats.name}`;
    if (targetName) {
        logDescription += ` against ${targetName}`;
    }
    logDescription += `.\nRange: ${auto.range || '30 ft'}.\n`;
    if (irvInfo) {
        if (irvInfo.immunities.length > 0) {
            logDescription += `Immunities: ${irvInfo.immunities.join(', ')}\n`;
        }
        if (irvInfo.resistances.length > 0) {
            logDescription += `Resistances: ${irvInfo.resistances.join(', ')}\n`;
        }
        if (irvInfo.vulnerabilities.length > 0) {
            logDescription += `Vulnerabilities: ${irvInfo.vulnerabilities.join(', ')}\n`;
        }
        if (irvInfo.conditionImmunities.length > 0) {
            logDescription += `Condition Immunities: ${irvInfo.conditionImmunities.join(', ')}\n`;
        }
        if (irvInfo.immunities.length === 0 && irvInfo.resistances.length === 0 && irvInfo.vulnerabilities.length === 0 && irvInfo.conditionImmunities.length === 0) {
            logDescription += `No immunities, resistances, vulnerabilities, or condition immunities.\n`;
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: logDescription,
    }).catch(() => {});

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
