import { useCallback } from 'react'
import { rollExpression } from '../../services/dice/diceRoller.js'
import { addEntry } from '../../services/ui/logService.js'

export function useSimpleDamageRoll(playerStats, campaignName, popupHtml, setPopupHtml) {
    const handleSimpleDamageRoll = useCallback(async (attack) => {
        const result = rollExpression(attack.damage);
        if (!result) return;
        if (popupHtml) setPopupHtml(null);
        await addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'damage',
            name: attack.name,
            formula: attack.damage,
            rolls: result.rolls,
            total: result.total,
            modifier: result.modifier,
            damageType: attack.damageType,
            note: 'Direct damage roll (no target)',
        });
        setPopupHtml({
            type: 'damage',
            name: attack.name,
            formula: attack.damage,
            rolls: result.rolls,
            total: result.total,
            modifier: result.modifier,
            damageType: attack.damageType,
            note: 'Direct damage roll (no target)',
        });
    }, [playerStats.name, campaignName, popupHtml, setPopupHtml]);

    return handleSimpleDamageRoll;
}
