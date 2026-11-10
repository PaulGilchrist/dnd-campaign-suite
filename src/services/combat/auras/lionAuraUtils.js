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

// Name-keyed Lion-stamp lookup — shared by the bearer scan below and the
// target-exemption predicate ("another Barbarian who has this option active").
function lionBuffForName(name, campaignName) {
    const buffs = getRuntimeValue(name, 'activeBuffs', campaignName) || [];
    return Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
}

function lionBuffFor(player, campaignName) {
    return lionBuffForName(player.name, campaignName);
}

// Clause's second axis (bug-lion-aura-second-barbarian-exemption-missing):
// Power of the Wilds (Lion) RAW (2024 classes.json, Path of the Beast) reads
// "…Disadvantage on attack rolls against targets other than you OR ANOTHER
// BARBARIAN WHO HAS THIS OPTION ACTIVE" — a target carrying its own Lion
// stamp is exempt from EVERY bearer's aura, not just the bearer-self skip.
// The activeBuffs optionName==='Lion' entry is the engine's only runtime
// proxy for the option (produced solely by the Path of the Beast stance
// lane, so stamp presence is sufficient — rig doctrine). A null/omitted
// targetName stays lenient (no exemption), same law as the bearer-self skip.
// Extracted predicate: getLionDisadvantageAgainst sits at the module's
// complexity ceiling (bug-file census), mirroring the sibling per-axis
// predicate extractions (attackerIsEnemyOfBearer above, wolf's
// targetIsEnemyOfBearer in wolfAuraUtils.js).
function targetIsExemptFromLionAuras(targetName, campaignName) {
    return Boolean(targetName) && Boolean(lionBuffForName(targetName, campaignName));
}

// Buff-declared range in feet: parseInt(buff.range) with NaN/falsy collapse to
// 5 (garbage strings like 'unlimited' and 0 measure at 5 ft — pinned in
// lionAuraUtils.test.js 'buff range %o measures at %i ft'). Extracted to keep
// getLionDisadvantageAgainst at the module's complexity-15 ceiling.
function lionRangeFeet(lionBuff) {
    return parseInt(lionBuff.range || '5 ft') || 5;
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
    // wolfAuraUtils.getWolfAdvantageAgainst. Monster-card attack rolls are
    // fed here too (MonsterCardModal.resolveMonsterLionAura, bug-monster-
    // attack-lane-never-consults-rage-auras), so the "monster attacker still
    // gets the Disadvantage" doctrine is live on both roller lanes.
    const partyNames = new Set(allCreatures.map(c => c.name));

    // Exempt target (a Lion-option holder itself) — one name-keyed read covers
    // every bearer, so it runs before the scan (bug-lion-aura-second-barbarian-
    // exemption-missing closing the orphaned NOTE deferral below).
    if (targetIsExemptFromLionAuras(targetName, campaignName)) return { disadvantage: false };

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
        // law fix#39 refuses nameless players). The clause's second axis
        // ("or another Barbarian who has this option active") is handled by
        // the target-holder exemption before the loop — the deferral NOTE that
        // used to sit here is now implemented (bug-lion-aura-second-barbarian-
        // exemption-missing).
        if (player.name === targetName) continue;
        const lionBuff = lionBuffFor(player, campaignName);
        if (!lionBuff) continue;

        const rangeNum = lionRangeFeet(lionBuff);

        if (skipRangeCheck) {
            return { disadvantage: true, source: player.name };
        }

        const inRange = await isWithinRange(player.name, attackerName, rangeNum);
        if (!inRange) continue;

        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
