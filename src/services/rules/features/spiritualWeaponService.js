import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration, KEY } from '../effects/expirations.js';
import { parseDurationRounds } from '../effects/durationParser.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

// SP-112: Spiritual Weapon force record.
// The "floating, spectral force" is persisted as an activeBuff on the caster
// (sacredWeaponHandler precedent: buff + addExpiration 'remove_active_buff'),
// keyed by the spell name so existing consumers clean it up automatically:
//   - concentration loss → concentrationService.cleanupBuffsByName('Spiritual Weapon')
//   - combat-scoped    → until: 'combat' swept at a new initiative roll, short rest,
//                        or long rest (no-clock policy: authored >=1 minute never a
//                        round countdown — #1420)
// Token position is not grid-modeled (psychic teleportation pool-only precedent);
// the 5-ft-from-force gate goes through isWithinRange (gridless → lenient §7).

const FORCE_BUFF_NAME = 'Spiritual Weapon';
const FORCE_EFFECT = 'spiritual_weapon_force';
const FORCE_MARKER_NAME = 'Spiritual Weapon';
const MOVE_RANGE_FT = 20;
const ATTACK_RANGE_FT = 5;
const APPEARS_RANGE_FT = 60;

export function getSpiritualWeaponForce(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const buffs = Array.isArray(stored) ? stored : [];
    return buffs.find(b => b.name === FORCE_BUFF_NAME && b.effect === FORCE_EFFECT) || null;
}

// Drop any queued expiry from a previous force so it cannot kill this one
// (sacredWeaponHandler drop-the-queued-expiry pattern).
function dropQueuedForceExpiry(casterName, campaignName) {
    const expirations = getRuntimeValue(casterName, KEY, campaignName);
    if (!Array.isArray(expirations) || !expirations.length) return;
    const kept = expirations.filter(e => !(e.effects || []).some(ef => ef.type === 'remove_active_buff' && ef.buffName === FORCE_BUFF_NAME));
    if (kept.length !== expirations.length) {
        setRuntimeValue(casterName, KEY, kept, campaignName);
    }
}

function resolveSpiritualWeaponSlotLevel(spell, slotLevel) {
    return slotLevel || spell.level || 2;
}

function resolveSpiritualWeaponDamageFormula(formula) {
    return formula || '1d8 + 3';
}

function buildSpiritualWeaponForceBuff({ spell, forceMarkerName, appearsInRange, slotLevel, damageFormula, campaignName }) {
    return {
        name: FORCE_BUFF_NAME,
        effect: FORCE_EFFECT,
        spell: FORCE_BUFF_NAME,
        duration: spell.duration || 'Concentration, up to 1 minute',
        concentration: !!spell.concentration,
        slotLevel,
        damageFormula,
        damageType: spell.damage?.damage_type || 'Force',
        forceMarkerName,
        moveRangeFt: MOVE_RANGE_FT,
        attackRangeFt: ATTACK_RANGE_FT,
        appearsRangeFt: APPEARS_RANGE_FT,
        appearsInRange,
        activatedRound: getCurrentCombatRound(campaignName),
    };
}

