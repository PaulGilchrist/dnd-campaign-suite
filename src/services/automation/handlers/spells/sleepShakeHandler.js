import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shake Asleep';

    const rangeFt = rangeToFeet(auto.range || '5 ft');

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerName) : null;
    const attackerPos = positions?.attackerPos || null;

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

    const eligibleTargets = combatSummary.creatures.filter(c => {
        if (c.name === playerName) return false;
        if (rangeFt && attackerPos) {
            const targetPosData = (() => {
                const mp = positions?.mapData?.players?.find(p => p.name === c.name);
                if (mp) return { gridX: mp.gridX, gridY: mp.gridY };
                const mi = positions?.mapData?.placedItems?.find(i => i.name === c.name);
                if (mi) return { gridX: mi.gridX, gridY: mi.gridY };
                return null;
            })();
            if (targetPosData) {
                const dist = getDistanceFeet(attackerPos, targetPosData);
                if (dist == null || dist > rangeFt) return false;
            }
        }
        return true;
    });

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
                    postLogEntry(campaignName, {
                        type: 'condition',
                        action: 'removed',
                        characterName: targetName,
                        condition: cond.charAt(0).toUpperCase() + cond.slice(1),
                        reason: 'Shake Asleep (Sleep spell)',
                        timestamp: Date.now(),
                    });
                }
            }
        }
    } else if (creature) {
        const hadIncapacitated = (creature.conditions || []).some(c => String(c.key).toLowerCase() === 'incapacitated');
        const hadUnconscious = (creature.conditions || []).some(c => String(c.key).toLowerCase() === 'unconscious');
        creature.conditions = (creature.conditions || []).filter(c => {
            const cl = String(c.key).toLowerCase();
            return cl !== 'incapacitated' && cl !== 'unconscious';
        });
        if (hadIncapacitated) {
            postLogEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Shake Asleep (Sleep spell)',
                timestamp: Date.now(),
            });
        }
        if (hadUnconscious) {
            postLogEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Unconscious',
                reason: 'Shake Asleep (Sleep spell)',
                timestamp: Date.now(),
            });
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Shake Asleep',
        description: `${playerName} used an action to shake ${targetName} out of its magical slumber.`,
        targetName,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Shake Asleep',
            description: `${targetName} is no longer affected by Sleep.`,
        },
    };
}
