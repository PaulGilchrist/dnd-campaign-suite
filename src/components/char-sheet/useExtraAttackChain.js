import { useEffect, useRef } from 'react';
import { getActiveCreatureName, getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { getExtraAttacks, isExtraAttackEligibleRow } from '../../services/character/extraAttacks.js';

// CLA-044-era turn-latch shape ({ round, activeCreature }, mirrors
// _recklessAttack_offeredThisTurn): Extra Attack's bonus swings are granted
// once per turn by the Attack action. Pressing the weapon row again the same
// turn never re-grants free extra swings (with enforcement/actionEconomy on,
// assertCanAct's spent action bucket refuses the re-press outright). The one
// refund seam: cancelling the PRESSED swing's staged hit is a full revert
// (§7.2 no-consume-on-void), so the latch clears and a same-turn re-press
// re-grants — same doctrine as the LoS pre-check's no-slot-charge refusal in
// useCharActionsAttackHandlers.
const EXTRA_ATTACK_TURN_LATCH_KEY = '_extraAttackGrantedTurn';

/**
 * The one attack-roll step, shared by the press seam (swing 1, armed by
 * beginExtraAttackChain) and the chain advance (swings 2+). buildCtx is
 * rebuilt per swing so advantage/buff/target reads are current at the swing.
 * swing ({swing, of}) is the chain-context ordinal (ZB 2026-11-23 affordance):
 * it rides the roll context into the popup payload ONLY when the chain armed
 * the swing, so a single-swing popup stays byte-identical to pre-chain faces.
 */
export function rollWeaponSwing({ attack, buildCtx, rollAttack, exhaustionPenalty, swing }) {
    return buildCtx(attack).then(ctx => {
        const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
        const rollContext = swing ? { ...ctx, extraAttackSwing: swing } : ctx;
        rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, rollContext);
    });
}

