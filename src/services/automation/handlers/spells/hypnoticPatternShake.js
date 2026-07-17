import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';


export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shake Out Stupor';

    const rangeFt = auto.range ? parseInt(auto.range.match(/(\d+)/)?.[1] || '5', 10) : 5;

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerName) : null;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary?.creatures) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No combat context found.',
                automation: auto,
            },
        };
    }

    const eligibleTargets = [];
    for (const c of combatSummary.creatures) {
        if (c.name === playerName) continue;
        if (rangeFt > 0 && positions) {
            const inRange = await isWithinRange(playerName, c.name, rangeFt);
            if (!inRange) continue;
        }
        eligibleTargets.push(c);
    }

    const hypnoTargets = combatSummary.creatures.filter(c => {
        if (c.name === playerName) return false;
        if (c.type === 'player') {
            const conditions = getRuntimeValue(c.name, 'activeConditions', campaignName) || [];
            const condArray = Array.isArray(conditions) ? conditions : [];
            return condArray.some(cond => {
                const cl = String(cond).toLowerCase();
                return cl === 'charmed' || cl === 'incapacitated';
            });
        }
        return (c.conditions || []).some(cond => {
            const cl = String(cond.key).toLowerCase();
            return cl === 'charmed' || cl === 'incapacitated';
        });
    });

    const targets = hypnoTargets.length > 0 ? hypnoTargets : eligibleTargets;

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No eligible targets within range.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'hypnoticPatternShake',
        payload: {
            attackerName: playerName,
            campaignName,
            targets: targets.map(t => t.name),
            rangeFeet: rangeFt,
            featureName,
            automation: auto,
        },
    };
}

export async function handleConfirm(action, playerStats, campaignName, _mapName, targetName) {
    if (!targetName) return null;

    const playerName = playerStats.name;

    const combatSummary = await getCombatContext(campaignName);
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);

    if (creature?.type === 'player') {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(conditions) ? conditions : [];
        const filtered = condArray.filter(c => {
            const cl = String(c).toLowerCase();
            return cl !== 'charmed' && cl !== 'incapacitated' && cl !== 'speed_zero';
        });
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
            for (const cond of ['charmed', 'incapacitated', 'speed_zero']) {
                if (!filtered.some(f => String(f).toLowerCase() === cond)) {
                    addEntry(campaignName, {
                        type: 'condition',
                        action: 'removed',
                        characterName: targetName,
                        condition: cond.charAt(0).toUpperCase() + cond.slice(1),
                        reason: 'Shake Out Stupor (Hypnotic Pattern)',
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[hypnoticPatternShake] Error:", e); });
                }
            }
        }
    } else if (creature) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(conditions) ? conditions : [];
        const hadCharmed = condArray.some(c => String(c).toLowerCase() === 'charmed');
        const hadIncapacitated = condArray.some(c => String(c).toLowerCase() === 'incapacitated');
        const filtered = condArray.filter(c => {
            const cl = String(c).toLowerCase();
            return cl !== 'charmed' && cl !== 'incapacitated' && cl !== 'speed_zero';
        });
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
        if (hadCharmed) {
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Charmed',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[hypnoticPatternShake] Error:", e); });
        }
        if (hadIncapacitated) {
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[hypnoticPatternShake] Error:", e); });
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Shake Out Stupor',
        description: `${playerName} used an action to shake ${targetName} out of its hypnotic stupor.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[hypnoticPatternShake] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Shake Out Stupor',
            description: `${targetName} is no longer affected by Hypnotic Pattern.`,
        },
    };
}
