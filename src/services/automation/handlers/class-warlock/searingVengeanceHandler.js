import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';

const USES_KEY = 'searingvengeanceUses';

function getRealMaxHp(creature, campaignName) {
    if (creature.type === 'player') {
        // combatSummary player entries are 1/1 placeholders — runtime hitPoints is real max HP
        return getRuntimeValue(creature.name, 'hitPoints', campaignName) ?? creature.maxHp ?? 0;
    }
    return creature.maxHp || 0;
}

function getRealCurrentHp(creature, campaignName) {
    if (creature.type === 'player') {
        // runtime currentHitPoints is HP truth; combatSummary player entries are 1/1 placeholders
        return getRuntimeValue(creature.name, 'currentHitPoints', campaignName) ?? creature.currentHp ?? 0;
    }
    return creature.currentHp ?? 0;
}

async function findCreaturesAtZero(cs, playerName, campaignName, allyRangeFt) {
    const zeroCreatures = [];
    for (const creature of cs.creatures) {
        if (Number(getRuntimeValue(creature.name, 'isDead', campaignName) || 0) > 0) continue;
        if (getRealCurrentHp(creature, campaignName) > 0) continue;
        if (await isWithinRange(playerName, creature.name, allyRangeFt)) {
            zeroCreatures.push(creature);
        }
    }
    return zeroCreatures;
}

async function findBurstTargets(cs, targetName, playerName, rangeFt) {
    const creatureTargets = [];
    for (const creature of cs.creatures) {
        if (creature.name === targetName || creature.name === playerName) continue;
        if (await isWithinRange(targetName, creature.name, rangeFt)) {
            creatureTargets.push({
                name: creature.name,
                type: creature.type,
                currentHp: creature.currentHp,
                maxHp: creature.maxHp,
            });
        }
    }
    return creatureTargets;
}

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

    // 3. Find creatures at 0 HP within ally range — RAW: "you or ally within 60 feet", self included
    const allyRangeFt = auto.allyRange ? rangeToFeet(auto.allyRange) : 60;
    const creaturesAtZero = await findCreaturesAtZero(cs, playerName, campaignName, allyRangeFt);

    if (creaturesAtZero.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No creatures within ${allyRangeFt} feet are at 0 HP.`,
                automation: auto,
            },
        };
    }

    // 4. Heal target: first creature at 0 HP, half its real max HP (regular HP, applied on confirm)
    const target = creaturesAtZero[0];
    const targetMaxHp = getRealMaxHp(target, campaignName);
    if (targetMaxHp <= 0) {
        console.error('[searingVengeance] Cannot resolve real max HP for', target.name);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Cannot determine ${target.name}'s maximum Hit Points — Searing Vengeance not used.`,
                automation: auto,
            },
        };
    }
    const healAmount = Math.floor(targetMaxHp / 2);

    // 5. Burst targets within 30 feet, centered on the healed creature ("Creature regains HP... Each creature within 30 feet")
    const rangeFt = auto.range ? rangeToFeet(auto.range) : 30;
    const creatureTargets = await findBurstTargets(cs, target.name, playerName, rangeFt);

    return {
        type: 'modal',
        modalName: 'searingVengeance',
        payload: {
            name: action.name,
            creatureTargets: creatureTargets,
            targetName: target.name,
            targetMaxHp: targetMaxHp,
            healAmount: healAmount,
            automation: auto,
        },
    };
}

function rangeToFeet(rangeStr) {
    if (!rangeStr) return 30;
    const match = String(rangeStr).match(/^(\d+)[_ ]?ft$/i);
    return match ? parseInt(match[1], 10) : 30;
}

