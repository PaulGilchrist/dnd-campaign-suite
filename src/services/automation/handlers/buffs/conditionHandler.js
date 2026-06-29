import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

function buildSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') {
        const ability = auto.saveAbility || 'WIS';
        const abilityBonus = getAbilityModifier(playerStats.abilities, ability);
        const prof = playerStats.proficiency || 0;
        return 8 + abilityBonus + prof;
    }
    if (auto.saveDc) return auto.saveDc;
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const wisBonus = wis?.bonus || 0;
    const prof = playerStats.proficiency || 0;
    return 8 + wisBonus + prof;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const saveDc = buildSaveDc(auto, playerStats);
    const conditionName = auto.condition || 'frightened';
    const additionalCondition = auto.additionalCondition || null;
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

    let monsters = [];
    try {
        monsters = await loadMonsters();
    } catch { /* monsters unavailable */ }

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
            monsters,
            channelDivinityCharges: currentCharges,
            featureName: action.name,
            conditionName,
            additionalCondition,
            saveType,
            rangeFeet,
            durationRounds: (() => {
                const lower = (auto.duration || '').toLowerCase();
                if (lower.startsWith('1_minute')) return 10;
                const match = lower.match(/(\d+)_round/);
                if (match) return parseInt(match[1], 10);
                return undefined;
            })(),
         },
     };
}
