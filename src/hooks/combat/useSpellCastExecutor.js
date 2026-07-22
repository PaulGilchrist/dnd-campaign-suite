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
        case 'wildMagicSurge':
            setModalState({ wildMagicSurgeModal: payload });
            break;
        default:
            console.error(`[useSpellCastExecutor] Unknown modalName from spell cast: ${modalName}`);
    }
}
