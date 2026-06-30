import { useRef, useCallback } from 'react'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'

export function useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta = {}, cachedPosRef) {
    const internalPosRef = useRef(null);
    const ref = cachedPosRef || internalPosRef;

    const castAction = useCallback((spell, metaCtx) => {
        const pos = ref.current;
        executeSpellCast(spell, metaCtx, {
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
        }).then((result) => {
            if (result && result.healAmount > 0) {
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
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta, ref]);

    return { castAction, cachedPosRef: ref };
}
