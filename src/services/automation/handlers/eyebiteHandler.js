import { buildSaveDc } from '../common/savePrompt.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import { rangeToFeet } from '../../rules/combat/rangeValidation.js';

const EFFECT_OPTIONS = [
    { key: 'asleep', label: 'Asleep', condition: 'unconscious' },
    { key: 'panicked', label: 'Panicked', condition: 'frightened' },
    { key: 'sickened', label: 'Sickened', condition: 'poisoned' },
];

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const saveDc = buildSaveDc(auto, playerStats);
    const rangeFeet = rangeToFeet(auto.range) || 60;

    const cs = await getCombatContext(campaignName);

    let attackerPos = null;
    let mapData = null;
    if (mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, mapName);
            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (attackerPlayer) {
                attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
            }
        } catch { /* positions unavailable */ }
    }

    return {
        type: 'modal',
        modalName: 'eyebiteEffect',
        payload: {
            combatSummary: cs,
            attackerName: playerStats.name,
            attackerPos,
            saveDc,
            campaignName,
            mapData,
            featureName: action.name,
            rangeFeet,
            durationRounds: 10,
        },
    };
}

export function getEffectOptions() {
    return EFFECT_OPTIONS;
}
