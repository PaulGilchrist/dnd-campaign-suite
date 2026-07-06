import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../../../services/rules/spells/postCastRiderService.js';
import { getMagicInitiateLevel1Spell } from '../feats/magicInitiateHandler.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import storage from '../../../ui/storage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    // Magic Initiate: read spell name from runtime state if automation spell is explicitly empty string
    let spellName = auto.spell || action.name;
    if (auto.spell === '') {
        const miSpell = getMagicInitiateLevel1Spell(playerStats, campaignName);
        if (miSpell) {
            spellName = miSpell;
        }
    }

    // Mantle of Majesty: set activeBuffs for concentration-gated free cast
    if (action.name === 'Mantle of Majesty' && auto.type === 'free_spell' && auto.concentration) {
        const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const buffsArray = Array.isArray(activeBuffs) ? activeBuffs : [];
        if (buffsArray.some(b => b.name === 'Mantle of Majesty')) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} is already active.`,
                    automation: auto,
                },
            };
        }
        const newBuffs = [...buffsArray, { name: 'Mantle of Majesty', effect: 'mantle_of_majesty', duration: '1_minute' }];
        await setRuntimeValue(playerStats.name, 'activeBuffs', newBuffs, campaignName);
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'remove_active_buff', buffName: 'Mantle of Majesty' }
        ], campaignName, 10);

        // Set concentration on combat summary so initiative tracker shows it
        const combatSummary = getCombatSummary(campaignName);
        if (combatSummary) {
            const dc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
            addConcentration(combatSummary, playerStats.name, 'Mantle of Majesty', dc);
            storage.set('combatSummary', combatSummary, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }

        await postLogEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${playerStats.name} activated Mantle of Majesty. Command is now available as a free bonus action for 1 minute or until concentration ends.`,
        }).catch(() => {});
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} activated! Command is now available as a free bonus action for 1 minute or until concentration ends.`,
                automation: auto,
            },
        };
    }

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

        // War God's Blessing: state-based activation, not per-spell tracking
        if (auto.noConcentration && auto.spell && Array.isArray(auto.spell) && auto.spell.length > 1) {
            await setRuntimeValue(playerStats.name, '_War_Gods_Blessing_active', true, campaignName);
            postLogEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${playerStats.name} activated ${action.name} for 1 minute. ${auto.spell.join(' and ')} can be cast without expending a spell slot or requiring Concentration.`,
            }).catch(() => {});
            return {
                type: 'popup',
                payload: {
                    html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Channel Divinity expended.</b><br/>For 1 minute, you can cast <b>${auto.spell.join(' and ')}</b> without expending a spell slot. The spells do not require Concentration.<br/><br/><em>Open your spell sheet and cast them normally — no spell slot will be consumed.</em>`,
                },
            };
        }

        // Reset per-spell used flags when activating a channel divinity free_spell
        if (auto.perSpellTracking && auto.spell) {
            const spells = Array.isArray(auto.spell) ? auto.spell : [auto.spell];
            for (const sn of spells) {
                const usedKey = `_${action.name.replace(/\s+/g, '_')}_${sn.replace(/\s+/g, '_')}_used`;
                const freeKey = `_${action.name.replace(/\s+/g, '_')}_${sn.replace(/\s+/g, '_')}_freeCast`;
                await setRuntimeValue(playerStats.name, usedKey, null, campaignName);
                await setRuntimeValue(playerStats.name, freeKey, null, campaignName);
            }
            postLogEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${playerStats.name} activated ${action.name}, gaining free casts of ${spells.join(' or ')}. Channel Divinity charges: ${newCharges}.`,
            }).catch(() => {});
        }
    }

    // For multi-spell automation, use auto.spell array directly; otherwise use resolved spellName
    const spellNames = Array.isArray(auto.spell) ? auto.spell : [spellName];
    const spellLabel = spellNames.join(' or ');

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
                const rechargeText = auto.recharge === 'short_or_long_rest'
                    ? 'Finish a Short or Long Rest to regain them.'
                    : 'Finish a Long Rest to regain them.';
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `All spells from this feature have been used. ${rechargeText}`,
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
                html: `<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Channel Divinity expended.</b><br/>You can now cast <b>${spellLabel}</b> without expending a spell slot.${noConcLabel}${durLabel}<br/><br/><em>Open your spell sheet and cast ${spellLabel} normally — no spell slot will be consumed.</em>`,
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
        let formula = slotDmg?.[Object.keys(slotDmg)[0]];
        if (formula) {
            const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
            const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
            const spellSchool = (spellData.school || '').toLowerCase();
            const isEvocation = spellSchool === 'evocation';
            const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
            if (shouldApplyEmpoweredEvoc) {
                formula = `${formula} + ${empEvocIntMod} [Empowered Evocation]`;
            }
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