export async function activateSpiritualWeaponForce(spell, playerStats, campaignName, { slotLevel, formula } = {}) {
    const casterName = playerStats.name;
    const forceMarkerName = `${FORCE_MARKER_NAME} (${casterName})`;

    dropQueuedForceExpiry(casterName, campaignName);

    // 60-ft appear gate: the force space itself has no token picker (grid picker
    // is unmodeled infrastructure); isWithinRange is consulted so the gate is
    // real against the armed target and lenient when gridless (§7).
    const cs = await getCombatContext(campaignName);
    const casterCreature = cs?.creatures?.find(c => c.name === casterName);
    const targetName = casterCreature?.targetName || null;
    const appearsInRange = targetName ? await isWithinRange(casterName, targetName, APPEARS_RANGE_FT) : true;

    const buff = buildSpiritualWeaponForceBuff({ spell, casterName, forceMarkerName, appearsInRange, slotLevel: resolveSpiritualWeaponSlotLevel(spell, slotLevel), damageFormula: resolveSpiritualWeaponDamageFormula(formula), campaignName });

    const stored = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const buffs = Array.isArray(stored) ? stored : [];
    await setRuntimeValue(casterName, 'activeBuffs', [...buffs.filter(b => b.name !== FORCE_BUFF_NAME), buff], campaignName);

    // #1420 falsy-zero law (fix#5/fix#58 family): parseDurationRounds DOCUMENTS 0
    // as the encounter-scoped marker (durationParser.js L9-10) and both disk rows
    // hit it ('1 minute' 5e spells.json:9331, 'Concentration, up to 1 minute' 2024
    // spells.json:12294). The old `parseDurationRounds(...) || DEFAULT` resurrected
    // a 10-round clock stamped EVERY cast — a fabricated minutes×10 countdown the
    // NO-CLOCK policy forbids (AGENTS.md: authored >=1 minute is combat-scoped,
    // cleared by a new initiative roll, short rest, or long rest). 0 now flows
    // lawful: rounds Infinity + until: 'combat' (zoneDurationClock.js:102 canonical;
    // initiative seam clearAllExpirationEffects also drains it unconditionally).
    // Unparseable/absent duration is LOUD (no-fallbacks, MA-1215 never-fabricate)
    // with no expiry armed — the initiative/rest cleanup still drops the buff.
    const parsedRounds = parseDurationRounds(spell.duration);
    const expiryEffects = [{ type: 'remove_active_buff', buffName: FORCE_BUFF_NAME }];
    if (parsedRounds === undefined) {
        console.error(`[spiritualWeaponService:duration-unparseable] "${spell.duration}" — no expiration armed (force drops at initiative/rest cleanup).`);
    } else if (parsedRounds === 0) {
        addExpiration({ attackerName: casterName, targetName: casterName, effects: expiryEffects, campaignName, rounds: Infinity, until: 'combat' });
    } else {
        addExpiration({ attackerName: casterName, targetName: casterName, effects: expiryEffects, campaignName, rounds: parsedRounds });
    }
    const lastsNote = parsedRounds === undefined
        ? 'Force lasts until concentration breaks or the next initiative roll.'
        : parsedRounds === 0
            ? 'Force is combat-scoped (authored 1 minute — no-clock policy): it lasts the whole combat, ended by a new initiative roll, a rest, or concentration breaking.'
            : `Force lasts until ${parsedRounds} rounds elapse or concentration breaks.`;

    addEntry(campaignName, {
        type: 'summons',
        characterName: casterName,
        summonName: FORCE_BUFF_NAME,
        summonSource: 'spell',
        description: `${casterName} casts ${FORCE_BUFF_NAME} (slot level ${buff.slotLevel}) — a floating spectral force appears within ${APPEARS_RANGE_FT} feet (${forceMarkerName}). ${lastsNote} ${targetName ? `Target within 5 ft of the force gate: ${appearsInRange ? 'checked' : 'out of range'}.` : 'No target armed — immediate melee spell attack skipped until a target is armed.'}`,
        summonedCreatures: [forceMarkerName],
        timestamp: Date.now(),
    }).catch((e) => { console.error('[spiritualWeaponService:cast-log-error]', e); });

    return buff;
}

export function buildSpiritualWeaponForceAttack(playerStats, force) {
    const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
    const wisMod = playerStats.spellAbilities?.modifier || 0;
    const damageFormula = force.damageFormula || '1d8 + 3';
    return {
        name: `${FORCE_BUFF_NAME}: Move & Attack`,
        attackType: 'spell',
        school: 'Evocation',
        isRanged: false,
        range: `${ATTACK_RANGE_FT}_ft`,
        toHit: spellAttackMod,
        hitBonus: spellAttackMod,
        hitBonusFormula: `To Hit Bonus = Wisdom Modifier (${wisMod}) + Proficiency (${playerStats.proficiency || 0})`,
        damage: damageFormula,
        damageType: 'Force',
        damageFormula: `Damage Formula = ${damageFormula} (Force)`,
        autoDamageFormula: damageFormula,
        autoDamageName: FORCE_BUFF_NAME,
        abilityName: 'Wisdom',
        actionType: 'Bonus Action',
        isSpiritualWeapon: true,
    };
}

