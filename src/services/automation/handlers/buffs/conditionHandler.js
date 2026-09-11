import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import * as mapsService from '../../../maps/mapsService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { buildSaveDc } from '../../../automation/common/savePrompt.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const isChannelDivinity = auto.resourceCost === 'channel_divinity' || /channel divinity/i.test(String(auto.cost || ''));
    const gatedByChannelDivinityCharges = isChannelDivinity || auto.type === 'channel_divinity';
    const autoWithDefaults = {
        ...auto,
        saveDc: auto.saveDc || 'ability',
        saveAbility: auto.saveAbility || (isChannelDivinity ? 'CHA' : 'WIS'),
    };
    const saveDc = buildSaveDc(autoWithDefaults, playerStats);
    const conditionName = auto.condition || 'frightened';
    const additionalCondition = auto.additionalCondition || null;
    const saveType = auto.saveType || 'WIS';
    const rangeFeet = rangeToFeet(auto.range) || 60;

    const chaMod = getAbilityModifier(playerStats.abilities, 'CHA');
    // CLA-303: RAW Turn Undead targets all chosen undead in range — data opts out
    // of the Abjure-Foes CHA cap via maxTargets:"all".
    const maxTargets = auto.maxTargets === 'all' ? Infinity : Math.max(1, chaMod);
    const maxTargetsText = Number.isFinite(maxTargets) ? maxTargets : 'all';

    const currentCharges = resolveChannelDivinityCharges(playerStats);

    if (gatedByChannelDivinityCharges && currentCharges <= 0) {
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
    if (_mapName) {
        try {
            mapData = await mapsService.loadMapData(campaignName, _mapName);
            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (attackerPlayer) {
                attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
             }
           } catch (error) { console.warn('[conditionHandler] Attacker position unavailable:', error); }
     }

    let monsters = [];
    try {
        monsters = await loadMonsters();
    } catch (error) { console.error('[conditionHandler] Monsters unavailable:', error); }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} activated — ${saveType} save DC ${saveDc}, up to ${maxTargetsText} targets within ${rangeFeet} ft.`,
     }).catch((e) => { console.error("[conditionHandler:log-error]", e); });

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
            channelDivinityCharges: gatedByChannelDivinityCharges ? currentCharges : null,
            featureName: action.name,
            conditionName,
            additionalCondition,
            saveType,
            rangeFeet,
            maxTargets,
            durationRounds: resolveDurationRounds(auto),
         },
     };
}

function resolveChannelDivinityCharges(playerStats) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    return storedCharges != null ? Number(storedCharges) : maxCharges;
}

function resolveDurationRounds(auto) {
    const lower = (auto.duration || '').toLowerCase();
    if (lower.startsWith('1_minute')) return 10;
    if (lower.startsWith('until_end_of_next_turn')) return 2;
    const match = lower.match(/(\d+)_round/);
    if (match) return parseInt(match[1], 10);
    return undefined;
}
