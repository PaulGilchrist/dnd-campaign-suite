import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import storage from '../../../ui/storage.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const USES_KEY = 'searingvengeanceUses';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // 1. Check resource usage
    const storedUses = getRuntimeValue(playerName, USES_KEY, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (auto.usesMax || 1);
    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Must finish a Long Rest to regain.`,
                automation: auto,
            },
        };
    }

    // 2. Get combat context
    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    // 3. Find creatures at 0 HP (within ally range)
    const allyRangeFt = auto.allyRange ? rangeToFeet(auto.allyRange) : 60;
    const creaturesAtZero = [];
    for (const creature of cs.creatures) {
        const creatureHp = creature.type === 'player'
            ? (getRuntimeValue(creature.name, 'currentHitPoints', campaignName) ?? creature.maxHp ?? 0)
            : (creature.currentHp ?? 0);
        if (creatureHp <= 0 && creature.name !== playerName) {
            const inRange = await isWithinRange(playerName, creature.name, allyRangeFt);
            if (inRange) {
                creaturesAtZero.push(creature);
            }
        }
    }

    if (creaturesAtZero.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures within 60 feet are at 0 HP.',
                automation: auto,
            },
        };
    }

    // 4. Heal the first creature at 0 HP (half max HP)
    const target = creaturesAtZero[0];
    const targetMaxHp = target.maxHp || (target.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints', campaignName) ?? 1)
        : 1);
    const healAmount = Math.floor(targetMaxHp / 2);

    if (target.type === 'player') {
        await setRuntimeValue(target.name, 'currentHitPoints', healAmount, campaignName);
    } else {
        target.currentHp = healAmount;
        if (target.maxHp) {
            target.maxHp = targetMaxHp;
        }
        const updatedCs = await getCombatContext(campaignName);
        if (updatedCs) {
            storage.set('combatSummary', updatedCs, campaignName);
        }
    }

    // Clear conditions from healed target
    await setRuntimeValue(target.name, 'activeConditions', [], campaignName);

    // 5. Build creature targets within 30 feet (all creatures except the healed target and the warlock)
    const rangeFt = auto.range ? rangeToFeet(auto.range) : 30;
    const creatureTargets = [];
    for (const creature of cs.creatures) {
        if (creature.name === target.name) continue;
        if (creature.name === playerName) continue;
        const inRange = await isWithinRange(playerName, creature.name, rangeFt);
        if (inRange) {
            creatureTargets.push({
                name: creature.name,
                type: creature.type,
                currentHp: creature.currentHp,
                maxHp: creature.maxHp,
            });
        }
    }

    return {
        type: 'modal',
        modalName: 'searingVengeance',
        payload: {
            name: action.name,
            creatureTargets: creatureTargets,
            targetName: target.name,
            healAmount: healAmount,
            automation: auto,
        },
    };
}

function rangeToFeet(rangeStr) {
    if (!rangeStr) return 30;
    const match = String(rangeStr).match(/^(\d+)\s*ft$/i);
    return match ? parseInt(match[1], 10) : 30;
}

export async function confirmSearingVengeance(automation, playerStats, campaignName, mapName, characters, payload) {
    const playerName = playerStats.name;
    const targetName = payload.targetName;
    const healAmount = payload.healAmount;
    const name = payload.name;

    const selectedTargets = payload.selectedTargets;
    if (!selectedTargets || selectedTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name,
                description: `${name} used — no creatures selected for damage.`,
                automation,
            },
        };
    }

    // Consume the resource
    const storedUses = getRuntimeValue(playerName, USES_KEY, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (automation.usesMax || 1);
    await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

    // Roll damage
    const damageExpr = automation.damageExpression || '2d8 + CHA modifier';
    // Resolve variable expressions (e.g. "2d8 + CHA modifier" -> "2d8+2")
    const chaMod = playerStats?.computedStats?.chaMod ?? playerStats?.abilityModifiers?.CHA ?? 0;
    const resolvedExpression = damageExpr
        .replace(/\bCHA modifier\b/gi, String(chaMod))
        .replace(/\s+/g, '');
    const damageResult = rollExpression(resolvedExpression);
    const damageAmount = damageResult?.total || 0;
    const rollDisplay = damageResult?.rolls?.length > 0 ? `(${damageResult.rolls.join(', ')})` : '';

    // Get combat context for damage application
    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name,
                description: 'No combat active.',
                automation,
            },
        };
    }

    // Apply damage and blinded condition to each selected creature

    for (const creatureName of selectedTargets) {
        // Apply radiant damage
        applyDamageToTarget(cs, creatureName, damageAmount, ['Radiant'], campaignName, characters || [], false, playerName);

        // Apply blinded condition
        const storedConditions = getRuntimeValue(creatureName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const hasBlinded = conditions.some(c => String(c).toLowerCase() === 'blinded');
        if (!hasBlinded) {
            await setRuntimeValue(creatureName, 'activeConditions', [...conditions, 'blinded'], campaignName);
        }

        // Register expiration: blinded lasts until end of the warlock's next turn (2 rounds)
        await addExpiration(playerName, creatureName, [
            { type: 'condition', condition: 'blinded' },
        ], campaignName, 2);

        // Log damage roll
        await addEntry(campaignName, {
            type: 'roll',
            characterName: playerName,
            rollType: 'damage',
            name: name + ' Damage',
            targetName: creatureName,
            damageType: automation.damageType || 'Radiant',
            total: damageAmount,
            formula: damageExpr,
            rolls: damageResult?.rolls,
            description: `${name} dealt ${damageAmount} radiant damage to ${creatureName}.`,
        }).catch((e) => { console.error("[searingVengeance] Error:", e); });

        // Log hp change
        await addEntry(campaignName, {
            type: 'hp_change',
            characterName: playerName,
            targetName: creatureName,
            delta: -damageAmount,
            currentHp: cs.creatures.find(c => c.name === creatureName)?.currentHp ?? 0,
            maxHp: cs.creatures.find(c => c.name === creatureName)?.maxHp ?? 0,
            isHealing: false,
        }).catch((e) => { console.error("[searingVengeance] Error:", e); });

        // Log blinded condition
        await addEntry(campaignName, {
            type: 'condition',
            characterName: creatureName,
            condition: 'blinded',
            source: name,
            description: `${creatureName} is Blinded until end of ${playerName}'s next turn.`,
        }).catch((e) => { console.error("[searingVengeance] Error:", e); });
    }

    // Log ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: name,
        description: `${name} used on ${targetName} — healed for ${healAmount} HP. ${selectedTargets.length} creatures take ${damageAmount} radiant damage and are Blinded until end of turn.`,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    // Log healing
    await addEntry(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: targetName,
        delta: healAmount,
        currentHp: getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0,
        maxHp: getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0,
        isHealing: true,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: automation.type,
            description: `${playerName} unleashes Searing Vengeance! ${targetName} regains ${healAmount} HP. ${selectedTargets.length} creatures take ${damageAmount} radiant damage ${rollDisplay} and are Blinded until end of ${playerName}'s next turn.`,
            automation,
        },
    };
}

