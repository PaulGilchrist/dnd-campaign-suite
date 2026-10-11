// MA-1842: Apep Constrict — ongoing start-of-turn grapple damage tick.
// The MA-0010 hit-clause producer (handlePlainDamage.applyGrappleOngoingDamageClause)
// arms the registered `constrict_grapple` te on a Grappled hit of a row that
// authors grapple_ongoing_damage:{dice,damage_type} ("takes 18 (4d8)
// Bludgeoning damage at the start of every turn until released", RAW Rise of
// the Runelords Apep). This consumer is the MA-0367 infernal-wound /
// MA-0610 whirlwind turn-start seam twin: te-keyed recurring HP loss at the
// ACTIVE creature's turn start, BEFORE the playerStats guard in
// turnStartEffects.js so PC AND monster victims tick alike. Release choke
// points (the RAW "until released"): the tick STOPS when the Grappled
// condition is cleared — escape-badge save vs the stamped escape_dc (MA-0010
// seam), a rest, or GM removal — and when the grappler is dead in
// combatSummary; either way the te is stripped with a release log so the
// marker never outlives the grapple. Untyped direct-HP shape
// (grapple_damage / infernalWoundService precedent —
// computeDamageAfterResistances throws on empty damageTypes); the damage-type
// label is honest copy in the roll/hp_change logs. A rounds:100 backstop
// clock (granted by the producer) prunes the marker if neither choke point
// is ever observed (§343 expiration clocks). Complexity cap split per §45.

import { cloneDeep } from 'lodash';
import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';

export const CONSTRICT_GRAPPLE_TE = 'constrict_grapple';

function hasGrappled(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    return Array.isArray(stored) && stored.some(c => String(c).toLowerCase() === 'grappled');
}

function resolveVictimMaxHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0);
    return Number(csCreature.maxHp ?? 0);
}

function resolveVictimCurrentHp(csCreature, targetName, campaignName) {
    if (csCreature.type === 'player') return Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0);
    return Number(csCreature.currentHp ?? csCreature.hit_points?.current ?? 0);
}

