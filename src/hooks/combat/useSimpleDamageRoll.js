import { useCallback } from 'react'
import { rollExpression } from '../../services/dice/diceRoller.js'
import { addEntry } from '../../services/ui/logService.js'

// HHH 2026-11-21 improve damage-chip-disclosure: the note is the producer's
// signature on BOTH the log row and the popup payload. DiceRollResult renders
// the disclosure line only for this exact note, so the gated-attack face (which
// carries no note) and other damage popups never show it. Owner decision: the
// direct roller stays ungated; the popup self-discloses it is not the gated lane.
export const DIRECT_DAMAGE_ROLL_NOTE = 'Direct damage roll (no target)';

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
            note: DIRECT_DAMAGE_ROLL_NOTE,
        });
        setPopupHtml({
            type: 'damage',
            name: attack.name,
            formula: attack.damage,
            rolls: result.rolls,
            total: result.total,
            modifier: result.modifier,
            damageType: attack.damageType,
            note: DIRECT_DAMAGE_ROLL_NOTE,
        });
    }, [playerStats.name, campaignName, popupHtml, setPopupHtml]);

    return handleSimpleDamageRoll;
}
