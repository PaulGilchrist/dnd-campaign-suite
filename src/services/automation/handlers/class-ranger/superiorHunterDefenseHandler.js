import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';

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

    const primaryDamage = lastAttack.primaryDamage || 0;
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

    const healAmount = Math.floor(resistedAmount / 2);

    const cs = await getCombatContext(campaignName);
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

    const healText = actualHeal > 0 ? ` Retroactively healed for ${actualHeal} HP (${Math.floor(resistedAmount / 2)} from ${resistedAmount} ${damageType} damage halved by resistance).` : '';

    if (actualHeal > 0) {
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
