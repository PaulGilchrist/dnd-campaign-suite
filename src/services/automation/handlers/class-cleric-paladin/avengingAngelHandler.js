import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';

const AVENGING_ANGEL_KEY = 'avengingAngelActive';
const AVENGING_ANGEL_AURA_KEY = 'avengingAngelAuraTargets';
const AVENGING_ANGEL_REST_KEY = 'avengingAngelRestUsed';
const AURA_RANGE_FT = 30;

function buildSaveDc(playerStats) {
    const chaBonus = getAbilityModifier(playerStats.abilities, 'Charisma');
    const prof = playerStats.proficiency || 0;
    return 8 + chaBonus + prof;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already active — show popup, do NOT toggle off
    const isActive = getRuntimeValue(playerName, AVENGING_ANGEL_KEY, campaignName);
    if (isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} is already active.`,
                automation: auto,
            },
        };
    }

    // Check if already used this rest period — if so, consume level 5 spell slot
    const alreadyUsed = getRuntimeValue(playerName, AVENGING_ANGEL_REST_KEY, campaignName);
    if (alreadyUsed) {
        const slotKey = 'spell_slots_level_5';
        const currentSlots = Number(getRuntimeValue(playerName, slotKey, campaignName) ?? 0);
        if (currentSlots <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} cannot be used again until a long rest or level 5 spell slot becomes available.`,
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerName, slotKey, currentSlots - 1, campaignName);
        await setRuntimeValue(playerName, AVENGING_ANGEL_KEY, true, campaignName);

        const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffList = Array.isArray(storedBuffs) ? storedBuffs : [];
        const buffEntry = {
            name: action.name,
            effect: 'avenging_angel_flight',
            duration: '10_minutes',
            flySpeed: auto.flySpeed || 60,
            hover: auto.hover || false,
        };
        const newBuffs = activeBuffList.some(b => b.name === action.name)
            ? activeBuffList
            : [...activeBuffList, buffEntry];
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, [], campaignName);

        await resolveFrightfulAura(action, playerStats, campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} reactivated Avenging Angel by expending a level 5 spell slot.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[avengingAngel] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} activated by expending a level 5 spell slot!`,
                automation: auto,
            },
        };
    }

    // Activate
    await setRuntimeValue(playerName, AVENGING_ANGEL_KEY, true, campaignName);
    await setRuntimeValue(playerName, AVENGING_ANGEL_REST_KEY, true, campaignName);

    // Add flight buff: Fly Speed 60 feet, hover
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, {
        name: action.name,
        effect: 'avenging_angel_flight',
        duration: '10_minutes',
        flySpeed: auto.flySpeed || 60,
        hover: auto.hover || false,
    }];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    // Clear previous aura targets
    await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, [], campaignName);

    // Resolve Frightful Aura: apply frightened to enemies in Aura of Protection range
    await resolveFrightfulAura(action, playerStats, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} activated — Flight 60 ft (hover), Frightful Aura active for 10 minutes.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[avengingAngel] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! You gain Fly Speed 60 feet (hover) and your Aura of Protection gains a Frightful Aura. Enemies in the aura must succeed on a Wisdom saving throw or become Frightened for 1 minute or until taking damage.`,
            automation: auto,
        },
    };
}

