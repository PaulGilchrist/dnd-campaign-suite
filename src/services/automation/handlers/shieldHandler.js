import { toggleBuff } from '../common/buffToggle.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { findAttackRollAgainstTarget, rollbackDamage } from '../common/damageRollback.js';
import { addEntry } from '../../ui/logService.js';

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
            const attackResult = await findAttackRollAgainstTarget(playerName);

            if (attackResult.attackEvent) {
                const { d20, bonus, targetAc } = attackResult.attackEvent;
                const rollTotal = d20 + bonus;
                const wouldMissWithShield = targetAc != null && (rollTotal < targetAc + 5);

                if (wouldMissWithShield && attackResult.attackerName) {
                    const rawDamage = attackResult.attackEvent.rawDamage || 0;
                    if (rawDamage > 0) {
                        const healResult = await rollbackDamage(attackResult.attackerName, playerName, campaignName, buffName);
                        if (healResult > 0) {
                            await addEntry(campaignName, {
                                type: 'ability_use',
                                characterName: playerName,
                                abilityName: 'Shield',
                                description: `${buffName} retroactively negates ${attackResult.attackerName}'s attack — ${playerName} is healed for ${healResult} HP.`,
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
