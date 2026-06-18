import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

import { rollD20 } from '../../../dice/diceRoller.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';

const AVENGING_ANGEL_KEY = 'avengingAngelActive';
const AVENGING_ANGEL_AURA_KEY = 'avengingAngelAuraTargets';

function buildSaveDc(playerStats) {
    const chaBonus = getAbilityModifier(playerStats.abilities, 'Charisma');
    const prof = playerStats.proficiency || 0;
    return 8 + chaBonus + prof;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already active
    const isActive = getRuntimeValue(playerName, AVENGING_ANGEL_KEY, campaignName);
    if (isActive) {
        // Toggle off - remove all avenging angel effects
        await setRuntimeValue(playerName, AVENGING_ANGEL_KEY, false, campaignName);

        // Remove fly speed buff
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const newBuffs = activeBuffs.filter(b => b.name !== action.name && b.effect !== 'avenging_angel_flight');
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

        // Clear aura targets
        await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, [], campaignName);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} ended.`,
            timestamp: Date.now(),
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended.`,
                automation: auto,
            },
        };
    }

    // Activate
    await setRuntimeValue(playerName, AVENGING_ANGEL_KEY, true, campaignName);

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
    }).catch(() => {});

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

    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures) return;

    const auraTargets = [];
    const npcResults = [];
    const playerPrompts = [];

    for (const creature of cs.creatures) {
        if (creature.name === playerName) continue;

        // Check if creature is in aura range (no map = all in range)
        // For now, apply to all non-self creatures (range check handled by aura context)
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
                // Apply frightened condition
                applyFrightenedToCreature(creature, saveDc);
                auraTargets.push(creature.name);

                // Add expiration - 1 minute (10 rounds) or until taking damage
                addExpiration(playerName, creature.name, [
                    { type: 'frightened', condition: 'frightened' },
                    { type: 'avenging_angel_aura' },
                ], campaignName, 10);
            }

            npcResults.push({ targetName: creature.name, success, roll: roll1, total, saveBonus });
        } else {
            // Player - send save prompt
            const promptId = utils.guid();
            sendSaveResult(campaignName, creature.name, {
                promptId,
                success: false,
                roll: 0,
                total: 0,
                saveBonus: 0,
                rawRolls: [],
            });
            playerPrompts.push({ promptId, targetName: creature.name });
            auraTargets.push(creature.name);
        }
    }

    // Store affected targets for the aura
    await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, auraTargets, campaignName);
}

function applyFrightenedToCreature(creature, saveDc) {
    const conditions = creature.conditions || [];
    // Don't duplicate
    if (conditions.some(c => c.key === 'frightened')) return;

    conditions.push({
        id: utils.guid(),
        key: 'frightened',
        label: 'Frightened',
        dc: saveDc,
        ability: 'wisdom',
        source: 'Avenging Angel',
    });
    creature.conditions = conditions;
}

export async function handleSaveResult(event) {
    const detail = event.detail;
    if (!detail || !detail.promptId) return;

    // This is a placeholder for handling player save results
    // The actual handling is done in SetConditionModal pattern
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
 * Remove Frightened condition from aura targets when they take damage.
 */
export async function removeFrightenedOnDamage(playerName, targetName, campaignName) {
    const auraTargets = getRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, campaignName) || [];
    if (!auraTargets.includes(targetName)) return;

    // Remove frightened condition from the creature in combat context
    const cs = await getCombatContext(campaignName);
    if (cs && cs.creatures) {
        const creature = cs.creatures.find(c => c.name === targetName);
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c.key !== 'frightened');
            setRuntimeValue(campaignName, 'combatContext', cs, campaignName);
        }
    }

    // Remove from aura targets
    const newTargets = auraTargets.filter(t => t !== targetName);
    await setRuntimeValue(playerName, AVENGING_ANGEL_AURA_KEY, newTargets, campaignName);
}
