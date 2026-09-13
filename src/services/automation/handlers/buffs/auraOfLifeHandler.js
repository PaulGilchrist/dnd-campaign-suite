import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const AURA_OF_LIFE_BUFF_NAME = 'Aura of Life';
const AURA_OF_LIFE_HP_PROTECT_KEY = 'auraOfLifeHpMaxProtected';

export async function handle(action, playerStats, campaignName, _mapName) {
    const combatSummary = await getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    // Include ALL creatures including the caster
    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            creatureTargets,
            maxTargets: 5,
            automation: action.automation || {},
        },
    };
}

export async function applyAuraOfLife(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const auto = action.automation || {};
    const casterName = playerStats.name;
    const appliedTargets = [];

    for (const targetName of targetNames) {
        // Add activeBuffs entry with necrotic resistance
        const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const existingAura = buffs.some(b => b.name === AURA_OF_LIFE_BUFF_NAME);
        if (!existingAura) {
            buffs.push({
                name: AURA_OF_LIFE_BUFF_NAME,
                effect: 'aura_of_life',
                duration: 'Concentration, up to 1 minute',
                sourceCharacter: casterName,
                resistanceTypes: ['Necrotic'],
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        // Set HP max protection flag
        setRuntimeValue(targetName, AURA_OF_LIFE_HP_PROTECT_KEY, true, campaignName);

        // Add turn start heal effect to target's turnStartEffects
        const storedTurnEffects = getRuntimeValue(targetName, 'turnStartEffects', campaignName) || [];
        if (!storedTurnEffects.some(e => e.type === 'aura_of_life_turn_start_heal')) {
            const newTurnEffects = [...storedTurnEffects, { type: 'aura_of_life_turn_start_heal', name: AURA_OF_LIFE_BUFF_NAME }];
            setRuntimeValue(targetName, 'turnStartEffects', newTurnEffects, campaignName);
        }

        // Register targetEffect for badge display on CreatureCard
        registerTargetEffect(campaignName, targetName, 'aura_of_life', casterName);

        // Register expirations: remove buff and HP protection on initiative roll
        addExpiration({ attackerName: casterName, targetName, effects: [
            { type: 'remove_active_buff', buffName: AURA_OF_LIFE_BUFF_NAME },
            { type: 'aura_of_life_hp_protection_end' },
        ], campaignName, rounds: undefined, expireOnCreatureName: casterName });

        // Add concentration for caster
        const combatSummary = getCombatSummary(campaignName);
        addConcentration(combatSummary, casterName, 'Aura of Life', 10 + Math.floor(playerStats.concentrationBonus || 0));

        appliedTargets.push(targetName);

        // Log to campaign
        await addEntry(campaignName, {
            type: 'spell_effect',
            characterName: casterName,
            spellName: action.name,
            targetName,
            effects: ['Resistance to Necrotic damage', 'HP maximum can\'t be reduced', 'Regains 1 HP at start of turn if at 0 HP'],
            timestamp: Date.now(),
        }).catch((e) => { console.error('[auraOfLife] Error:', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${appliedTargets.length} target(s) gained resistance to Necrotic damage, HP maximum protection, and 1 HP healing at start of turn from ${action.name}.`,
            automation: auto,
        },
    };
}

export function isAuraOfLifeActive(targetName, campaignName) {
    const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return buffs.some(b => b.name === AURA_OF_LIFE_BUFF_NAME && b.effect === 'aura_of_life');
}
