import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

        if (currentCharges <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'No Channel Divinity charges remaining.',
                    automation: auto,
                },
            };
        }

        const newCharges = currentCharges - 1;
        await setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);
    }

    const spellNames = Array.isArray(auto.spell) ? auto.spell : [auto.spell || action.name];
    const spellName = spellNames.join(' or ');

    const noConcLabel = auto.noConcentration ? ' Does not require Concentration.' : '';
    const durLabel = auto.duration ? ` Duration: ${auto.duration.replace('_', ' ')}.` : '';

    // Handle uses_expression (counter-based free casts, e.g. "WIS modifier_min_1")
    if (auto.uses_expression && auto.usesMax) {
        const freeCastKey = `_${action.name.replace(/\s+/g, '_')}_freeCastCount`;
        const currentCount = Number(getRuntimeValue(playerStats.name, freeCastKey, campaignName) ?? auto.usesMax);

        if (currentCount <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'No free casts remaining. Finish a Long Rest to regain them.',
                    automation: auto,
                },
            };
        }

        const newCount = currentCount - 1;
        await setRuntimeValue(playerStats.name, freeCastKey, newCount, campaignName);

        return {
            type: 'popup',
            payload: {
                html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName} (${newCount} remaining).${noConcLabel}${durLabel}<br/><br/><em>Open your spell sheet and cast ${spellName} normally — no spell slot will be consumed.</em>`,
            },
        };
    }

    if (spellNames.length > 1) {
        if (auto.perSpellTracking) {
            const availableSpells = [];
            for (const sn of spellNames) {
                const usedKey = `_${action.name.replace(/\s+/g, '_')}_${sn.replace(/\s+/g, '_')}_used`;
                const used = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (!used) {
                    const freeKey = `_${action.name.replace(/\s+/g, '_')}_${sn.replace(/\s+/g, '_')}_freeCast`;
                    const stored = getRuntimeValue(playerStats.name, freeKey, campaignName);
                    if (!stored) {
                        await setRuntimeValue(playerStats.name, freeKey, true, campaignName);
                    }
                    availableSpells.push(sn);
                }
            }

            if (availableSpells.length === 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: 'All spells from this feature have been used. Finish a Long Rest to regain them.',
                        automation: auto,
                    },
                };
            }

            return {
                type: 'popup',
                payload: {
                    html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Available free casts:</b> ${availableSpells.join(', ')}<br/><br/><em>Open your spell sheet and cast one — no spell slot will be consumed.</em>`,
                },
            };
        }

        const freeCastKey = `_${action.name.replace(/\s+/g, '_')}_freeCast`;
        const storedSpells = getRuntimeValue(playerStats.name, freeCastKey, campaignName);
        if (!storedSpells) {
            await setRuntimeValue(playerStats.name, freeCastKey, spellNames, campaignName);
        }

        return {
            type: 'popup',
            payload: {
                html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Channel Divinity expended.</b><br/>You can now cast <b>${spellName}</b> without expending a spell slot.${noConcLabel}${durLabel}<br/><br/><em>Open your spell sheet and cast ${spellName} normally — no spell slot will be consumed.</em>`,
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

    const freeCastKey = `_${action.name.replace(/\s+/g, '_')}_freeCast`;
    const storedSpells = getRuntimeValue(playerStats.name, freeCastKey, campaignName);
    if (!storedSpells) {
        await setRuntimeValue(playerStats.name, freeCastKey, spellNames, campaignName);
    }

    return {
        type: 'popup',
        payload: {
            html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${noConcLabel}${durLabel}`,
            },
          };
 }
