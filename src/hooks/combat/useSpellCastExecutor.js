import { useRef, useCallback } from 'react'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'

export function useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta = {}, cachedPosRef, setModalState) {
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
        promise.then((result) => {
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
                const bonusHealDetail = result.bonusDetails?.length > 0
                    ? result.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
                    : '';
                const rawTotal = result.rawTotal ?? result.healAmount;
                setPopupHtml({
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
                });
            }
        }).catch((e) => { console.error(`[useSpellCastExecutor] executeSpellCast error for ${spell.name}:`, e); });
        ref.current = null;
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta, ref, setModalState]);

    return { castAction, cachedPosRef: ref };
}

function handleModalResult(popup, setModalState) {
    const modalName = popup.modalName;
    const payload = popup.payload;
    switch (modalName) {
        case 'massHealTarget':
            setModalState({ massHealModal: payload });
            break;
        case 'massCureWoundsTarget':
            setModalState({ massCureWoundsModal: payload });
            break;
        case 'prayerOfHealingTarget':
            setModalState({ prayerOfHealingModal: payload });
            break;
        case 'powerWordFortifyTarget':
            setModalState({ powerWordFortifyModal: payload });
            break;
        case 'massHealingWordTarget':
            setModalState({ massHealingWordModal: payload });
            break;
        case 'saveAttackAoe':
            setModalState({ saveAttackAoeModal: payload });
            break;
        case 'aoeCondition':
            setModalState({ aoeConditionModal: payload });
            break;
        case 'fear':
            setModalState({ fearModal: payload });
            break;
        case 'sleep':
            setModalState({ sleepModal: payload });
            break;
        case 'hypnoticPattern':
            setModalState({ hypnoticPatternModal: payload });
            break;
        case 'calmEmotions':
            setModalState({ calmEmotionsModal: payload });
            break;
        case 'massSuggestion':
            setModalState({ massSuggestionModal: payload });
            break;
        case 'commandChoice':
            setModalState({ commandModal: payload });
            break;
        case 'ArcaneVigor':
            setModalState({ arcaneVigorModal: payload });
            break;
        case 'blindnessDeafness':
            setModalState({ blindnessDeafnessModal: payload });
            break;
        case 'silenceTargetSelection':
            setModalState({ silenceModal: payload });
            break;
        case 'eyebiteEffect':
            setModalState({ eyebiteEffectModal: payload });
            break;
        case 'wildMagicSurge':
            setModalState({ wildMagicSurgeModal: payload });
            break;
        case 'feignDeathTargetSelection':
            setModalState({ feignDeathModal: payload });
            break;
        case 'tashasLaughter':
            setModalState({ tashasLaughterModal: payload });
            break;
        case 'animateDead':
            setModalState({ animateDeadModal: payload });
            break;
        case 'createUndead':
            setModalState({ createUndeadModal: payload });
            break;
        case 'summonSpirit':
            setModalState({ summonSpiritModal: payload });
            break;
        case 'starryChaliceHeal':
            setModalState({ starryChaliceHealModal: payload });
            break;
        default:
            console.error(`[useSpellCastExecutor] Unknown modalName from spell cast: ${modalName}`);
    }
}