export default function useExtraAttackChain({
    playerName,
    campaignName,
    playerStats,
    popupHtml,
    sheetModalMounted,
    chainPromptArmed,
    buildCtx,
    rollAttack,
    exhaustionPenalty,
    getRuntimeValue,
    setRuntimeValue,
}) {
    // Per-client chain continuation bookkeeping (same class of state as the
    // damage pipeline's component-local resumeRef stash in
    // useAttackDamageResolution) — the durable per-turn fact lives in the
    // runtime-store latch, and every resolved swing logs its own roll row.
    const chainRef = useRef(null); // { attack, extraAttacks, total, remaining, grantLogged, popupSeen, commitPending, commitPendingSeen }

    function readCurrentCreature() {
        // CLA-044: top-level activeCreatureName is truth; cs cache only as fallback.
        return getRuntimeValue('campaign', 'activeCreatureName', campaignName)
            || getActiveCreatureName(campaignName)
            || null;
    }

    // Grants this Attack action its extra swings once per turn. Outside a
    // turn (no active creature / no round) there is no action budget to spend.
    function grantAttackActionBudget() {
        const activeCreature = readCurrentCreature();
        const round = getCurrentCombatRound(campaignName);
        if (!activeCreature || round == null) return true;
        const latch = getRuntimeValue(playerName, EXTRA_ATTACK_TURN_LATCH_KEY, campaignName);
        if (latch && latch.round === round && latch.activeCreature === activeCreature) return false;
        setRuntimeValue(playerName, EXTRA_ATTACK_TURN_LATCH_KEY, { round, activeCreature }, campaignName);
        return true;
    }

    function beginExtraAttackChain(attack) {
        // A fresh press replaces any leftover chain (a stalled one can only
        // be a harness/abandonment residue — the new action owns the host).
        chainRef.current = null;
        if (!isExtraAttackEligibleRow(attack)) return null;
        const extraAttacks = getExtraAttacks(playerStats);
        if (!(extraAttacks > 0)) return null;
        if (!grantAttackActionBudget()) return null;
        // The grant row is NOT written here: a press whose staged hit is
        // cancelled is fully voided (its attack_cancelled row says "no damage
        // applied"), and the log must never assert attacks that never resolve.
        // The row rides the first chain advance instead (logExtraAttackGrant).
        chainRef.current = {
            attack,
            extraAttacks,
            total: extraAttacks + 1,
            remaining: extraAttacks,
            grantLogged: false,
            popupSeen: false,
            commitPending: false,
            commitPendingSeen: false,
        };
        // The press popup is swing 1 of the chain — the ordinal rides the
        // popup so the GM can tell which swing a Done commits (affordance
        // only; rolls/log rows/latch are untouched).
        return { swing: 1, of: extraAttacks + 1 };
    }

    // One automation/extra_attack row per granted Attack action, written the
    // first time the chain ADVANCES — i.e. once the pressed swing has resolved
    // (hit committed or miss drained) and the action is proven to proceed.
    function logExtraAttackGrant(chain) {
        if (chain.grantLogged) return;
        chain.grantLogged = true;
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'extra_attack',
            name: 'Extra Attack',
            description: `${playerName} takes the Attack action with Extra Attack — ${chain.extraAttacks + 1} weapon attacks with ${chain.attack.name}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[useExtraAttackChain:log-error]', e); });
    }

    function stageNextSwing(chain) {
        chain.remaining -= 1;
        chain.popupSeen = false;
        chain.commitPending = false;
        chain.commitPendingSeen = false;
        // Swing number: total minus the swings still queued after this one's
        // staging (lv6: first advance → 2 of 2; lv18: 2 of 3, then 3 of 3).
        const swing = { swing: chain.total - chain.remaining, of: chain.total };
        rollWeaponSwing({ attack: chain.attack, buildCtx, rollAttack, exhaustionPenalty, swing })
            .catch((e) => { console.error('[useExtraAttackChain:swing-error]', e); });
    }

    function advanceOrFinish() {
        const chain = chainRef.current;
        if (!chain) return;
        if (chain.remaining <= 0) {
            chainRef.current = null;
            return;
        }
        // No turn guard: the lenient press model allows sheet attacks while
        // the active row is elsewhere (same law as the press seam's
        // turn-lock being enforcement-gated). The chain belongs to the
        // press that armed it and runs to completion as its popups drain;
        // cancelling staged damage drops it, and a sheet unmount retires it.
        logExtraAttackGrant(chain);
        stageNextSwing(chain);
    }

    // Drain watcher — the sheet's chain dwell surface is the shared popup
    // host plus this sheet's modals plus rider-chain save prompts (the exact
    // surface the attack-row dwell dim and the damageApplied auto-retire
    // effect already model, CharActions.jsx). A swing resolves when the
    // chain-owned UI has fully drained. A staged HIT's Done dispatches
    // `dice-roll-done` BEFORE closing its popup, so the drain extends across
    // the commit's own faces (damage popup / chooser / save prompt) — the
    // next swing's popup must never race or land under the previous swing's
    // damage result (playbook OVERLAY DWELL DRAIN ORDER law).
    useEffect(() => {
        const chain = chainRef.current;
        if (!chain) return;
        const dwelling = popupHtml != null || sheetModalMounted || chainPromptArmed;
        if (dwelling) {
            chain.popupSeen = true;
            if (chain.commitPending) chain.commitPendingSeen = true;
            return;
        }
        if (!chain.popupSeen) return;
        if (chain.commitPending && !chain.commitPendingSeen) return;
        chain.popupSeen = false;
        chain.commitPending = false;
        chain.commitPendingSeen = false;
        advanceOrFinish();
        // Intentionally keyed on the drain-surface transitions only: the
        // helpers consulted run at call time against refs + fresh runtime
        // reads; listing them would refire the watcher on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [popupHtml, sheetModalMounted, chainPromptArmed]);

    // Bus listeners: `dice-roll-done` is the popup Done-commit signal the
    // auto-damage lane already rides; `attack-staged-cancelled` is its
    // sibling Cancel signal (AttackResultPopup) — cancelling staged damage
    // drops the remaining swings, and cancelling the pressed swing also
    // refunds the turn's grant (its attack_cancelled row declares the action
    // voided: the log must keep asserting only what resolved).
    useEffect(() => {
        const handleDone = (e) => {
            const chain = chainRef.current;
            const attacker = e.detail?.autoDamage?.attackerName || e.detail?.autoDamage?.source;
            if (chain && attacker === playerName) chain.commitPending = true;
        };
        const handleCancelled = (e) => {
            const chain = chainRef.current;
            if (!chain || e.detail?.characterName !== playerName) return;
            chainRef.current = null;
            // Refund the turn's latch only while the action has never ADVANCED
            // (the pressed swing itself was the cancelled one): the cancel is a
            // full revert, so the grant stamp goes with it and a same-turn
            // re-press re-grants. Once an earlier swing resolved, the action
            // is (partly) spent — the latch stays and the attack_cancelled
            // row alone logs the voided swing.
            if (!chain.grantLogged) {
                setRuntimeValue(playerName, EXTRA_ATTACK_TURN_LATCH_KEY, null, campaignName);
            }
        };
        window.addEventListener('dice-roll-done', handleDone);
        window.addEventListener('attack-staged-cancelled', handleCancelled);
        return () => {
            window.removeEventListener('dice-roll-done', handleDone);
            window.removeEventListener('attack-staged-cancelled', handleCancelled);
        };
    }, [playerName, campaignName, setRuntimeValue]);

    return { beginExtraAttackChain };
}
