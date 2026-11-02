import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList, hasExplicitAllyList } from '../../../hooks/useAllySelection.js';

// Phase 3.2 betrayal gate (grantor-side, mirroring auraOfProtection): once a
// buff bearer has an EDITED ally list it only supports creatures on that list.
// Unedited bearers keep the legacy "party by type" default.
function bearerSupports(bearerName, attackerName) {
    return !hasExplicitAllyList(bearerName) || getAllyList(bearerName).includes(attackerName);
}

function lionBuffFor(player, campaignName) {
    const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
    return Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
}

export async function getLionDisadvantageAgainst({ attackerName, campaignName, mapData, skipRangeCheck }) {
    let allCreatures = [];
    if (mapData) {
        allCreatures = mapData.players?.length ? mapData.players : [];
    } else {
        const combatSummary = await getCombatContext(campaignName);
        allCreatures = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }

    for (const player of allCreatures) {
        if (player.name === attackerName) continue;
        if (!bearerSupports(player.name, attackerName)) continue;
        const lionBuff = lionBuffFor(player, campaignName);
        if (!lionBuff) continue;

        const range = lionBuff.range || '5 ft';
        const rangeNum = parseInt(range) || 5;

        if (skipRangeCheck) {
            return { disadvantage: true, source: player.name };
        }

        const inRange = await isWithinRange(player.name, attackerName, rangeNum);
        if (!inRange) continue;

        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