async function resolveWeaponTarget(cs, casterName, campaignName) {
    const casterCreature = cs?.creatures?.find(c => c.name === casterName);
    if (casterCreature?.targetName) return casterCreature.targetName;
    const lastAttack = getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (lastAttack?.targetName && lastAttack.targetName !== casterName) {
        return lastAttack.targetName;
    }
    return null;
}

// 5-ft-from-force gate via isWithinRange (§7: gridless resolves lenient —
// the gate is consulted; once a token named like the force marker exists on
// the active map it becomes enforceable).
async function checkNearForce(targetName, force) {
    return isWithinRange(targetName, force.forceMarkerName || FORCE_MARKER_NAME, force.attackRangeFt || ATTACK_RANGE_FT);
}

export async function resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName) {
    const casterName = playerStats.name;
    const storedForce = getSpiritualWeaponForce(playerStats, campaignName);
    if (!storedForce) {
        return refusal(casterName, campaignName, `${casterName} has no active Spiritual Weapon force — cast Spiritual Weapon first.`);
    }
    // #1420 shared-reference law (fix#1536 family): a runtime-store read may hand
    // back the LIVE store object (fix#27 census: read-your-write keeps in-memory
    // identity), so `force.lastMoveRound = currentRound` mutated the STORE's buff
    // in place pre-clone — silent reference leak with no broadcast. CLONE FIRST
    // (house spread idiom, cf. the cloned-map write below), then mutate the clone.
    const force = { ...storedForce };

    const currentRound = getCurrentCombatRound(campaignName);
    if (force.lastMoveRound === currentRound) {
        return refusal(casterName, campaignName, `The Spiritual Weapon force has already moved and attacked this turn (${currentRound}).`);
    }

    const cs = await getCombatContext(campaignName);
    const targetName = await resolveWeaponTarget(cs, casterName, campaignName);
    if (!targetName) {
        return refusal(casterName, campaignName, `${casterName} has no target armed for the Spiritual Weapon attack — arm a target on the initiative card first.`);
    }

    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    if (targetCreature && (targetCreature.currentHp ?? 1) <= 0) {
        return refusal(casterName, campaignName, `${targetName} is dead — choose a living target within 5 feet of the force.`);
    }

    const nearForce = await checkNearForce(targetName, force);
    if (!nearForce) {
        return refusal(casterName, campaignName, `${targetName} is not within ${force.attackRangeFt || ATTACK_RANGE_FT} feet of the Spiritual Weapon force.`);
    }

    // Move up to 20 ft — pool-only model (no grid token consumer, psychic
    // teleportation precedent), logged as the force's movement. Latches the
    // CLONE only (#1420) — the store ref is never touched; persistence goes
    // through the cloned-map write below.
    force.lastMoveRound = currentRound;
    const stored = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const buffs = Array.isArray(stored) ? stored : [];
    await setRuntimeValue(casterName, 'activeBuffs', buffs.map(b => b.name === FORCE_BUFF_NAME ? { ...b, lastMoveRound: currentRound } : b), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: `${FORCE_BUFF_NAME}: Move & Attack`,
        description: `${casterName} moved the Spiritual Weapon force up to ${force.moveRangeFt || MOVE_RANGE_FT} feet and repeated the melee spell attack against ${targetName} (within ${force.attackRangeFt || ATTACK_RANGE_FT} ft of the force; range gate ${nearForce ? 'pass' : 'fail'}).`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[spiritualWeaponService:move-log-error]', e); });

    return { attack: buildSpiritualWeaponForceAttack(playerStats, force), targetName };
}

async function refusal(casterName, campaignName, message) {
    addEntry(campaignName, {
        type: 'automation',
        creatureName: casterName,
        name: `${FORCE_BUFF_NAME}: Move & Attack`,
        description: `spiritual_weapon_refused — ${message}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[spiritualWeaponService:refusal-log-error]', e); });
    return { refused: true, message };
}
