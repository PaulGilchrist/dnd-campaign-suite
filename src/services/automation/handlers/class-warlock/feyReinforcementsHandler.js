import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

// CLA-138: the arm stamps the latch AT usesMax (the working CLA-133 shape) —
// decrementing at arm stamped 0 for once-per-LR features, and the cast-time
// auth (spellPreparationService.checkFreeCastEntry) demands the same latch >0,
// so the free cast was dead on arrival and the slot was consumed anyway.
// The spell row consumes the latch (consumeActionFreeCastCounters), logs the
// consumption, and honors the arm-time no-Concentration choice
// (_Fey_Reinforcements_noConcentration) stamped here.
export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Fey Reinforcements';

    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'feyReinforcements',
        payload: {
            action,
            playerStats,
            campaignName,
            noConcentrationOption: true,
        },
    };
}

export async function confirmFeyReinforcement(action, playerStats, campaignName, noConcentration) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Fey Reinforcements';
    const featureKeyPrefix = `_${featureName.replace(/\s+/g, '_')}`;

    const freeCastCountKey = `${featureKeyPrefix}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    // Arm the latch at usesMax — the free cast is consumed by the spell row at
    // CAST time (spellPreparationService), never at arm time.
    const usesMax = auto.usesMax ?? currentCount;
    await setRuntimeValue(playerName, freeCastCountKey, usesMax, campaignName);
    // CLA-138: the no-Concentration checkbox is a runtime write, not popup
    // cosmetics — consumed with the free cast, null re-armed by Long Rest.
    await setRuntimeValue(playerName, `${featureKeyPrefix}_noConcentration`, noConcentration === true, campaignName);

    const spellName = auto.spell || 'Summon Fey';
    const noConcNote = noConcentration ? ' Concentration skipped — duration 1 minute.' : '';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        spellName: spellName,
        note: `${featureName}: ${spellName} free cast armed — no spell slot and no Material components consumed.${noConcNote} ${usesMax} free cast${usesMax === 1 ? '' : 's'} available until your next Long Rest.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[feyReinforcementsHandler:log-error]', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: ${spellName} free cast armed (${usesMax} free cast${usesMax === 1 ? '' : 's'} available).${noConcNote}<br/><br/><em>Open your spell sheet and cast ${spellName} normally — no spell slot will be consumed.</em>`,
            automation: auto,
        },
    };
}
