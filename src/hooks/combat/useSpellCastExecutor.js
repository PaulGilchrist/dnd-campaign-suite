import { useRef, useCallback } from 'react'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { assertCanAct } from '../../services/combat/assertCanAct.js'
import { classifyBucket } from '../../services/combat/automation/classifyBucket.js'
import { isLineOfSightEnforced, checkLineOfSight } from '../../services/combat/lineOfSightGate.js'
import { isCoverEnforced } from '../../services/combat/coverService.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'

function buildHealPopup(spell, result) {
    const bonusHealDetail = result.bonusDetails?.length > 0
        ? result.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
        : '';
    const rawTotal = result.rawTotal ?? result.healAmount;
    return {
        type: 'heal',
        name: spell.name,
        formula: result.formula,
        rolls: result.rolls || [],
        total: rawTotal,
        targetName: result.targetName,
        finalHeal: result.healAmount,
        bonusHeal: result.bonusHeal || 0,
        bonusHealDetail,
        healingRerollOriginalRolls: result.healingRerollOriginalRolls || null,
        healingRerollDisplayRolls: result.healingRerollDisplayRolls || null,
    };
}

function handleSpellCastResult(result, spell, setPopupHtml, setModalState) {
    if (result?.automationPopup) {
        const popup = result.automationPopup;
        if (popup.type === 'modal' && setModalState) {
            handleModalResult(popup, setModalState);
        } else {
            setPopupHtml(popup.payload);
        }
    } else if (result && result.type === 'popup') {
        setPopupHtml(result.payload);
    } else if (result && result.modalName) {
        if (setModalState) {
            handleModalResult(result, setModalState);
        } else {
            setPopupHtml(result.payload);
        }
    } else if (result && result.targetName != null) {
        setPopupHtml(buildHealPopup(spell, result));
    }
}

export function useSpellCastExecutor({ rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta = {}, cachedPosRef, setModalState }) {
    const internalPosRef = useRef(null);
    const ref = cachedPosRef || internalPosRef;

    // Execute-on-allow body of the cast chokepoint (declared BEFORE castAction
    // so the memoized castAction never captures a stale first-render copy).
    const runCast = useCallback((spell, metaCtx) => {
        // L5-001/002: enforcement gate at the single spell-cast chokepoint (no-op
        // while enforcement off). executeSpellCast runs immediately on allow, so
        // this site charges the classified slot (plan §7.2).
        if (!assertCanAct({
            campaignName,
            creatureName: playerStats.name,
            bucket: classifyBucket(spell),
            setPopupHtml,
            source: 'useSpellCastExecutor',
            charge: true,
        }).allowed) return;
        const pos = ref.current;
        const promise = executeSpellCast(spell, metaCtx, {
            rollAttack,
            rollDamage,
            playerStats,
            getTargetInfo,
            attackerPos: pos?.attackerPos,
            targetPos: pos?.targetPos,
            ...extraMeta,
            campaignName,
            mapName,
            characters,
        });
        if (!promise) return;
        promise.then((result) => handleSpellCastResult(result, spell, setPopupHtml, setModalState))
            .catch((e) => { console.error(`[useSpellCastExecutor] executeSpellCast error for ${spell.name}:`, e); });
        ref.current = null;
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta, ref, setModalState]);

    const castAction = useCallback((spell, metaCtx) => {
        // L5-003 §8.2: line-of-sight pre-check for enforced RANGED casts —
        // runs BEFORE assertCanAct so a blocked cast never charges its slot.
        // Enforcement off ⇒ synchronous false, byte-identical Levels 1–4.
        const losTargetName = metaCtx?.targetName
            || getTargetFromAttacker(getCombatSummary(campaignName), playerStats.name)?.name
            || null;
        if (losTargetName && (isLineOfSightEnforced(campaignName, spell?.range) || isCoverEnforced(campaignName, spell?.range))) {
            const pos = ref.current;
            checkLineOfSight({
                campaignName,
                attackerName: playerStats.name,
                targetName: losTargetName,
                range: spell?.range,
                setPopupHtml,
                source: 'useSpellCastExecutor',
                fromPos: pos?.attackerPos || undefined,
                toPos: pos?.targetPos || undefined,
            }).then((los) => {
                if (los.allowed) runCast(spell, metaCtx);
            });
            return;
        }
        runCast(spell, metaCtx);
    }, [playerStats, campaignName, setPopupHtml, ref, runCast]);

    return { castAction, cachedPosRef: ref };
}

const MODAL_STATE_KEYS = {
    massHealTarget: 'massHealModal',
    massCureWoundsTarget: 'massCureWoundsModal',
    prayerOfHealingTarget: 'prayerOfHealingModal',
    powerWordFortifyTarget: 'powerWordFortifyModal',
    massHealingWordTarget: 'massHealingWordModal',
    saveAttackAoe: 'saveAttackAoeModal',
    aoeCondition: 'aoeConditionModal',
    fear: 'fearModal',
    sleep: 'sleepModal',
    hypnoticPattern: 'hypnoticPatternModal',
    calmEmotions: 'calmEmotionsModal',
    massSuggestion: 'massSuggestionModal',
    commandChoice: 'commandModal',
    ArcaneVigor: 'arcaneVigorModal',
    blindnessDeafness: 'blindnessDeafnessModal',
    silenceTargetSelection: 'silenceModal',
    eyebiteEffect: 'eyebiteEffectModal',
    wildMagicSurge: 'wildMagicSurgeModal',
    feignDeathTargetSelection: 'feignDeathModal',
    tashasLaughter: 'tashasLaughterModal',
    animateDead: 'animateDeadModal',
    createUndead: 'createUndeadModal',
    summonSpirit: 'summonSpiritModal',
    starryChaliceHeal: 'starryChaliceHealModal',
};

function handleModalResult(popup, setModalState) {
    const modalName = popup.modalName;
    if (!Object.hasOwn(MODAL_STATE_KEYS, modalName)) {
        console.error(`[useSpellCastExecutor] Unknown modalName from spell cast: ${modalName}`);
        return;
    }
    setModalState({ [MODAL_STATE_KEYS[modalName]]: popup.payload });
}

// CLA-389: shared modal router for cast-lane consumers outside this executor
// (e.g. useActionSpellMetamagic) — a modal-type cast result must reach sheet
// modal state through the SAME key map, never be discarded.
export function routeCastModal(popup, setModalState) {
    handleModalResult(popup, setModalState);
}
