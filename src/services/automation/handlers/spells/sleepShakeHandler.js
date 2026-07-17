import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';


export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shake Asleep';

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

    const sleepTargets = combatSummary.creatures.filter(c => {
        if (c.name === playerName) return false;
        if (c.type === 'player') {
            const conditions = getRuntimeValue(c.name, 'activeConditions', campaignName) || [];
            const condArray = Array.isArray(conditions) ? conditions : [];
            return condArray.some(cond => {
                const cl = String(cond).toLowerCase();
                return cl === 'incapacitated' || cl === 'unconscious';
            });
        }
        return (c.conditions || []).some(cond => {
            const cl = String(cond.key).toLowerCase();
            return cl === 'incapacitated' || cl === 'unconscious';
        });
    });

    const targets = sleepTargets.length > 0 ? sleepTargets : eligibleTargets;

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
        modalName: 'sleepShake',
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
            return cl !== 'incapacitated' && cl !== 'unconscious';
        });
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
            for (const cond of ['incapacitated', 'unconscious']) {
                if (!filtered.some(f => String(f).toLowerCase() === cond)) {
                    addEntry(campaignName, {
                        type: 'condition',
                        action: 'removed',
                        characterName: targetName,
                        condition: cond.charAt(0).toUpperCase() + cond.slice(1),
                        reason: 'Shake Asleep (Sleep spell)',
                        timestamp: Date.now(),
                    }).catch((e) => { console.error("[sleepShake] Error:", e); });
                }
            }
        }
    } else if (creature) {
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const condArray = Array.isArray(conditions) ? conditions : [];
        const hadIncapacitated = condArray.some(c => String(c).toLowerCase() === 'incapacitated');
        const hadUnconscious = condArray.some(c => String(c).toLowerCase() === 'unconscious');
        const filtered = condArray.filter(c => {
            const cl = String(c).toLowerCase();
            return cl !== 'incapacitated' && cl !== 'unconscious';
        });
        if (filtered.length !== condArray.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
        if (hadIncapacitated) {
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Shake Asleep (Sleep spell)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[sleepShake] Error:", e); });
        }
        if (hadUnconscious) {
            addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Unconscious',
                reason: 'Shake Asleep (Sleep spell)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[sleepShake] Error:", e); });
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Shake Asleep',
        description: `${playerName} used an action to shake ${targetName} out of its magical slumber.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[sleepShake] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Shake Asleep',
            description: `${targetName} is no longer affected by Sleep.`,
        },
    };
}
