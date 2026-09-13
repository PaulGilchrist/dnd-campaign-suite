import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

const AMF_EFFECT = 'antimagic_field';
const AMF_BUFF_NAME = 'Antimagic Field';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const casterName = playerStats.name;
    const buffName = action.name;
    const selectedCreatures = action.metaCtx?.creatures || [];

    const { wasActive } = toggleBuff(
        casterName,
        buffName,
        { ...auto, effect: 'antimagic_field' },
        campaignName
    );

    if (!wasActive) {
        const combatSummary = getCombatSummary(campaignName);
        if (combatSummary) {
            const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
            addConcentration(combatSummary, casterName, 'Antimagic Field', concentrationDc);
            storage.set('combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }

        addExpiration({ attackerName: casterName, targetName: casterName, effects: [
            { type: 'remove_active_buff', buffName }
        ], campaignName });

        await applyAntimagicField(selectedCreatures, casterName, campaignName);

        const creatureList = selectedCreatures.join(', ');
        const popupDescription = selectedCreatures.length > 0
            ? `${buffName} activated — a 10-foot Emanation surrounds you. No magic works here, only weapon attacks.<br>Creatures affected: ${creatureList}`
            : `${buffName} activated — no creatures selected.`;

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: buffName,
                automationType: auto.type,
                description: popupDescription,
                automation: auto,
            },
        };
    } else {
        await removeAntimagicField(casterName, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: buffName,
                description: `${buffName} ended`,
            },
        };
    }
}

async function applyAntimagicField(creatures, casterName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = [...storedEffects];
    let affectedCount = 0;

    for (const creatureName of creatures) {
        const existingIndex = effects.findIndex(
            te => te.target === creatureName && te.effect === AMF_EFFECT && te.source === casterName
        );
        const amfEffect = {
            target: creatureName,
            effect: AMF_EFFECT,
            source: casterName,
            duration: 'concentration',
        };
        if (existingIndex >= 0) {
            effects[existingIndex] = amfEffect;
        } else {
            effects.push(amfEffect);
        }

        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: AMF_BUFF_NAME,
            description: `${creatureName} is affected by Antimagic Field.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[antimagicFieldHandler:log-error]", e); });
        affectedCount++;
    }

    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: AMF_BUFF_NAME,
        description: `${casterName} casts Antimagic Field! ${affectedCount} creature(s) affected. Only weapon attacks allowed.`,
    }).catch((e) => { console.error("[antimagicFieldHandler:log-error]", e); });
}

async function removeAntimagicField(casterName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const affectedCreatures = storedEffects
        .filter(te => te.effect === AMF_EFFECT && te.source === casterName)
        .map(te => te.target);

    const filtered = storedEffects.filter(
        te => !(te.effect === AMF_EFFECT && te.source === casterName)
    );
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);

    if (affectedCreatures.length > 0) {
        await addEntry(campaignName, {
            type: 'automation',
            creatureName: casterName,
            name: AMF_BUFF_NAME,
            description: `Antimagic Field ended. Affected creatures: ${affectedCreatures.join(', ')}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[antimagicFieldHandler:log-error]", e); });
    }
}

export function isAntimagicFieldActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === AMF_BUFF_NAME && b.effect === 'antimagic_field');
}

export function isCreatureAffectedByAntimagicField(creatureName, _campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    return effects.some(te => te.target === creatureName && te.effect === AMF_EFFECT);
}

export { applyAntimagicField, removeAntimagicField };