// Untyped HP loss (infernalWoundService / whirlwindService bleed-tick shape):
// PC → runtime currentHitPoints; monster → detached cs copy persisted through
// the serialized write queue (§2 HP truth).
async function applyUntypedConstrictHpLoss(cs, csCreature, activeName, newHp, campaignName) {
    if (csCreature.type === 'player') {
        await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
        return;
    }
    const detached = cloneDeep(cs);
    const target = (detached.creatures || []).find(c => c.name === activeName);
    if (!target) return;
    target.currentHp = newHp;
    if (target.hit_points && typeof target.hit_points === 'object') {
        target.hit_points.current = newHp;
    }
    setCombatSummaryCache(detached, campaignName);
    storage.set('combatSummary', detached, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

// Release the constrict marker: strip the te (skipSync echo write, infernal
// stripWoundTe shape) and log why — the grapple ended, so the tick ends with
// it (RAW "until released").
async function releaseConstrictMarker(activeName, campaignName, reason, source) {
    const stored = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const filtered = stored.filter(te => !(te && te.effect === CONSTRICT_GRAPPLE_TE && te.target === activeName));
    if (filtered.length === stored.length) return;
    setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'constrict_grapple_released',
        characterName: activeName,
        sourceName: source || 'the grappler',
        abilityName: 'Constrict',
        description: `${activeName}'s constrict grapple ended — ${reason}. The recurring start-of-turn damage tick stops with the Grappled condition.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[constrictGrappleService:released]', e); });
}

// Release choke point (§45 hoist): grappler dead in combatSummary → te
// stripped with a release log, tick pays zero. Returns the te to tick when
// the grappler stands (or cannot be located — lenient, §42 phantom class).
async function resolveGrapplerAliveGate(te, activeName, cs, campaignName) {
    const source = te.source || 'the grappler';
    const grappler = (cs.creatures || []).find(c => c.name === source);
    if (grappler && Number(grappler.currentHp ?? grappler.hit_points?.current ?? 1) <= 0) {
        await releaseConstrictMarker(activeName, campaignName, `${source} has died`, source);
        return null;
    }
    return te;
}

// Tick ledger (§45 hoist): transparent dice roll log + hp_change (delta ==
// rolled dice) + automation tick row, whirlwindService twin copy shape.
async function logConstrictTick({ campaignName, te, activeName, source, damage, rolls, newHp, maxHp }) {
    const die = String(te.die || '4d8').toLowerCase();
    const damageType = te.damageType || 'Bludgeoning';
    const actionName = te.actionName || 'Constrict';
    await addEntry(campaignName, {
        type: 'roll',
        rollType: 'damage',
        characterName: source,
        name: `${actionName} (ongoing grapple)`,
        formula: die,
        rolls: rolls || [damage],
        total: damage,
        targetName: activeName,
        damageType,
        description: `${actionName} ongoing grapple damage: ${damage} ${damageType.toLowerCase()} (${die}) to ${activeName}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[constrictGrappleService:tick-roll]', e); });
    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: activeName,
        delta: -damage,
        currentHp: newHp,
        maxHp,
        isHealing: false,
        isUnconscious: newHp <= 0,
        damageBreakdown: [{ damageType, amount: damage, resisted: false }],
        note: `Constrict turn-start grapple damage ${damage} ${damageType.toLowerCase()} (${die}) from ${source} — repeats at the start of each of ${activeName}'s turns until released${te.escapeDc != null ? ` (escape DC ${te.escapeDc})` : ''}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[constrictGrappleService:tick-hp]', e); });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'constrict_grapple_tick',
        characterName: activeName,
        sourceName: source,
        abilityName: actionName,
        description: `${activeName} is constricted by ${source} — takes ${damage} ${damageType.toLowerCase()} (${die}) at the start of its turn (tick consumer: constrict_grapple te; stops when the Grappled condition ends or the grappler dies).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[constrictGrappleService:tick-log]', e); });
}

// Turn-start tick (turnStartEffects pre-playerStats seam — PC AND monster
// victims). Gated on the constrict te AND the victim still being Grappled
// AND the grappler still alive in combatSummary; any choke point failing
// strips the marker with a release log and pays zero damage.
export async function applyConstrictGrappleTurnStart(activeName, campaignName) {
    if (!activeName) return;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const tes = storedEffects.filter(te => te && te.effect === CONSTRICT_GRAPPLE_TE && te.target === activeName);
    if (tes.length === 0) return;

    // Release choke point 1 (RAW "until released"): Grappled cleared —
    // escape-badge save (MA-0010 seam), rest, or GM removal — stops the
    // tick and strips the marker before any dice touch.
    if (!hasGrappled(activeName, campaignName)) {
        await releaseConstrictMarker(activeName, campaignName, 'the Grappled condition is no longer standing (escaped, rested, or GM-removed)', tes[0].source || 'the grappler');
        return;
    }

    const cs = await loadCombatSummary(campaignName);
    if (!cs) return;
    const csCreature = (cs.creatures || []).find(c => c.name === activeName);
    if (!csCreature) return;

    const te = await resolveGrapplerAliveGate(tes[0], activeName, cs, campaignName);
    if (!te) return;

    const result = rollExpression(String(te.die || '4d8').toLowerCase());
    const damage = result ? Number(result.total) : 0;
    if (!(damage > 0)) return;

    const currentHp = resolveVictimCurrentHp(csCreature, activeName, campaignName);
    if (!(currentHp > 0)) return;
    const newHp = Math.max(0, currentHp - damage);

    await applyUntypedConstrictHpLoss(cs, csCreature, activeName, newHp, campaignName);
    await logConstrictTick({ campaignName, te, activeName, source: te.source || 'the grappler', damage, rolls: result.rolls, newHp, maxHp: resolveVictimMaxHp(csCreature, activeName, campaignName) });
}
