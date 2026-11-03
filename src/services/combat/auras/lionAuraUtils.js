import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList, hasExplicitAllyList } from '../../../hooks/useAllySelection.js';

// Attacker-hostility gate (bug-lion-aura-penalizes-allies-not-just-enemies,
// owner ruling 2026-11-03 prose parity, mirroring the Wolf rewrite's
// targetIsEnemyOfBearer on its own axis): Power of the Wilds (Lion) RAW reads
// "any of YOUR ENEMIES within 5 feet of you have Disadvantage on attack rolls
// against targets other than you" — so the ATTACKER must be an enemy of the
// bearer. The bearer's unedited default treats party tokens as allies and
// NPC/monster tokens as enemies (legacy party-by-type split, same doctrine as
// the wolf gate and the OA betrayal gate); an EDITED ally-list bearer treats
// everyone off its list as an enemy (betrayal direction, wolf precedent — the
// aura is a DEBUFF on the attacker, so hostility, not grantor support, rules).
function attackerIsEnemyOfBearer(bearerName, attackerName, partyNames) {
    if (hasExplicitAllyList(bearerName)) return !getAllyList(bearerName).includes(attackerName);
    return !partyNames.has(attackerName);
}

function lionBuffFor(player, campaignName) {
    const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
    return Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
}

export async function getLionDisadvantageAgainst({ attackerName, targetName, campaignName, mapData, skipRangeCheck }) {
    let allCreatures = [];
    if (mapData) {
        allCreatures = mapData.players?.length ? mapData.players : [];
    } else {
        const combatSummary = await getCombatContext(campaignName);
        allCreatures = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }

    // Legacy ally set for the unedited-bearer split: on the map lane these are
    // the party tokens in players[] (NPC/monster tokens live in placedItems[],
    // never here, so a monster attacker is off the party set and still gets
    // the Disadvantage); on the gridless lane the candidate list is already
    // the combat-summary party filtered to type 'player'. Same census as
    // wolfAuraUtils.getWolfAdvantageAgainst.
    const partyNames = new Set(allCreatures.map(c => c.name));

    for (const player of allCreatures) {
        if (player.name === attackerName) continue;
        // Lion's DEBUFF lands on the attacking creature — only the bearer's
        // enemies pay it (attackerIsEnemyOfBearer, wolf-mirrored doctrine).
        if (!attackerIsEnemyOfBearer(player.name, attackerName, partyNames)) continue;
        // Power of the Wilds (Lion) RAW: enemies have Disadvantage "on attack
        // rolls against targets other than you" — an attack aimed AT the bearer
        // itself is exempt. Same per-bearer skip shape as the attacker check
        // above and the taunting_step gate (conditionEffects.js:869); a null
        // targetName stays lenient (bearers always carry a name — drop-seam
        // law fix#39 refuses nameless players).
        // NOTE: the full clause also exempts "another Barbarian who has this
        // option active"; that second axis needs a scan for other Lion-buff
        // holders matching the target and is deferred (see bug file).
        if (player.name === targetName) continue;
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
