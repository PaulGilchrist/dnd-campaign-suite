import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import storage from '../../../ui/storage.js';

const USES_KEY = 'beguilingDefensesUses';

export async function handle(action, playerStats, campaignName, _mapName, characters) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Beguiling Defenses';

    // 1. Get the last attack roll against the player
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || attackResult.targetName !== playerName) {
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

    const attackerName = attackResult.attackerName || 'Attacker';
    const totalDamage = attackResult.totalDamage || 0;
    const halfDamage = Math.floor(totalDamage / 2);

    // 2. Check uses remaining (1 per Long Rest)
    let currentUses = Number(getRuntimeValue(playerName, USES_KEY, campaignName) ?? 0);
    const maxUses = auto.uses || 1;

    if (currentUses >= maxUses) {
        // Check if Pact Magic slot can be spent to restore a use
        if (auto.pactMagicRecharge) {
            const pactSlotKey = 'warlockPactMagic';
            const currentPactSlots = Number(getRuntimeValue(playerName, pactSlotKey, campaignName) ?? 0);
            if (currentPactSlots > 0) {
                // Spend one Pact Magic slot to restore a use
                await setRuntimeValue(playerName, pactSlotKey, currentPactSlots - 1, campaignName);

                // Reset uses counter (restore the use)
                await setRuntimeValue(playerName, USES_KEY, 0, campaignName);
                currentUses = 0;

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: featureName,
                    description: `${playerName} expended a Pact Magic spell slot to restore a use of ${featureName}.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[beguilingDefenses] Error:", e); });
            } else {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${featureName} has no uses remaining. Recharges on a Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.`,
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
                    description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    // 3. Increment use counter
    await setRuntimeValue(playerName, USES_KEY, currentUses + 1, campaignName);

    // 4. Heal warlock for half the attack damage
    const cs = await getCombatContext(campaignName);
    let healedAmount = 0;
    if (cs && halfDamage > 0) {
        const healResult = await applyHealingToTarget(cs, playerName, halfDamage, campaignName);
        healedAmount = healResult?.actualHeal ?? 0;
    }
    if (healedAmount > 0) {
        const currentHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName) ?? playerStats.computedStats?.currentHp ?? 0;
        const maxHp = getRuntimeValue(playerName, 'hitPoints', campaignName) ?? playerStats.computedStats?.maxHp ?? 0;
        await addEntry(campaignName, {
            type: 'hp_change',
            targetName: playerName,
            delta: healedAmount,
            currentHp,
            maxHp,
            isHealing: true,
            sourceName: featureName,
            note: `Halved damage from ${attackerName}'s attack`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[beguilingDefenses] Error:", e); });
    }

    // 5. Resolve attacker from combat context
    let targetName = attackerName;
    if (cs) {
        const attackerCreature = cs.creatures?.find(c =>
            c.targetName === playerName || c.name === attackerName
        );
        if (attackerCreature) {
            targetName = attackerCreature.name;
        }
    }

    // 6. Build save DC and create save listener for the attacker
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'WIS';

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName} against ${attackerName}. Attack dealt ${totalDamage} damage (${(attackEvent.damageTypes || []).length > 0 ? attackEvent.damageTypes.join(', ') : 'unknown'}). Damage halved — ${playerName} healed for ${healedAmount} HP. ${targetName} must make ${saveType} save (DC ${saveDc}) or take ${halfDamage} Psychic damage.`,
        targetName,
        promptId,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[beguilingDefenses] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;
        window.removeEventListener('save-result', handleSaveResult);

        const { success, total, roll, bonus } = event.detail;

        // Update combat summary lastAttack with save result for display
        const csUpdate = await getCombatContext(campaignName);
        if (csUpdate) {
            csUpdate.lastAttack = {
                ...csUpdate.lastAttack,
                saveResult: success ? 'success' : 'failure',
                saveDc,
                saveType,
                saveRoll: roll,
                saveBonus: bonus,
                saveTotal: total,
                timestamp: Date.now(),
            };
            storage.set('combatSummary', csUpdate, campaignName);
        }

        if (!success) {
            // Apply psychic damage to attacker equal to halved damage
            let psychicDamage = 0;
            if (csUpdate && halfDamage > 0) {
                await applyDamageToTarget(csUpdate, targetName, halfDamage, ['Psychic'], campaignName, characters || [], false, playerName);
                psychicDamage = halfDamage;
            }
            addEntry(campaignName, {
                type: 'roll',
                characterName: playerName,
                rollType: 'damage',
                name: featureName + ' Psychic Retaliation',
                targetName,
                damageType: 'Psychic',
                formula: `${halfDamage}`,
                total: psychicDamage,
                saveResult: 'failure',
                saveDc,
                saveType: 'WIS',
                saveRoll: roll,
                saveBonus: bonus,
                description: `${targetName} failed ${saveType} save (DC ${saveDc}) against ${featureName}. Takes ${psychicDamage} Psychic damage.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[beguilingDefenses] Error:", e); });
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName,
                saveDc,
                saveType,
                success: true,
                saveRoll: roll,
                saveBonus: bonus,
                description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}) — no Psychic damage from ${featureName}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[beguilingDefenses] Error:", e); });
        }
    };

    window.addEventListener('save-result', handleSaveResult);

    // 7. Build the popup description
    let description = `Attacker: <b>${targetName}</b><br/>`;
    description += `Attack dealt <b>${totalDamage}</b> damage (${(attackEvent.damageTypes || []).length > 0 ? attackEvent.damageTypes.join(', ') : 'unknown'}).<br/>`;
    description += `<b>Damage Halved:</b> You heal for <b>${halfDamage}</b> HP (half of ${totalDamage}).<br/><br/>`;
    description += `<b>Psychic Retaliation:</b> ${targetName} must make a <b>${saveType}</b> saving throw (DC ${saveDc}). On a failure, they take <b>${halfDamage} Psychic damage</b>.<br/><br/>`;
    description += `<em>Uses remaining: ${maxUses - currentUses - 1} / ${maxUses} (Long Rest).</em>`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            saveType,
            saveDc,
            damageType: 'Psychic',
            targetName,
        },
    };
}
