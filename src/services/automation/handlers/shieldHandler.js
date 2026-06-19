 import { toggleBuff } from '../common/buffToggle.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

function findAttackerEvent(creatures, playerName, campaignName) {
    for (const creature of creatures) {
        const ae = getRuntimeValue(creature.name, 'lastAttackRoll', campaignName);
        if (ae && ae.targetName === playerName) {
            return { attackerName: creature.name, attackEvent: ae };
        }
    }
    return null;
}

function findDamageEvent(creatures, targetPlayerName, campaignName) {
    for (const creature of creatures) {
        const de = getRuntimeValue(creature.name, 'lastMetamagicDamage', campaignName);
        if (de && de.targetName === targetPlayerName) {
            return de;
        }
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;

    const { wasActive } = toggleBuff(
        playerName,
        buffName,
        { ...auto, effect: 'shield' },
        campaignName
    );

    if (!wasActive) {
        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName }
        ], campaignName, 1);

        const cs = await getCombatContext(campaignName);
        if (cs) {
            const creatures = cs.creatures || [];
            const attackerInfo = findAttackerEvent(creatures, playerName, campaignName);

            if (attackerInfo) {
                const { d20, bonus, targetAc } = attackerInfo.attackEvent;
                const rollTotal = d20 + bonus;
                const wouldMissWithShield = targetAc != null && (rollTotal < targetAc + 5);

                if (wouldMissWithShield) {
                    const damageEvent = findDamageEvent(creatures, playerName, campaignName);
                    if (damageEvent && damageEvent.rawDamage > 0) {
                        const healResult = applyHealingToTarget(cs, playerName, damageEvent.rawDamage, campaignName);
                        if (healResult?.newHp != null) {
                            await addEntry(campaignName, {
                                type: 'ability_use',
                                characterName: playerName,
                                abilityName: 'Shield',
                                description: `${buffName} retroactively negates ${attackerInfo.attackerName}'s attack — ${playerName} is healed for ${damageEvent.rawDamage} HP.`,
                                timestamp: Date.now(),
                            }).catch((e) => { console.error("[shield] Error:", e); });
                        }
                    }
                }
            }
        }
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: buffName,
            automationType: auto.type,
            description: wasActive
                ? `${buffName} expired`
                : `${buffName} activated — +5 AC until start of your next turn, immune to Magic Missile`,
            automation: auto,
        },
    };
}
