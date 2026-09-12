import { useRef, useCallback } from 'react'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'

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

    const castAction = useCallback((spell, metaCtx) => {
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