export async function confirmSearingVengeance(automation, playerStats, campaignName, mapName, characters, payload) {
    const playerName = playerStats.name;
    const targetName = payload.targetName;
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

    // Get combat context for heal + damage application
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

    // Consume the resource
    const storedUses = getRuntimeValue(playerName, USES_KEY, campaignName);
    const currentUses = storedUses != null ? Number(storedUses) : (automation.usesMax || 1);
    await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

    // Heal the target half its real max HP (canonical heal path: resets death saves 0→positive)
    const targetMaxHp = payload.targetMaxHp ?? getRealMaxHp(cs.creatures.find(c => c.name === targetName) || {}, campaignName);
    const healAmount = payload.healAmount ?? Math.floor(targetMaxHp / 2);
    const healResult = applyHealingToTarget(cs, targetName, healAmount, campaignName);
    const actualHeal = healResult?.actualHeal ?? 0;

    // "ends Pending condition" — clear conditions on the healed creature
    await setRuntimeValue(targetName, 'activeConditions', [], campaignName);

    // Roll damage once: 2d8 + CHA modifier (canonical CHA resolution via abilities bonus)
    const { damageExpr, damageResult, damageAmount, rollDisplay } = rollSearingDamage(automation, playerStats);

    // Apply damage and blinded condition to each selected creature
    for (const creatureName of selectedTargets) {
        await applySearingVengeanceToCreature(cs, {
            creatureName,
            damageAmount,
            damageResult,
            damageExpr,
            campaignName,
            characters,
            playerName,
            name,
            automation,
        });
    }

    // Log healing
    await logSearingHeal(campaignName, playerName, targetName, healResult, actualHeal, targetMaxHp);

    // Log ability use with heal + burst amounts
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: name,
        description: `${name} used on ${targetName} — healed for ${actualHeal} HP. ${selectedTargets.length} creatures take ${damageAmount} radiant damage and are Blinded until end of the current turn.`,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: automation.type,
            description: `${playerName} unleashes Searing Vengeance! ${targetName} regains ${actualHeal} HP. ${selectedTargets.length} creatures take ${damageAmount} radiant damage ${rollDisplay} and are Blinded until end of the current turn.`,
            automation,
        },
    };
}

async function logSearingHeal(campaignName, playerName, targetName, healResult, actualHeal, targetMaxHp) {
    await addEntry(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: targetName,
        delta: actualHeal,
        currentHp: healResult?.newHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0,
        maxHp: healResult?.maxHp ?? targetMaxHp,
        isHealing: true,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });
}

function rollSearingDamage(automation, playerStats) {
    const damageExpr = automation.damageExpression || '2d8 + CHA modifier';
    const chaModRaw = evaluateAutoExpression('CHA modifier', playerStats);
    const chaMod = typeof chaModRaw === 'number' && !isNaN(chaModRaw) ? chaModRaw : 0;
    if (typeof chaModRaw !== 'number') {
        console.error('[searingVengeance] CHA modifier did not resolve to a number:', chaModRaw);
    }
    const diceBase = damageExpr.replace(/\s*\+?\s*CHA modifier\b/i, '').trim() || '2d8';
    const resolvedExpression = chaMod >= 0 ? `${diceBase}+${chaMod}` : `${diceBase}${chaMod}`;
    const damageResult = rollExpression(resolvedExpression);
    const damageAmount = damageResult?.total || 0;
    const rollDisplay = damageResult?.rolls?.length > 0 ? `(${damageResult.rolls.join(', ')})` : '';
    return { damageExpr, damageResult, damageAmount, rollDisplay };
}

async function applySearingVengeanceToCreature(cs, { creatureName, damageAmount, damageResult, damageExpr, campaignName, characters, playerName, name, automation }) {
    applyDamageToTarget(cs, creatureName, damageAmount, ['Radiant'], campaignName, characters || [], { ignoreResistance: false, attackerName: playerName });

    const storedConditions = getRuntimeValue(creatureName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const hasBlinded = conditions.some(c => String(c).toLowerCase() === 'blinded');
    if (!hasBlinded) {
        await setRuntimeValue(creatureName, 'activeConditions', [...conditions, 'blinded'], campaignName);
    }

    // Blinded lasts until end of the current turn (expires next round) per conditionDuration: until_end_of_current_turn
    await addExpiration(playerName, creatureName, [
        { type: 'condition', condition: 'blinded' },
    ], campaignName, 1);

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
        description: `${creatureName} is Blinded until end of the current turn.`,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });
}

export async function skipSearingVengeance(automation, playerStats, campaignName, payload) {
    const playerName = playerStats.name;
    const name = payload.name;

    // Declining the reaction: RAW the reaction is not taken — no heal, no damage, no use expended
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: name,
        description: `${playerName} declined ${name} — reaction not taken, no use expended.`,
    }).catch((e) => { console.error("[searingVengeance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description: `${playerName} declined ${name} — no use expended.`,
            automation,
        },
    };
}
