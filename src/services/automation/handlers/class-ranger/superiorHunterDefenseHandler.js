import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

function buildMissRefusal(lastAttack, featureName, playerName, campaignName, auto) {
    const primaryDamage = lastAttack.primaryDamage || 0;
    if (lastAttack.attackEvent?.hit !== false && primaryDamage > 0) return null;

    const missReason = lastAttack.attackEvent?.hit === false
        ? 'the last attack missed you'
        : 'the last attack dealt you no damage';
    const refusalText = `${featureName} triggers only when an attack hits you — ${missReason}. Your Reaction is not spent.`;
    const refusalType = `${featureName.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_refused`;
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: refusalType,
        name: featureName,
        description: refusalText,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[superiorHunterDefense] Error logging miss refusal:", e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: refusalText,
            automation: auto,
        },
    };
}

function resolveResistedDamage(lastAttack, primaryDamage) {
    const secondaryDamage = lastAttack.secondaryDamage || 0;
    const primaryDamageType = lastAttack.primaryDamageType || lastAttack.attackEvent?.damageType || 'untyped';
    const secondaryDamageType = lastAttack.secondaryDamageType || null;

    let damageType = primaryDamageType;
    let rawDamage = lastAttack.totalDamage || 0;
    let resistedAmount = primaryDamage;

    if (secondaryDamage > 0 && secondaryDamageType) {
        if (secondaryDamage >= primaryDamage) {
            damageType = secondaryDamageType;
            rawDamage = secondaryDamage;
            resistedAmount = secondaryDamage;
        } else {
            rawDamage = primaryDamage;
        }
    }

    return { damageType, rawDamage, resistedAmount };
}

async function logHunterDefenseHeal({ campaignName, playerName, playerStats, featureName, actualHeal, resistedAmount, damageType }) {
    if (actualHeal <= 0) return;
    const currentHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName) ?? playerStats.computedStats?.currentHp ?? 0;
    const maxHp = getRuntimeValue(playerName, 'hitPoints', campaignName) ?? playerStats.computedStats?.maxHp ?? 0;
    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: playerName,
        delta: actualHeal,
        currentHp,
        maxHp,
        isHealing: true,
        sourceName: featureName,
        note: `${Math.floor(resistedAmount / 2)} HP from ${resistedAmount} ${damageType} damage halved by resistance`,
    }).catch((e) => { console.error("[superiorHunterDefense] Error logging heal:", e); });
}

function refusalPopup(featureName, refusalText, refusalType, playerName, campaignName, auto) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: refusalType,
        name: featureName,
        description: refusalText,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[superiorHunterDefense] Error logging refusal:", e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: refusalText,
            automation: auto,
        },
    };
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Super Hunter\'s Defense';

    const lastAttack = await findLastAttack(campaignName);
    if (!lastAttack.attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent attack found. ${featureName} can only be used after taking damage in combat.`,
                automation: auto,
            },
        };
    }

    if (lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `The last attack did not target you. ${featureName} can only be used shortly after taking damage.`,
                automation: auto,
            },
        };
    }

    // CLA-371: RAW trigger requires a HIT ("When an attacker ... hits you with
    // an attack roll"). A missed attack stores hit:false / primaryDamage:null —
    // refuse BEFORE any spend (no heal, no buff, no latch stamp, no ability_use).
    // Refusal mirrors the verified gates: quiveringPalmHandler / CLA-342
    // "did not hit" refusals + this handler's own _refused log shape.
    const missRefusal = buildMissRefusal(lastAttack, featureName, playerName, campaignName, auto);
    if (missRefusal) {
        return missRefusal;
    }
    const primaryDamage = lastAttack.primaryDamage || 0;

    // CLA-345: Reaction-economy round latch — one triggering turn can only be
    // defended once. Mirrors the CLA-335 Stone's Endurance / CLA-315 Slow Fall
    // recipe: stamp holder playerStats.name with a round read from a FRESH
    // getCombatContext (never a stale cs mirror, FT-082); re-arms when the
    // round advances (also cleared at initiative roll in initiative.jsx /
    // navigationHandlers.js round-wrap lists).
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const usedRoundKey = '_Superior_Hunters_Defense_usedRound';
    const usedRound = Number(getRuntimeValue(playerName, usedRoundKey, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusalPopup(featureName, `You have already used ${featureName} this round — your Reaction is spent until your next turn.`, 'superior_hunters_defense_refused', playerName, campaignName, auto);
    }

    // CLA-371: Serialize the latch — stamp at the TRIGGER, before any spend
    // (heal/buff/expiration/logs). setRuntimeValue commits to the local store
    // synchronously, so a second same-round click now reads the stamped round at
    // the latch check above and refuses instead of double-spending (the old
    // late stamp at the bottom of the handler lost the write→read race —
    // CLA-342/CLA-353 "stamp at trigger" recipe).
    await setRuntimeValue(playerName, usedRoundKey, currentRound, campaignName);

    const { damageType, rawDamage, resistedAmount } = resolveResistedDamage(lastAttack, primaryDamage);

    const healAmount = Math.floor(resistedAmount / 2);

    let actualHeal = 0;
    if (cs) {
        const healResult = await applyHealingToTarget(cs, playerName, healAmount, campaignName);
        actualHeal = healResult?.actualHeal ?? 0;
    }

    // Add resistance buff for the damage type until end of current turn
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    // Remove any existing Superior Hunter's Defense buff
    const existingBuffs = activeBuffs.filter(b => b.name !== featureName);

    const buff = {
        name: featureName,
        effect: 'damage_resistance',
        duration: 'until_end_of_current_turn',
        resistanceTypes: [damageType.toLowerCase()],
    };

    const newBuffs = [...existingBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    // CLA-345: Enforce "until end of current turn" — register a
    // remove_active_buff expiration with a 1-round clock so the resistance
    // drains via expireStaleEffects at the FIRST turn-start of the next
    // round (same round-boundary drain family as weapon masteries /
    // CLA-334 rounds recipe), never persisting indefinitely.
    addExpiration(playerName, playerName, [
        { type: 'remove_active_buff', buffName: featureName },
    ], campaignName, 1);

    const healText = actualHeal > 0 ? ` Retroactively healed for ${actualHeal} HP (${Math.floor(resistedAmount / 2)} from ${resistedAmount} ${damageType} damage halved by resistance).` : '';

    await logHunterDefenseHeal({ campaignName, playerName, playerStats, featureName, actualHeal, resistedAmount, damageType });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}, gaining Resistance to ${damageType} damage until end of current turn.${healText}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[superiorHunterDefense] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `You gained Resistance to ${damageType} damage until end of current turn. (Last damage taken: ${rawDamage} ${damageType})${actualHeal > 0 ? `<br/>Retroactively healed for ${actualHeal} HP.` : ''}`,
            automation: auto,
        },
    };
}
