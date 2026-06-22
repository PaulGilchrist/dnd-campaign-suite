import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollbackDamage, findAttackRollAgainstTarget } from '../../common/damageRollback.js';

const USES_KEY = 'illusorySelfUses';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Illusory Self';

    // 1. Get the last attack roll against the player and the attacker name
    const { attackEvent, attackerName: storedAttackerName } = await findAttackRollAgainstTarget(playerName, campaignName);

    if (!attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent attack roll against you found. ${featureName} can only be used as a Reaction shortly after an attack roll.`,
                automation: auto,
            },
        };
    }

    // Only trigger on a hit
    if (!attackEvent.hit) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `The attack already missed — ${featureName} has no effect.`,
                automation: auto,
            },
        };
    }

    const attackerName = storedAttackerName || 'Unknown creature';

    // 2. Check uses remaining (1 per Short or Long Rest)
    const maxUses = auto.uses || 1;
    let currentUses = Number(getRuntimeValue(playerName, USES_KEY, campaignName) ?? 0);

    if (currentUses >= maxUses) {
        // Check if player can expend a level 2+ spell slot to restore a use
        if (auto.spellSlotRestore) {
            const spellSlot = findLowestAvailableSpellSlot(playerStats, auto.spellSlotRestore.minLevel || 2);
            if (spellSlot) {
                // Spend the spell slot to restore a use
                await setRuntimeValue(playerName, spellSlot.key, spellSlot.stored - 1, campaignName);
                await setRuntimeValue(playerName, USES_KEY, 0, campaignName);
                currentUses = 0;

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: featureName,
                    description: `${playerName} expended a level ${spellSlot.level} spell slot to restore a use of ${featureName}.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[illusorySelf] Error:", e); throw e; });
            } else {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} has no uses remaining. Recharges on a Short or Long Rest, or expend a level ${auto.spellSlotRestore.minLevel || 2}+ spell slot to restore a use. No spell slots available.`,
                        automation: auto,
                    },
                };
            }
        } else {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a Short or Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // 3. Increment use counter
    await setRuntimeValue(playerName, USES_KEY, currentUses + 1, campaignName);

    // 4. Rollback damage using shared utility
    const healedAmount = await rollbackDamage(attackerName, playerName, campaignName, featureName);

    if (healedAmount === 0) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${playerName} used ${featureName} — ${attackerName}'s attack misses due to illusory duplicate.`,
            targetName: attackerName,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[illusorySelf] Error:", e); throw e; });
    }

    let description = `Attacker: <b>${attackerName}</b><br/><br/>`;
    description += `You use your Reaction to interpose an illusory duplicate between yourself and the attacker.<br/><br/>`;
    description += `<b>Result:</b> The attack automatically misses.<br/><br/>`;
    if (healedAmount > 0) {
        description += `<b>Damage Negated:</b> ${healedAmount} HP restored.<br/><br/>`;
    }
    description += `<em>The illusion dissipates. Uses remaining: ${maxUses - currentUses - 1} / ${maxUses} (Short or Long Rest).</em>`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}

function findLowestAvailableSpellSlot(playerStats, minLevel) {
    const levels = [minLevel, minLevel + 1, minLevel + 2, minLevel + 3, minLevel + 4, minLevel + 5, minLevel + 6, minLevel + 7, minLevel + 8, minLevel + 9];
    for (const level of levels) {
        if (level > 9) break;
        const key = `spell_slots_level_${level}`;
        const max = playerStats.spellAbilities?.[key] ?? 0;
        const current = getRuntimeValue(playerStats.name, key);
        const stored = current != null ? Number(current) : max;
        if (stored > 0) {
            return { level, key, stored };
        }
    }
    return null;
}
