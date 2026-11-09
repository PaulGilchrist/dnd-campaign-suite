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
import { getAllyList, hasExplicitAllyList } from '../../hooks/useAllySelection.js';
import { chargeSlot } from './chargeEconomy.js';
import { armPendingOas } from './pendingOpportunityAttacks.js';
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
 *  placedItems[]. Hostility follows the ONE allegiance model (Phase 3.2): a
 *  mover with an EDITED ally list provokes anyone off it (PvP included) and
 *  never provokes from creatures on it; an unedited mover keeps the legacy
 *  players-vs-NPC-token split (see header note). */
export function findOpportunityDefenders({ mapData, moverName, moverIsPlayer, fromCell, toCell, reachFeet = MELEE_REACH_FEET }) {
    const alliesEdited = hasExplicitAllyList(moverName);
    const allies = alliesEdited ? getAllyList(moverName) : null;
    const candidates = [
        ...(mapData?.players || []).map((t) => ({ t, isPlayer: true })),
        ...(mapData?.placedItems || []).map((t) => ({ t, isPlayer: t.type === 'player' })),
    ].filter(({ t }) => t.name !== moverName && hasPosition(t));
    return candidates.filter(({ t, isPlayer }) => {
        if (allies) {
            if (allies.includes(t.name)) return false;
        } else if (isPlayer === moverIsPlayer) {
            // players vs npc tokens only (see hostility note in header)
            return false;
        }
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

/** Natural-language name join: "A" / "A and B" / "A, B and C". */
function joinNames(names) {
    if (names.length <= 2) return names.join(' and ');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Trigger advisory copy, shared by the per-defender log row (always a
 *  one-name list, so the log bytes stay exactly as before) and the single
 *  joined board toast (multi-defender, backlog 2026-11-09): the `.map-toast`
 *  is ONE node, so per-defender popups collapsed to the LAST defender's
 *  copy — instead the loop collects every triggering defender and surfaces
 *  one sticky advisory naming all of them. */
function triggerAdvisoryText(defenderNames, moverName, economyLive) {
    const spendNote = economyLive ? ' Reaction spent;' : '';
    const plural = defenderNames.length > 1;
    const resolution = plural
        ? 'Resolve the Opportunity Attack on their sheets.'
        : `Resolve the Opportunity Attack on ${defenderNames[0]}'s sheet.`;
    return `${joinNames(defenderNames)} ${plural ? 'react' : 'reacts'} — ${moverName} left their reach.${spendNote} ${resolution}`;
}

/** One defender's trigger leg: blocked ⇒ audit deny; spent reaction ⇒ audit
 *  deny; otherwise charge the reaction + log the advisory and report the
 *  trigger (return true) so the caller joins every triggering defender into
 *  ONE board toast. Both denials keep their per-defender popup; every face
 *  rides the same `setPopupHtml` board channel (denial popups stay
 *  byte-identical to their log reason). Advisory text is passed with
 *  { sticky: true } (backlog 2026-11-03 CN): the OA
 *  enforcement toast used to auto-hide at 4s while its log row is permanent,
 *  so a GM mid-drag missed WHY a reaction vanished — the sink keeps these
 *  visible until an explicit dismiss instead.
 *  @returns {boolean} true when this defender triggered — the caller
 *  collects those names for the joined multi-defender toast. */
function triggerDefender({ defender, campaignName, moverName, targetEffects, economyLive, setPopupHtml }) {
    const blocked = defenderBlockedReason(defender.name, targetEffects);
    if (blocked) {
        const reason = `${moverName} left ${defender.name}'s reach — ${blocked}`;
        if (typeof setPopupHtml === 'function') setPopupHtml(reason, { sticky: true });
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: defender.name,
            target: moverName,
            bucket: 'opportunityAttack',
            source: 'token-move',
            reason,
        }).catch((e) => { console.error('[opportunityTrigger] block log failed:', e); });
        return false;
    }

    // Reaction consumption rides the Phase 1 economy; with actionEconomy
    // OFF there is no budget to charge — the trigger stays advisory
    // (chargeSlot gates on that flag by design).
    if (economyLive && !chargeSlot({ creatureName: defender.name, bucket: 'reaction', campaignName })) {
        const reason = `${defender.name}'s reaction is already used — no opportunity attack on ${moverName}.`;
        if (typeof setPopupHtml === 'function') setPopupHtml(reason, { sticky: true });
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: defender.name,
            target: moverName,
            bucket: 'reaction',
            source: 'opportunity-attack-trigger',
            reason,
        }).catch((e) => { console.error('[opportunityTrigger] spent log failed:', e); });
        return false;
    }

    const advisory = triggerAdvisoryText([defender.name], moverName, economyLive);
    addEntry(campaignName, {
        type: 'enforcement_triggered',
        creature: defender.name,
        target: moverName,
        bucket: 'opportunityAttack',
        source: 'token-move',
        reason: advisory,
    }).catch((e) => { console.error('[opportunityTrigger] trigger log failed:', e); });
    return true;
}

/**
 * @param {object} ctx
 * @param {string} ctx.campaignName
 * @param {string} ctx.moverName
 * @param {boolean} ctx.moverIsPlayer     mover came from the players[] list
 * @param {{gridX,gridY}} ctx.fromCell   cell before the move
 * @param {{gridX,gridY}} ctx.toCell     cell the mover landed on
 * @param {object} ctx.mapData            current map data (tokens)
 * @param {Function} [ctx.setPopupHtml] advisory sink (map toast) — called as
 *   (text, { sticky }) so enforcement advisories request sticky display
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

    const triggeredNames = defenders
        .filter((defender) => triggerDefender({ defender, campaignName, moverName, targetEffects, economyLive, setPopupHtml }))
        .map((defender) => defender.name);

    // Pending-resolution markers (bug-monster-oa-resolution-auto-missed-by-
    // melee-range-gate): one per triggering defender, naming this mover —
    // server-first, SSE-visible, no timers. The marker is the trigger-time
    // adjacency PROOF the resolution lanes measure their melee range against
    // (multi-defender: each defender keeps its own marker, independent).
    // Armed whether or not the economy charged — with actionEconomy off the
    // trigger is advisory-only but the affordance is still an honest readout
    // of "this move provoked you".
    if (triggeredNames.length > 0) {
        armPendingOas(campaignName, triggeredNames, moverName);
    }

    // One joined sticky advisory AFTER the loop (multi-defender fix, backlog
    // 2026-11-09): names every defender that triggered, so a denial popup
    // emitted mid-loop can never shadow a triggering defender's copy and a
    // single trigger keeps its exact singular text.
    if (triggeredNames.length > 0 && typeof setPopupHtml === 'function') {
        setPopupHtml(triggerAdvisoryText(triggeredNames, moverName, economyLive), { sticky: true });
    }
}
