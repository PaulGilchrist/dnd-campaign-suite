import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const EVENT_STALENESS_MS = 60000;
const USES_KEY = 'beguilingDefensesUses';

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Beguiling Defenses';

    // 1. Get the last attack roll against the player
    const attackResult = await findLastAttack();
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || isStale(attackEvent) || attackResult.targetName !== playerName) {
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
                }).catch((e) => { console.error("[beguilingDefenses] Error:", e); throw e; });
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

    // 4. Get the attacker from combat context for the save prompt
    const cs = await getCombatContext(campaignName);
    let targetName = attackerName;
    if (cs) {
        // The attacker is the creature that targeted the player
        const attackerCreature = cs.creatures?.find(c =>
            c.targetName === playerName || c.name === attackerName
        );
        if (attackerCreature) {
            targetName = attackerCreature.name;
        }
    }

    // 5. Build save DC and create save listener for the attacker
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'WIS';

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} triggered — ${targetName} was hit with attack, damage halved. ${targetName} must make ${saveType} save (DC ${saveDc}) or take Psychic damage equal to damage dealt to ${playerName} (after halving).`,
        targetName,
        promptId,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[beguilingDefenses] Error:", e); throw e; });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success) {
            // The Psychic damage is equal to the damage the player takes (after halving)
            // Since we can't know the exact damage at this point, describe it as a prompt
            addEntry(campaignName, {
                type: 'damage_roll',
                characterName: playerName,
                targetName,
                damageType: 'Psychic',
                formula: 'equal to damage taken (after halving)',
                description: `${targetName} failed ${saveType} save against ${featureName} and takes Psychic damage equal to the damage dealt to ${playerName} (after halving).`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[beguilingDefenses] Error:", e); throw e; });
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName,
                saveDc,
                saveType,
                success: true,
                description: `${targetName} succeeded on ${saveType} save — no Psychic damage from ${featureName}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[beguilingDefenses] Error:", e); throw e; });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    // 6. Build the popup description
    let description = `<b>${featureName}</b><br/><br/>`;
    description += `Attacker: <b>${targetName}</b><br/>`;
    description += `After being hit by the attack roll, you use your Reaction to reduce the damage by half.<br/><br/>`;
    description += `<b>Damage Reduction:</b> The damage from the triggering attack is reduced by half.<br/><br/>`;
    description += `<b>Psychic Retaliation:</b> ${targetName} must make a <b>Wisdom</b> saving throw (DC ${saveDc}). On a failure, they take <b>Psychic damage</b> equal to the damage you took (after halving).<br/><br/>`;
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
