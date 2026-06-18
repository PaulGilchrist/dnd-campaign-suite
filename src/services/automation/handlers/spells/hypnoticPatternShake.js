import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shake Out Stupor';

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
                    postLogEntry(campaignName, {
                        type: 'condition',
                        action: 'removed',
                        characterName: targetName,
                        condition: cond.charAt(0).toUpperCase() + cond.slice(1),
                        reason: 'Shake Out Stupor (Hypnotic Pattern)',
                        timestamp: Date.now(),
                    });
                }
            }
        }
    } else if (creature) {
        const hadCharmed = (creature.conditions || []).some(c => c.key === 'charmed');
        const hadIncapacitated = (creature.conditions || []).some(c => c.key === 'incapacitated');
        creature.conditions = (creature.conditions || []).filter(c => {
            const cl = String(c.key).toLowerCase();
            return cl !== 'charmed' && cl !== 'incapacitated' && cl !== 'speed_zero';
        });
        if (hadCharmed) {
            postLogEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Charmed',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
                timestamp: Date.now(),
            });
        }
        if (hadIncapacitated) {
            postLogEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Shake Out Stupor (Hypnotic Pattern)',
                timestamp: Date.now(),
            });
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Shake Out Stupor',
        description: `${playerName} used an action to shake ${targetName} out of its hypnotic stupor.`,
        targetName,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Shake Out Stupor',
            description: `${targetName} is no longer affected by Hypnotic Pattern.`,
        },
    };
}
