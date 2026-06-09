import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const spellName = auto.spell || action.name;

    const mantleActiveKey = 'mantleOfMajestyActive';
    const isActive = auto.freeCasts === 'at_will_while_active'
        ? getRuntimeValue(playerStats.name, mantleActiveKey) === true
        : false;

    if (auto.freeCasts === 'at_will_while_active' && !isActive) {
        if (campaignName) {
            setRuntimeValue(playerStats.name, mantleActiveKey, true, campaignName);
        }
        const durInfo = auto.duration ? ` Duration: ${auto.duration}.` : '';
        const concInfo = auto.concentration ? ' Requires Concentration.' : '';
        return {
            type: 'popup',
            payload: {
                html: `<b>${action.name} — Activated</b><br/>${action.description || ''}<br/><br/><b>Mantle of Majesty is now active.</b>${durInfo}${concInfo}<br/>You can now cast ${spellName} as a Bonus Action without expending a spell slot while the Mantle is active.`,
            },
        };
    }

    let spellData = (playerStats.spellAbilities?.spells || []).find(s => s.name === spellName);
    if (!spellData) {
        try {
            const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
            const response = await fetch(spellsUrl);
            const allSpells = await response.json();
            spellData = allSpells.find(s => s.name === spellName);
         } catch { /* spell not found */ }
        }

    if (spellData?.damage) {
        const slotDmg = spellData.damage.damage_at_slot_level;
        const formula = slotDmg?.[Object.keys(slotDmg)[0]];
        if (formula) {
            const result = rollExpression(formula);
            if (result) {
                return {
                    type: 'roll',
                    payload: {
                        rollType: 'damage',
                        name: spellName,
                        formula,
                        total: result.total,
                        rolls: result.rolls,
                        modifier: result.modifier,
                        contextConfig: {
                            damageType: spellData.damage.damage_type || 'Radiant',
                            attackerName: playerStats.name,
                             },
                            },
                        };
                    }
                 }
               }

    const usesInfo = auto.uses ? ` (${auto.uses}/long rest)` : '';
    const freeInfo = auto.freeCasts === 'at_will_while_active' ? ' <em>(free cast — Mantle active)</em>' : '';
    const durReminder = (auto.freeCasts === 'at_will_while_active' && auto.duration) ? `<br/><em>Mantle active — ${auto.duration} remaining.</em>` : '';
    const concReminder = (auto.freeCasts === 'at_will_while_active' && auto.concentration) ? ' Requires Concentration.' : '';
    return {
        type: 'popup',
        payload: {
            html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${usesInfo}${freeInfo}${concReminder}${durReminder}`,
            },
          };
 }
