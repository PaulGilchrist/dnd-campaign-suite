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

function wolfBuffFor(player, campaignName) {
    const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
    return Array.isArray(buffs) ? buffs.find(b => b.name === 'Rage of the Wilds' && b.optionName === 'Wolf') : null;
}

// Target-side betrayal gate (owner ruling 2026-11-03, prose parity): the Wolf
// benefit reads "advantage … against any enemy of yours within 5 feet of you
// [the bearer]" — the bearer's unedited default treats party PCs as allies and
// NPC/monster tokens as enemies (legacy party-by-type split, same as the OA
// betrayal gate); an EDITED ally-list bearer distrusts everyone off its list.
function targetIsEnemyOfBearer(bearerName, targetName, partyNames) {
    if (hasExplicitAllyList(bearerName)) return !getAllyList(bearerName).includes(targetName);
    return !partyNames.has(targetName);
}

// Prose target axis (replaces the old bearer↔ATTACKER proximity check): the
// TARGET must be the bearer's enemy within 5 ft of the bearer, measured via
// isWithinRange (names — the map lane gates the measured path on a resolved
// targetPos, so a live target is name-resolvable on the active map). The
// bearer is never its own enemy (self-target exempt, same per-bearer skip
// shape as the lion self-target gate and coronaAuraUtils.js). A null
// targetName (phantom/tokenless target) CANNOT be gated — it stays lenient
// and grants unmeasured rather than fabricating a refusal (house law §44).
// skipRangeCheck keeps the gridless convention: enemy gate applies, distance
// goes unmeasured.
async function targetPassesWolfAxis(bearerName, targetName, partyNames, skipRangeCheck) {
    if (targetName == null) return true;
    if (bearerName === targetName) return false;
    if (!targetIsEnemyOfBearer(bearerName, targetName, partyNames)) return false;
    if (skipRangeCheck) return true;
    return await isWithinRange(bearerName, targetName, 5);
}

export async function getWolfAdvantageAgainst({ attackerName, targetName, campaignName, mapData, skipRangeCheck }) {
    let allCreatures = [];
    if (mapData) {
        allCreatures = mapData.players?.length ? mapData.players : [];
    } else {
        const combatSummary = await getCombatContext(campaignName);
        allCreatures = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }
    // Legacy ally set for the unedited-bearer split: on the map lane these are
    // the party tokens in players[] (NPC/monster tokens live in placedItems[],
    // never here); on the gridless lane the candidate list is already the
    // combat-summary party filtered to type 'player'.
    const partyNames = new Set(allCreatures.map(c => c.name));

    for (const player of allCreatures) {
        if (player.name === attackerName) continue;
        if (!wolfBuffFor(player, campaignName)) continue;
        if (!bearerSupports(player.name, attackerName)) continue;
        if (await targetPassesWolfAxis(player.name, targetName, partyNames, skipRangeCheck)) {
            return { advantage: true, source: player.name };
        }
    }
    return { advantage: false };
}
