/**
 * bug-monster-oa-resolution-auto-missed-by-melee-range-gate — pending
 * Opportunity-Attack trigger markers (server-first, SSE-visible, NO timers).
 *
 * When `opportunityTrigger.onTokenMoveLanded` fires a defender, the engine
 * charges the defender's reaction and directs the GM to the defender's sheet.
 * The only honest resolution measure for the melee OA is the TRIGGER-TIME
 * adjacency (`wasInReach && nowOutside` is the trigger's own precondition), so
 * the trigger parks one marker per defender naming the provoking mover. The
 * resolution lanes (monster stat-block card, PC sheet Reactions) consume it:
 * the attack rolls against the MARKED MOVER with the melee-range condition
 * proven by the marker — never an `isAutoMiss` from the mover's post-move
 * position, and never a second reaction charge (the trigger already paid).
 *
 * Storage mirrors the `pendingSavePrompts` precedent
 * (services/automation/common/savePrompt.js): one campaign-level object keyed
 * by defender name, spread-clone before every write (valuesEqual law), and
 * drain-to-evict — the final row DELETEs the key outright instead of
 * persisting `{}` dust that replays on every SSE connect.
 *
 * Drop law (no refunds — the reaction was legitimately spent at trigger):
 *   • consumed by the resolution press;
 *   • the defender's next turn is taken or ended (navigationHandlers seam);
 *   • a new initiative roll — dropped at the PRODUCERS (encounterToInitiative
 *     load/join lanes, npcCombatService.addNPCToInitiative), because every one
 *     of those lanes dispatches `initiative-rolled` while the Initiative view
 *     is unmounted, so the Initiative.jsx listener alone could never reach it
 *     (bug-new-initiative-roll-pendingoa-drop-never-fires); the listener keeps
 *     its own call for in-view dispatches — both are idempotent; and Initiative
 *     Clear (createCreatureHandlers.confirmClear);
 *   • the marker's mover leaves the encounter — away/dead/off-board
 *     (`prunePendingOas` at the turn + presence seams, plus the stale-marker
 *     eviction in the card lanes that render the affordance).
 *
 * Ruleset-agnostic: names key everything; no 2024 twin needed (verified —
 * the trigger lane itself has a single implementation for both rulesets).
 */
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';
import utils from '../ui/utils.js';

/** Campaign runtime-store key holding `{ [defenderName]: { defender, mover, promptId } }`. */
export const PENDING_OA_KEY = 'pendingOAs';

/** Campaign-level trigger-marker provenance row: the resolution lane writes
 *  this BEFORE its roll so the roll/damage rows read with an honest context
 *  line naming the trigger. */
export function buildOaResolutionLog({ defenderName, moverName }) {
    return {
        type: 'automation',
        automationType: 'opportunity_attack',
        creatureName: defenderName,
        characterName: defenderName,
        name: 'Opportunity Attack',
        targetName: moverName,
        description: `${defenderName} makes an opportunity attack against ${moverName}, who left ${defenderName}'s reach.`,
        timestamp: Date.now(),
    };
}

/** 2024 Speedy feat (Agile Movement): "Opportunity Attacks have Disadvantage
 *  against you" (bug-speedy-oa-disadvantage-inert). ONE honest attribution
 *  copy, shared by every resolution lane's forced-mode chip (advantageReason
 *  / disadvantageReasons channels) so the popup never prints a bare
 *  `Disadv (conditions)` for this rule. */
export function buildSpeedyOaDisadvantageReason(targetName) {
    return `${targetName} has Agile Movement (Speedy) — opportunity attacks against them have Disadvantage`;
}

/** Ledger row written by a resolution lane WHEN the Speedy fold actually
 *  applies to the press (mirrors the monster-lane Lion-aura disadvantage row
 *  shape — type automation + a marked automationType + event details). The
 *  roll row's `mode:'disadvantage'` stays the machine adv/dis truth; this
 *  row names the rule and the mover. */
export function buildSpeedyOaDisadvantageLog({ attackerName, moverName, actionName }) {
    return {
        type: 'automation',
        automationType: 'speedy_opportunity_disadvantage',
        creatureName: attackerName,
        characterName: attackerName,
        name: actionName,
        targetName: moverName,
        description: `${attackerName} has Disadvantage on ${actionName}: ${buildSpeedyOaDisadvantageReason(moverName)}.`,
        timestamp: Date.now(),
    };
}

