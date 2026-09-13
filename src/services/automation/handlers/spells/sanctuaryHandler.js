import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const SPELL_NAME = 'Sanctuary';
const EFFECT_KEY = 'sanctuary';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;
    const targetName = action.metaCtx?.targetName || 'Unknown';

    const saveDc = playerStats.spellAbilities?.saveDc || (() => {
        console.error('[sanctuary] Missing spellAbilities.saveDc for', playerStats.name, '— defaulting to 8. Proficiency:', playerStats.proficiency);
        return 8 + (playerStats.proficiency || 2);
    })();

    // Apply sanctuary target effect to campaign targetEffects
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === EFFECT_KEY && te.source === playerName
    );

    const sanctuaryEffect = {
        target: targetName,
        effect: EFFECT_KEY,
        source: playerName,
        duration: '1 minute',
        saveDc: saveDc,
    };

    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = sanctuaryEffect;
    } else {
        allTargetEffects.push(sanctuaryEffect);
    }

    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    // Expires on initiative roll (when warded target becomes active), short rest, long rest
    addExpiration({ attackerName: playerName, targetName, effects: [
        { type: 'remove_target_effect', effectKey: EFFECT_KEY, source: playerName },
    ], campaignName, rounds: undefined, expireOnCreatureName: targetName });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: SPELL_NAME,
        description: `${playerName} casts Sanctuary on ${targetName}. Creatures targeting ${targetName} with attacks or damaging spells must succeed on a WIS save or lose the attack/spell.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[sanctuary] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            targetName,
            automationType: auto.type,
            description: `${SPELL_NAME} activated on ${targetName} — creatures targeting ${targetName} with attacks or damaging spells must succeed on a WIS save or lose the attack/spell. Spell ends if ${targetName} attacks, casts a spell, or deals damage.`,
            automation: auto,
        },
    };
}

export function isSanctuaryActive(targetName, casterName, _campaignName) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    return allTargetEffects.some(
        te => te.target === targetName && te.effect === EFFECT_KEY && te.source === casterName
    );
}

export function endSanctuary(casterName, targetName, campaignName, reason) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = allTargetEffects.filter(
        te => !(te.target === targetName && te.effect === EFFECT_KEY && te.source === casterName)
    );
    if (filtered.length === allTargetEffects.length) return null;

    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);

    addEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Sanctuary',
        reason: 'Sanctuary ended',
        note: reason,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[sanctuary] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            targetName,
            description: `${targetName} is no longer warded by Sanctuary. ${reason}`,
        },
    };
}

export function getSanctuaryTarget(casterName, _campaignName) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const sanctuary = allTargetEffects.find(
        te => te.effect === EFFECT_KEY && te.source === casterName
    );
    return sanctuary ? sanctuary.target : null;
}