export async function skipSearingVengeance(automation, playerStats, campaignName, payload) {
    const playerName = playerStats.name;
    const targetName = payload.targetName;
    const healAmount = payload.healAmount;
    const name = payload.name;

    // Still consume the use even on skip
    const storedUses = getRuntimeValue(playerName, USES_KEY, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (automation.usesMax || 1);
    await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    if (cs) {
        const target = cs.creatures.find(c => c.name === targetName);
        if (target) {
            if (target.type === 'player') {
                await setRuntimeValue(targetName, 'currentHitPoints', healAmount, campaignName);
            } else {
                target.currentHp = healAmount;
                if (target.maxHp) {
                    target.maxHp = targetName ? (getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0) : 0;
                }
                storage.set('combatSummary', cs, campaignName);
            }
        }
    }

    // Clear conditions
    await setRuntimeValue(targetName, 'activeConditions', [], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: name,
        description: `${name} used on ${targetName} — healed for ${healAmount} HP. No creatures selected for damage.`,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    await addEntry(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: targetName,
        delta: healAmount,
        currentHp: getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0,
        maxHp: getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0,
        isHealing: true,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description: `${playerName} uses Searing Vengeance on ${targetName} — heals for ${healAmount} HP but skips the damage.`,
            automation,
        },
    };
}