function readPendingOas() {
    const map = getRuntimeValue('campaign', PENDING_OA_KEY);
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

/** Write with drain-to-evict (setSavePromptBucket precedent): the last row
 *  evicts the key so nothing `pendingOAs:{}` replays on SSE reconnect. */
function writePendingOas(campaignName, next) {
    if (Object.keys(next).length === 0) {
        deleteRuntimeKey('campaign', PENDING_OA_KEY, campaignName);
        return;
    }
    setRuntimeValue('campaign', PENDING_OA_KEY, next, campaignName);
}

/** Trigger seam (opportunityTrigger.onTokenMoveLanded): park one marker per
 *  triggering defender for this mover — multi-defender faces stay fully
 *  independent because the map is keyed by DEFENDER. A defender re-triggered
 *  by a later move simply re-arms with the new provoking mover. */
export function armPendingOas(campaignName, defenderNames, moverName) {
    if (!campaignName || !moverName || !Array.isArray(defenderNames) || defenderNames.length === 0) return;
    const next = { ...readPendingOas() };
    for (const defender of defenderNames) {
        next[defender] = { defender, mover: moverName, promptId: utils.guid() };
    }
    setRuntimeValue('campaign', PENDING_OA_KEY, next, campaignName);
}

/** One defender's live marker (or null). Reads the shared runtime mirror, so
 *  every tab sees it through the SSE echo. */
export function getPendingOa(campaignName, defenderName) {
    return readPendingOas()[defenderName] || null;
}

/** Reactive-lane sibling of getPendingOa for components that already
 *  subscribe to the bucket via useRuntimeValue — keeps the `?.`/`||` branch
 *  OUT of render components sitting at ESLint complexity ceilings. */
export function findPendingOaFor(pendingOaMap, defenderName) {
    return (pendingOaMap && pendingOaMap[defenderName]) || null;
}

/** Consume/drop one defender's marker (never refunds the spent reaction).
 *  Zero writes when nothing is pending for that defender. */
export function clearPendingOa(campaignName, defenderName) {
    const map = readPendingOas();
    if (!map[defenderName]) return false;
    const next = { ...map };
    delete next[defenderName];
    writePendingOas(campaignName, next);
    return true;
}

/** Drop EVERY pending marker (new initiative roll / Initiative Clear).
 *  Zero writes when the bucket is already absent/empty. */
export function clearAllPendingOas(campaignName) {
    if (Object.keys(readPendingOas()).length === 0) return false;
    deleteRuntimeKey('campaign', PENDING_OA_KEY, campaignName);
    return true;
}

/** A marker is live while its mover is still present in the encounter.
 *  Board truth unknown (no summary / no creatures array — gridless face) ⇒
 *  live: the lane never invents a denial without truth to measure (same law
 *  as the range gate relaxing when a side is unplaced). Away rows and dead
 *  movers (currentHp ≤ 0) evict. */
export function isPendingOaLive(combatSummary, marker) {
    if (!marker || !marker.mover) return false;
    const creatures = combatSummary?.creatures;
    if (!Array.isArray(creatures)) return true;
    const row = creatures.find(c => c && c.name === marker.mover);
    if (!row) return false;
    if (row.away === true) return false;
    return (row.currentHp ?? 1) > 0;
}

/** Evict every marker whose mover left the encounter (away/dead/off-board).
 *  Returns the number dropped; zero writes when nothing is stale. */
export function prunePendingOas(campaignName, combatSummary) {
    const map = readPendingOas();
    const entries = Object.entries(map);
    if (entries.length === 0) return 0;
    const next = {};
    let dropped = 0;
    for (const [defender, marker] of entries) {
        if (isPendingOaLive(combatSummary, marker)) next[defender] = marker;
        else dropped += 1;
    }
    if (dropped > 0) writePendingOas(campaignName, next);
    return dropped;
}

/** Primary melee attack row for a monster OA press — first authored attack
 *  with a reach clause ("reach 5 ft." / "Melee Weapon Attack:"). Save-only,
 *  ranged and non-attack rows never qualify; a block with no melee row has no
 *  automated OA (the affordance degrades to an honest advisory note). */
export function findMeleeAttackRow(actions) {
    for (const action of actions || []) {
        if (!action || action.attack_bonus == null) continue;
        if (action.reach || /Melee Weapon Attack/i.test(action.description || '')) return action;
    }
    return null;
}
