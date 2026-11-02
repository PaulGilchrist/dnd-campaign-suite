import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList, hasExplicitAllyList } from '../../../hooks/useAllySelection.js';

// Phase 3.2 betrayal gate (grantor-side, mirroring auraOfProtection): once a
// buff bearer has an EDITED ally list it only supports creatures on that list.
// Unedited bearers keep the legacy "party by type" default (zero behavior
// change until the tracker 🤝 Allies editor is used).
function bearerSupports(bearerName, attackerName) {
    return !hasExplicitAllyList(bearerName) || getAllyList(bearerName).includes(attackerName);
}

export async function getWolfAdvantageAgainst({ attackerName, campaignName, mapData, skipRangeCheck }) {
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
        const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
        const wolfBuff = Array.isArray(buffs) ? buffs.find(b => b.name === 'Rage of the Wilds' && b.optionName === 'Wolf') : null;
        if (!wolfBuff) continue;

        if (skipRangeCheck) {
            return { advantage: true, source: player.name };
        }

        const inRange = await isWithinRange(player.name, attackerName, 5);
        if (!inRange) continue;

        return { advantage: true, source: player.name };
    }
    return { advantage: false };
}
