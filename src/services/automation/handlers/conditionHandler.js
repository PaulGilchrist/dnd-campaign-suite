import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../logService.js';
import * as mapsService from '../../mapsService.js';
import { getCombatContext } from '../../damageUtils.js';
import { rangeToFeet } from '../../rangeValidation.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
    const chaBonus = cha?.bonus || 0;
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + prof + chaBonus;

    const conditionName = auto.condition || 'frightened';
    const saveType = auto.saveType || 'WIS';
    const rangeFeet = rangeToFeet(auto.range) || 60;

    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');

    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
             },
         };
     }

    const newCharges = currentCharges - 1;
    setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);

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

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} activated — ${saveType} save DC ${saveDc}, all targets within ${rangeFeet} ft.`,
     }).catch(() => {});

    return {
        type: 'modal',
        modalName: 'setCondition',
        payload: {
            combatSummary: cs,
            attackerName: playerStats.name,
            attackerPos,
            saveDc,
            campaignName,
            mapData,
            featureName: action.name,
            conditionName,
            saveType,
            rangeFeet,
         },
     };
}
