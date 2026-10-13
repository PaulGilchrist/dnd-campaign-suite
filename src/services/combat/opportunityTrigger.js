/**
 * Level 5 (L5-003) §8.4 — opportunity-attack trigger engine.
 *
 * When `enforcement.opportunityAttacks` is on and a token MOVES AWAY from a
 * hostile creature's reach (was within 5 ft at the START cell, is outside it
 * at the END cell), the engine:
 *   1. identifies every hostile defender it just left,
 *   2. honours the existing no-OA truths (`no_opportunity_attacks` te,
 *      per-blocker reasons) and the Speedy passive (disadvantage note),
 *   3. charges each defender's REACTION budget via the Phase 1 economy
 *      (denied when the reaction is already spent — audit logged),
 *   4. surfaces an advisory popup + campaign log entry so the defender
 *      resolves the attack through their existing sheet OA lane (§16 parks
 *      full cross-view auto-ROLL; the consumption happens HERE, so a
 *      forgotten reaction is no longer a free pass).
 *
 * Off-switch: enforcement off / flag off ⇒ `onTokenMoveLanded` returns
 * synchronously with zero reads beyond the one in-memory flag — every drop
 * behaves exactly like Levels 1–4.
 *
 * Hostility (no invented factions): players vs NPC tokens by `type`;
 * NPC-to-NPC tokens never provoke (party-faction truth doesn't exist on the
 * map — parked §16). Reach is the engine default MELEE_REACH_FEET (5 ft);
 * feat extended reach on the map is §16.
 */
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { chargeSlot } from './chargeEconomy.js';
import { addEntry } from '../ui/logService.js';
import { MELEE_REACH_FEET } from './baseCombatActions.js';

function distCells(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); // Chebyshev — 5/10/15 grid reach
}

function hasPosition(t) {
    return !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY);
}

/** Pure: defenders that the mover just left. Players come from the map's
 *  players[] array (token JSON carries no type field), NPC-like things from
 *  placedItems[]. */
export function findOpportunityDefenders({ mapData, moverName, moverIsPlayer, fromCell, toCell, reachFeet = MELEE_REACH_FEET }) {
    const candidates = [
        ...(mapData?.players || []).map((t) => ({ t, isPlayer: true })),
        ...(mapData?.placedItems || []).map((t) => ({ t, isPlayer: t.type === 'player' })),
    ].filter(({ t }) => t.name !== moverName && hasPosition(t));
    return candidates.filter(({ t, isPlayer }) => {
        // players vs npc tokens only (see hostility note in header)
        if (isPlayer === moverIsPlayer) return false;
        const wasInReach = distCells(t.gridX, t.gridY, fromCell.gridX, fromCell.gridY) * 5 <= reachFeet;
        const nowOutside = distCells(t.gridX, t.gridY, toCell.gridX, toCell.gridY) * 5 > reachFeet;
        return wasInReach && nowOutside;
    }).map(({ t }) => t);
}

/** Blocked-by-state check against the existing targetEffect truths. */
function defenderBlockedReason(defenderName, targetEffects) {
    const te = (targetEffects || []).find((e) => e && e.target === defenderName && e.effect === 'no_opportunity_attacks');
    return te ? (te.reason || 'A condition prevents opportunity attacks.') : null;
}

/** One defender's trigger leg: blocked ⇒ audit deny; spent reaction ⇒ audit
 *  deny; otherwise charge the reaction + advisory popup/log. */
function triggerDefender({ defender, campaignName, moverName, targetEffects, economyLive, setPopupHtml }) {
    const blocked = defenderBlockedReason(defender.name, targetEffects);
    if (blocked) {
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: defender.name,
            target: moverName,
            bucket: 'opportunityAttack',
            source: 'token-move',
            reason: `${moverName} left ${defender.name}'s reach — ${blocked}`,
        }).catch((e) => { console.error('[opportunityTrigger] block log failed:', e); });
        return;
    }

    // Reaction consumption rides the Phase 1 economy; with actionEconomy
    // OFF there is no budget to charge — the trigger stays advisory
    // (chargeSlot gates on that flag by design).
    if (economyLive && !chargeSlot({ creatureName: defender.name, bucket: 'reaction', campaignName })) {
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: defender.name,
            target: moverName,
            bucket: 'reaction',
            source: 'opportunity-attack-trigger',
            reason: `${defender.name}'s reaction is already used — no opportunity attack on ${moverName}.`,
        }).catch((e) => { console.error('[opportunityTrigger] spent log failed:', e); });
        return;
    }

    const spendNote = economyLive ? ' Reaction spent;' : '';
    const advisory = `${defender.name} reacts — ${moverName} left their reach.${spendNote} Resolve the Opportunity Attack on ${defender.name}'s sheet.`;
    if (typeof setPopupHtml === 'function') setPopupHtml(advisory);
    addEntry(campaignName, {
        type: 'enforcement_triggered',
        creature: defender.name,
        target: moverName,
        bucket: 'opportunityAttack',
        source: 'token-move',
        reason: advisory,
    }).catch((e) => { console.error('[opportunityTrigger] trigger log failed:', e); });
}

/**
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string} ctx.moverName
 * @param {boolean} ctx.moverIsPlayer     mover came from the players[] list
 * @param {{gridX,gridY}} ctx.fromCell   cell before the move
 * @param {{gridX,gridY}} ctx.toCell     cell the mover landed on
 * @param {object} ctx.mapData            current map data (tokens)
 * @param {Function} [ctx.setPopupHtml] advisory sink (map popup)
 */
export async function onTokenMoveLanded(ctx) {
    const { campaignName, moverName, moverIsPlayer, fromCell, toCell, mapData, setPopupHtml } = ctx;

    // Fast path — flag off ⇒ synchronous zero-work (byte-parity L1–4).
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null;
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.opportunityAttacks) return;
    if (!hasPosition(fromCell) || !hasPosition(toCell)) return;
    if (fromCell.gridX === toCell.gridX && fromCell.gridY === toCell.gridY) return;

    const defenders = findOpportunityDefenders({ mapData, moverName, moverIsPlayer, fromCell, toCell });
    if (defenders.length === 0) return;

    const tEffects = getRuntimeValue('campaign', 'targetEffects');
    const targetEffects = Array.isArray(tEffects) ? tEffects : [];
    const economyLive = !!enforcement.actionEconomy;

    for (const defender of defenders) {
        triggerDefender({ defender, campaignName, moverName, targetEffects, economyLive, setPopupHtml });
    }
}
