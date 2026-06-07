import { rollExpression } from '../../dice/diceRoller.js';

export async function handle(action, playerStats, _campaignName, _mapName) {
    const auto = action.automation;
    const spellName = auto.spell || action.name;

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
    return {
        type: 'popup',
        payload: {
            html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${usesInfo}`,
            },
          };
 }
