import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const HOLY_AURA_TARGETS_KEY = 'holyAuraTargets';
const HOLY_AURA_BUFF_NAME = 'Holy Aura';

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

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'holy_aura_target_selection',
            name: action.name,
            creatureTargets,
            automation: action.automation || {},
        },
    };
}

export async function applyHolyAura(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const auto = action.automation || {};
    const casterName = playerStats.name;
    const appliedTargets = [];
    const spellSaveDc = playerStats.spellAbilities?.saveDc || 8 + playerStats.proficiency;

    setRuntimeValue(casterName, 'holyAuraSaveDc', spellSaveDc, campaignName);

    for (const targetName of targetNames) {
        const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const existingAura = buffs.some(b => b.name === HOLY_AURA_BUFF_NAME);
        if (!existingAura) {
            buffs.push({
                name: HOLY_AURA_BUFF_NAME,
                effect: 'holy_aura',
                duration: 'Concentration, up to 1 minute',
                sourceCharacter: casterName,
                auraRange: auto.auraRange || 30,
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        // Register targetEffect for badge display on CreatureCard
        registerTargetEffect(campaignName, targetName, 'holy_aura', casterName);

        addExpiration({ attackerName: casterName, targetName, effects: [
            { type: 'remove_active_buff', buffName: HOLY_AURA_BUFF_NAME }
        ], campaignName, rounds: undefined, expireOnCreatureName: casterName });

        appliedTargets.push(targetName);

        await addEntry(campaignName, {
            type: 'spell_effect',
            characterName: casterName,
            spellName: action.name,
            targetName,
            effects: ['Advantage on all saving throws', 'Other creatures have Disadvantage on attack rolls against them'],
            timestamp: Date.now(),
        }).catch((e) => { console.error('[holyAura] Error:', e); });
    }

    const combatSummary = getCombatSummary(campaignName);
    addConcentration(combatSummary, casterName, 'Holy Aura', spellSaveDc);

    const targetList = appliedTargets.join(', ');
    setRuntimeValue(casterName, HOLY_AURA_TARGETS_KEY, appliedTargets, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `<b>${targetList}</b> gained Advantage on saving throws and other creatures have Disadvantage on attack rolls against them. Fiends and Undead that hit an affected creature with a melee attack must succeed on a CON saving throw or be Blinded until the end of their next turn.`,
            automation: auto,
            targetCount: appliedTargets.length,
            targetNames: appliedTargets,
        },
    };
}

export function getHolyAuraTargets(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, HOLY_AURA_TARGETS_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

export function isHolyAuraActive(targetName, playerName, campaignName) {
    const targets = getHolyAuraTargets(playerName, campaignName);
    return targets.includes(targetName);
}