async function resolveFrightfulAura(action, playerStats, campaignName) {
    const saveDc = buildSaveDc(playerStats);
    const playerName = playerStats.name;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary || !combatSummary.creatures) return;

    const allies = getAllyList(playerName);
    const auraTargets = [];
    const npcResults = [];
    const pendingPlayerSaves = [];

    for (const creature of combatSummary.creatures) {
        if (creature.name === playerName) continue;
        if (allies.includes(creature.name)) continue;

        const inRange = await isWithinRange(playerName, creature.name, AURA_RANGE_FT);
        if (!inRange) continue;

        const isNpc = !creature.type || creature.type === 'npc';

        if (isNpc) {
            const saveBonus = creature.saveBonuses?.wis ?? creature.saveBonuses?.wisdom ?? 0;
            const roll1 = rollD20();
            const total = roll1 + saveBonus;
            const success = total >= saveDc;

            sendSaveResult(campaignName, creature.name, {
                promptId: utils.guid(),
                success,
                roll: roll1,
                total,
                saveBonus,
                rawRolls: [roll1, roll1],
            });

            if (!success) {
                await applyFrightenedToCreature(creature.name, saveDc, campaignName);
                auraTargets.push(creature.name);

                addExpiration(playerName, creature.name, [
                    { type: 'frightened', condition: 'frightened' },
                    { type: 'avenging_angel_aura' },
                ], campaignName);
            }

            npcResults.push({ targetName: creature.name, success, roll: roll1, total, saveBonus });
        } else {
            const { promptId, promise } = createSaveListener(campaignName, {
                targetName: creature.name,
                saveType: 'WIS',
                saveDc,
                dcSuccess: false,
            });

            promise.then((result) => {
                if (result.success === false) {
                    applyFrightenedToCreature(creature.name, saveDc, campaignName);

                    addExpiration(playerName, creature.name, [
                        { type: 'frightened', condition: 'frightened' },
                        { type: 'avenging_angel_aura' },
                    ], campaignName);

                    const currentTargets = getRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, campaignName) || [];
                    const newTargets = currentTargets.includes(creature.name)
                        ? currentTargets
                        : [...currentTargets, creature.name];
                    setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, newTargets, campaignName);

                    addEntry(campaignName, {
                        type: 'save_result',
                        characterName: playerName,
                        targetName: creature.name,
                        saveDc,
                        saveType: 'WIS',
                        success: false,
                        description: `${creature.name} failed WIS save. Frightened by Frightful Aura for 1 minute or until taking damage.`,
                    }).catch((e) => { console.error("[avengingAngel] Error:", e); });
                } else {
                    addEntry(campaignName, {
                        type: 'save_result',
                        characterName: playerName,
                        targetName: creature.name,
                        saveDc,
                        saveType: 'WIS',
                        success: true,
                        description: `${creature.name} succeeded on WIS save against Frightful Aura.`,
                    }).catch((e) => { console.error("[avengingAngel] Error:", e); });
                }
            }).catch((e) => { console.error("[avengingAngel] Error handling player save result:", e); });

            pendingPlayerSaves.push({ promptId, targetName: creature.name });
        }
    }

    await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, auraTargets, campaignName);
}

async function applyFrightenedToCreature(targetName, saveDc, campaignName) {
    const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    // Don't duplicate
    if (conditions.some(c => String(c).toLowerCase() === 'frightened')) return;
    setRuntimeValue(targetName, 'activeConditions', [...conditions, 'frightened'], campaignName);
}


/**
 * Check if a creature is affected by the Avenging Angel Frightful Aura.
 * Returns true if the creature failed the save and is within the aura.
 */
export function isAuraTarget(playerName, targetName, campaignName) {
    const auraTargets = getRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, campaignName) || [];
    return auraTargets.includes(targetName);
}

/**
 * Check if Avenging Angel is currently active for a player.
 */
export function isActive(playerName, campaignName) {
    return getRuntimeValue(playerName, AVENGING_ANGEL_KEY, campaignName) === true;
}

/**
 * Clean up the Avenging Angel Frightful Aura tracking list when a creature takes damage.
 * The actual Frightened condition removal is handled by the generic code in applyDamage.js.
 */
export async function cleanupAuraTargetOnDamage(playerName, targetName, campaignName) {
    const auraTargets = getRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, campaignName) || [];
    if (!auraTargets.includes(targetName)) return;

    const newTargets = auraTargets.filter(t => t !== targetName);
    await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, newTargets, campaignName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Frightened',
        reason: 'took damage (Frightful Aura)',
        timestamp: Date.now(),
    }).catch((e) => { console.error("[avengingAngel] Error:", e); });
}
