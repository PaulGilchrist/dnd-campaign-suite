import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const CIRCLE_OF_POWER_BUFF_NAME = 'Circle of Power';

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

export async function applyCircleOfPower(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const auto = action.automation || {};
    const casterName = playerStats.name;
    const appliedTargets = [];

    for (const targetName of targetNames) {
        // Add activeBuffs entry with circle of power effect
        const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const existingAura = buffs.some(b => b.name === CIRCLE_OF_POWER_BUFF_NAME);
        if (!existingAura) {
            buffs.push({
                name: CIRCLE_OF_POWER_BUFF_NAME,
                effect: 'circle_of_power',
                duration: 'Concentration, up to 10 minutes',
                sourceCharacter: casterName,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        // Register targetEffect for badge display on CreatureCard
        registerTargetEffect(campaignName, targetName, 'circle_of_power', casterName);

        // Register expirations: remove buff on initiative roll (concentration expiry)
        addExpiration({ attackerName: casterName, targetName, effects: [
            { type: 'remove_active_buff', buffName: CIRCLE_OF_POWER_BUFF_NAME },
        ], campaignName, rounds: undefined, expireOnCreatureName: casterName });

        // Add concentration for caster
        const combatSummary = getCombatSummary(campaignName);
        addConcentration(combatSummary, casterName, 'Circle of Power', 10 + Math.floor(playerStats.concentrationBonus || 0));

        appliedTargets.push(targetName);

        // Log to campaign
        await addEntry(campaignName, {
            type: 'spell_effect',
            characterName: casterName,
            spellName: action.name,
            targetName,
            effects: ['Advantage on saving throws against spells and other magical effects', 'No damage on a successful save vs half-damage effects'],
            timestamp: Date.now(),
        }).catch((e) => { console.error('[circleOfPower] Error:', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${appliedTargets.length} target(s) gained advantage on saving throws and no damage on successful saves from ${action.name}.`,
            automation: auto,
        },
    };
}

export function isCircleOfPowerActive(targetName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return storedEffects.some(te => te.effect === 'circle_of_power' && te.target === targetName);
}
