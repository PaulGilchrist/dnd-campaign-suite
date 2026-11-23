import { useEffect, useRef } from 'react';
import { getActiveCreatureName, getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { getExtraAttacks, isExtraAttackEligibleRow } from '../../services/character/extraAttacks.js';

// CLA-044-era turn-latch shape ({ round, activeCreature }, mirrors
// _recklessAttack_offeredThisTurn): Extra Attack's bonus swings are granted
// once per turn by the Attack action. Pressing the weapon row again the same
// turn never re-grants free extra swings (with enforcement/actionEconomy on,
// assertCanAct's spent action bucket refuses the re-press outright).
const EXTRA_ATTACK_TURN_LATCH_KEY = '_extraAttackGrantedTurn';

/**
 * The one attack-roll step, shared by the press seam (swing 1, armed by
 * beginExtraAttackChain) and the chain advance (swings 2+). buildCtx is
 * rebuilt per swing so advantage/buff/target reads are current at the swing.
 */
export function rollWeaponSwing({ attack, buildCtx, rollAttack, exhaustionPenalty }) {
    return buildCtx(attack).then(ctx => {
        const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
        rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
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
    const chainRef = useRef(null); // { attack, remaining, popupSeen, commitPending, commitPendingSeen }

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
        if (!isExtraAttackEligibleRow(attack)) return;
        const extraAttacks = getExtraAttacks(playerStats);
        if (!(extraAttacks > 0)) return;
        if (!grantAttackActionBudget()) return;
        chainRef.current = {
            attack,
            remaining: extraAttacks,
            popupSeen: false,
            commitPending: false,
            commitPendingSeen: false,
        };
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'extra_attack',
            name: 'Extra Attack',
            description: `${playerName} takes the Attack action with Extra Attack — ${extraAttacks + 1} weapon attacks with ${attack.name}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[useExtraAttackChain:log-error]', e); });
    }

    function stageNextSwing(chain) {
        chain.remaining -= 1;
        chain.popupSeen = false;
        chain.commitPending = false;
        chain.commitPendingSeen = false;
        rollWeaponSwing({ attack: chain.attack, buildCtx, rollAttack, exhaustionPenalty })
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
    // sibling Cancel signal (AttackResultPopup) — cancelling the action
    // leaves the remaining swings unused (its attack_cancelled row logs it).
    useEffect(() => {
        const handleDone = (e) => {
            const chain = chainRef.current;
            const attacker = e.detail?.autoDamage?.attackerName || e.detail?.autoDamage?.source;
            if (chain && attacker === playerName) chain.commitPending = true;
        };
        const handleCancelled = (e) => {
            if (chainRef.current && e.detail?.characterName === playerName) chainRef.current = null;
        };
        window.addEventListener('dice-roll-done', handleDone);
        window.addEventListener('attack-staged-cancelled', handleCancelled);
        return () => {
            window.removeEventListener('dice-roll-done', handleDone);
            window.removeEventListener('attack-staged-cancelled', handleCancelled);
        };
    }, [playerName]);

    return { beginExtraAttackChain };
}
