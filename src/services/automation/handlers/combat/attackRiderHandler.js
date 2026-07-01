import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || action;
    const options = auto.options || [];

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch(() => {});

    if (options.length > 0 && (auto.chooseOne || (auto.maxEffects || 1) > 1)) {
        return {
            type: 'modal',
            modalName: 'attackRider',
            payload: {
                action,
                playerStats,
                campaignName,
                targetName,
            },
        };
    }

    // Single option — apply immediately
    if (options.length === 1) {
        const chosen = options[0];
        const result = await applyRiderEffect(action, playerStats, campaignName, targetName, chosen);
        return result;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} ready. The next eligible attack will apply it.`,
            automation: auto,
        },
    };
}

export async function applyRiderOption(action, playerStats, campaignName, targetName, optionNames) {
    const auto = action.automation || action;
    const options = auto.options || [];

    const names = Array.isArray(optionNames) ? optionNames : [optionNames];
    const chosenOptions = names.map(name => options.find(o => o.name === name)).filter(Boolean);
    if (chosenOptions.length === 0) return null;

    // Check oncePerTurn for Charger feat
    if (auto.oncePerTurn) {
        const currentRound = getCurrentCombatRound();
        const usedKey = `_${action.name.replace(/\s+/g, '_')}_usedRound`;
        const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
        if (usedRound === currentRound) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} can only be used once per turn.`,
                    automation: auto,
                },
            };
        }
    }

    setRuntimeValue(playerStats.name, 'pendingRiderChoice', null, campaignName);

    // Validate prerequisites and size limits before applying
    for (const chosen of chosenOptions) {
        const validation = validateCunningStrikeOption(chosen, targetName, playerStats);
        if (!validation.valid) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: `<b>${chosen.name}</b> cannot be used: ${validation.reason}`,
                        automation: auto,
                    },
                };
        }
    }

    // Mark oncePerTurn as used
    if (auto.oncePerTurn) {
        const currentRound = getCurrentCombatRound();
        const usedKey = `_${action.name.replace(/\s+/g, '_')}_usedRound`;
        await setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
    }

    // Calculate total cost for Cunning Strike (Sneak Attack dice to forgo)
    const totalCostD6 = chosenOptions.reduce((sum, opt) => {
        const costMatch = opt.cost?.match(/^(\d+)d6$/);
        return sum + (costMatch ? parseInt(costMatch[1], 10) : 0);
    }, 0);

    // Deduct Sneak Attack dice if Cunning Strike cost is specified
    if (totalCostD6 > 0) {
        await applyCunningStrikeCost(playerStats, campaignName, totalCostD6);
    }

    const results = [];
    let versatileTricksterSecondaryTarget = null;
    let hasVersatileTrickster = false;

    // Check if Versatile Trickster is available (Arcane Trickster level 13+)
    const hasVersatileTricksterPassive = (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'versatile_trickster'
    );

    for (const chosen of chosenOptions) {
        const res = await applyRiderEffect(action, playerStats, campaignName, targetName, chosen);
        results.push(res);

        // If Trip was applied and Versatile Trickster is available, find secondary targets
        if (chosen.effect === 'prone' && hasVersatileTricksterPassive && targetName) {
            hasVersatileTrickster = true;
            const cs = await getCombatContext(campaignName);
            if (cs?.creatures) {
                const primaryTarget = cs.creatures.find(c => c.name === targetName);
                if (primaryTarget?.position) {
                    const secondaryTargets = cs.creatures
                        .filter(c => c.name !== targetName && c.position)
                        .map(c => ({
                            creature: c,
                            distance: getDistanceFeet(primaryTarget.position, c.position),
                        }))
                        .filter(t => t.distance !== null && t.distance <= 5);
                    if (secondaryTargets.length > 0) {
                        versatileTricksterSecondaryTarget = secondaryTargets.map(t => t.creature);
                    }
                }
            }
        }
    }

    // If Versatile Trickster found secondary Trip targets, set runtime value for modal to pick up
    if (hasVersatileTrickster && versatileTricksterSecondaryTarget && versatileTricksterSecondaryTarget.length > 0) {
        setRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', versatileTricksterSecondaryTarget, campaignName);
        setRuntimeValue(playerStats.name, 'versatileTricksterPrimaryTarget', targetName, campaignName);
        setRuntimeValue(playerStats.name, 'versatileTricksterAction', { type: 'versatile_trickster', automation: { type: 'versatile_trickster', casting_time: 'passive' } }, campaignName);
    }

    if (results.length === 1) {
        return results[0];
    }

    const effectDescriptions = chosenOptions.map(opt => {
        let desc = opt.name;
        if (opt.effect === 'disadvantage_on_next_save') desc += ' — target has Disadvantage on the next saving throw it makes';
        if (opt.noOpportunityAttacks) desc += ' — target cannot make Opportunity Attacks until the start of your next turn';
        if (opt.effect === 'next_attack_advantage') desc += ` — the next attack against ${targetName || 'target'} gains +${opt.value || '5'}`;
        if (opt.effect === 'push_15ft') desc += ' — target pushed 15 ft away';
        if (opt.effect === 'push') desc += ` — target pushed ${opt.value || 10} ft away`;
        if (opt.effect === 'speed_reduction') desc += ' — target Speed reduced by 15 ft';
        if (opt.effect === 'sudden_strike') desc += ' — make another attack against a different creature within 5 ft';
        if (opt.effect === 'mass_fear') desc += ' — target and creatures within 10 ft make WIS save or be Frightened';
        if (opt.effect === 'prone') desc += ' — target has Prone condition';
        if (opt.effect === 'poisoned') desc += ' — target has Poisoned condition (1 min, repeating CON save)';
        if (opt.effect === 'daze') desc += ' — target on next turn can only do one of: move, action, or Bonus Action';
        if (opt.effect === 'unconscious') desc += ' — target has Unconscious condition (1 min, repeating CON save)';
        if (opt.effect === 'blinded') desc += ' — target has Blinded condition (until end of its next turn)';
        if (opt.effect === 'no_opportunity_attacks' && opt.movement) desc += ' — move up to half Speed without provoking Opportunity Attacks';
        if (opt.effect === 'ally_movement' && opt.movement) desc += ' — ally moves up to half Speed without provoking Opportunity Attacks';
        if (opt.effect === 'damage_bonus') desc += ` — ${opt.damageExpression || '1d6'} extra damage`;
        return desc;
    });

    const costNote = totalCostD6 > 0 ? `<br/><em>(Forgoing ${totalCostD6}d6 Sneak Attack damage dice)</em>` : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Applied to ${targetName || 'target'}:<br/>• ${effectDescriptions.join('<br/>• ')}${costNote}`,
            automation: auto,
        },
    };
}

async function applyRiderEffect(action, playerStats, campaignName, targetName, option) {
    const auto = action.automation || action;
    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${option.name}: ${option.effect}<br/><br/><i>No target selected — effect noted for manual application.</i>`,
                automation: auto,
            },
        };
    }

    // Handle sudden_strike: record for bonus action attack
    if (option.effect === 'sudden_strike') {
        setRuntimeValue(playerStats.name, 'pendingSuddenStrike', true, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Sudden Strike enabled. Make a bonus action attack against a different creature within 5 ft of ${targetName}.`,
                automation: auto,
            },
        };
    }

    // Handle mass_fear: apply Frightened condition via targetEffects
    if (option.effect === 'mass_fear') {
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const newEffect = {
            target: targetName,
            source: action.name,
            option: option.name,
            effect: 'mass_fear',
            saveType: option.saveType || 'WIS',
            saveDc: option.saveDc || 'ability',
            saveAbility: option.saveAbility || 'WIS',
            condition: option.condition || 'frightened',
            duration: option.duration || 'until_start_of_next_turn',
            range: option.range || '10_ft',
            noOpportunityAttacks: option.noOpportunityAttacks || false,
        };
        const updatedEffects = [...storedEffects, newEffect];
        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

        const attackerBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
        if (attackerBuffArray.some(b => b.name === 'Psychic Veil')) {
            const attackerConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
            const attackerCondArray = Array.isArray(attackerConditions) ? attackerConditions : [];
            const filteredConditions = attackerCondArray.filter(c => String(c).toLowerCase() !== 'invisible');
            if (filteredConditions.length !== attackerCondArray.length) {
                setRuntimeValue(playerStats.name, 'activeConditions', filteredConditions, campaignName);
            }
            const filteredBuffs = attackerBuffArray.filter(b => b.name !== 'Psychic Veil');
            if (filteredBuffs.length !== attackerBuffArray.length) {
                setRuntimeValue(playerStats.name, 'activeBuffs', filteredBuffs, campaignName);
            }
        }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Mass Fear applied to ${targetName}. Target and creatures within 10 ft must make a Wisdom save or be Frightened until the start of your next turn.`,
                automation: auto,
            },
        };
    }

    // Default: apply standard rider effect
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: targetName,
        source: action.name,
        option: option.name,
        effect: option.effect,
        value: option.value || null,
        noOpportunityAttacks: option.noOpportunityAttacks || false,
        duration: option.duration || 'until_start_of_next_turn',
        saveType: option.saveType || null,
        saveDc: option.saveDc || null,
        saveAbility: option.saveAbility || null,
        condition: option.condition || null,
        repeatingSave: !!option.repeatingSave,
        requires: option.requires || null,
        sizeLimit: option.sizeLimit || null,
        movement: option.movement || null,
        cost: option.cost || null,
        ignoreResistance: !!option.ignoreResistance,
        restoreCost: option.restoreCost || null,
        damageDoubled: option.damageDoubled || auto.damageDoubled || false,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    if (option.saveType) {
        // Trigger saving throw prompt for the target (non-blocking)
        const saveDc = buildSaveDc(option, playerStats);
        const { promise } = createSaveListener(campaignName, {
            targetName,
            saveType: option.saveType,
            saveDc,
            dcSuccess: false,
            saveAbility: option.saveAbility,
        });

        // Apply condition on failure (fire and forget)
        promise.then((saveResult) => {
            if (saveResult.success === false && option.condition) {
                const conditions = getRuntimeValue(targetName, 'conditions') || [];
                const updatedConditions = [...conditions, option.condition];
                setRuntimeValue(targetName, 'conditions', updatedConditions, campaignName);
            }
        }).catch((e) => {
            console.error('[attackRiderHandler] Save listener error:', e);
        });

        // Handle Psychic Veil interaction
        const attackerBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
        if (attackerBuffArray.some(b => b.name === 'Psychic Veil')) {
            const attackerConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
            const attackerCondArray = Array.isArray(attackerConditions) ? attackerConditions : [];
            const filteredConditions = attackerCondArray.filter(c => String(c).toLowerCase() !== 'invisible');
            if (filteredConditions.length !== attackerCondArray.length) {
                setRuntimeValue(playerStats.name, 'activeConditions', filteredConditions, campaignName);
            }
            const filteredBuffs = attackerBuffArray.filter(b => b.name !== 'Psychic Veil');
            if (filteredBuffs.length !== attackerBuffArray.length) {
                setRuntimeValue(playerStats.name, 'activeBuffs', filteredBuffs, campaignName);
            }
        }
    }

    // Build description for Cunning Strike options
    let desc = `${option.name} applied to ${targetName}`;
    if (option.effect === 'poisoned') {
        desc += ' — target must make a Constitution save or be Poisoned for 1 minute (repeats save at end of each turn)';
    } else if (option.effect === 'prone') {
        desc += ' — target must make a Dexterity save or gain the Prone condition';
    } else if (option.effect === 'no_opportunity_attacks' && option.movement) {
        desc += ' — move up to half Speed without provoking Opportunity Attacks';
    } else if (option.effect === 'ally_movement' && option.movement) {
        desc += ' — ally moves up to half Speed without provoking Opportunity Attacks';
    } else if (option.effect === 'daze') {
        desc += ' — target must make a Constitution save or on next turn can only do one of: move, action, or Bonus Action';
    } else if (option.effect === 'unconscious') {
        desc += ' — target must make a Constitution save or be Unconscious for 1 minute (repeats save at end of each turn)';
    } else if (option.effect === 'blinded') {
        desc += ' — target must make a Dexterity save or be Blinded until end of its next turn';
    } else if (option.effect === 'push') {
        desc += ` — target pushed ${option.value || 10} ft away`;
    } else if (option.noOpportunityAttacks) {
        desc += ' — target cannot make Opportunity Attacks until the start of your next turn';
    } else if (option.effect === 'disadvantage_on_next_save') {
        desc += ' — target has Disadvantage on the next saving throw it makes';
    } else if (option.effect === 'next_attack_advantage') {
        desc += ` — the next attack against ${targetName} gains +${option.value || '5'}`;
    } else if (option.effect === 'damage_bonus') {
        desc += ` — ${option.damageExpression || '1d6'} extra damage`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: desc,
            automation: auto,
        },
    };
}

/**
 * Validate a Cunning Strike option before applying it.
 * Checks prerequisites (e.g., Poisoner's Kit) and size limits.
 */
function validateCunningStrikeOption(option, targetName, playerStats) {
    // Check tool/item requirements (e.g., Poisoner's Kit for Poison option)
    if (option.requires) {
        const toolProficiencies = playerStats?.toolProficiencies || [];
        const hasProficiency = toolProficiencies.some(p =>
            p.toLowerCase().includes(option.requires.toLowerCase())
        );
        const inventory = playerStats?.inventory || {};
        const allItems = [
            ...(inventory.equipped || []),
            ...(inventory.backpack || []),
        ];
        const hasItem = allItems.some(item => {
            const itemName = typeof item === 'string' ? item : item.name;
            return itemName && itemName.toLowerCase().includes(option.requires.toLowerCase());
        });
        if (!hasProficiency && !hasItem) {
            return {
                valid: false,
                reason: `Requires ${option.requires} which the character does not have.`,
            };
        }
    }

    // Check size limit for Trip (Large or smaller)
    if (option.sizeLimit === 'large_or_smaller' && targetName) {
        const combatContext = getCombatContextSync(targetName);
        if (combatContext) {
            const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
            const targetSizeIndex = sizeOrder.indexOf(combatContext.size);
            if (targetSizeIndex !== -1 && targetSizeIndex > sizeOrder.indexOf('Large')) {
                return {
                    valid: false,
                    reason: `Target is ${combatContext.size} (too large for Trip — only Large or smaller affected).`,
                };
            }
        }
        // If we can't determine size from combat context, allow it (default assumption: target is valid size)
    }

    // Check size limit for Charger push (one size larger than player)
    if (option.sizeLimit === 'one_size_larger' && targetName) {
        const playerSize = playerStats.size || 'Medium';
        const combatContext = getCombatContextSync(targetName);
        if (combatContext) {
            const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
            const playerSizeIndex = sizeOrder.indexOf(playerSize);
            const targetSizeIndex = sizeOrder.indexOf(combatContext.size);
            if (playerSizeIndex !== -1 && targetSizeIndex !== -1) {
                const maxAllowedIndex = playerSizeIndex + 1;
                if (targetSizeIndex > maxAllowedIndex) {
                    return {
                        valid: false,
                        reason: `Target is ${combatContext.size} (too large for Charger push — only up to ${sizeOrder[maxAllowedIndex]} allowed when player is ${playerSize}).`,
                    };
                }
            }
        }
    }

    return { valid: true };
}

/**
 * Synchronous helper to get target info from combat context.
 * Removed localStorage dependency — now returns null so size validations
 * pass through (default assumption: target is valid size).
 */
function getCombatContextSync(_targetName) {
    // Combat context is now managed via server/SSE only.
    // Size validations that need this data should use the combatSummary
    // from the initiative component state.
    return null;
}

/**
 * Apply Cunning Strike cost by deducting Sneak Attack dice.
 * The cost is specified as "Nd6" meaning N d6 dice to forgo.
 * We track this in runtime state so the damage computation can account for it.
 */
async function applyCunningStrikeCost(playerStats, campaignName, costD6) {
    // Track the Cunning Strike cost for this turn
    const key = '_cunningStrikeCostUsed';
    const currentCost = Number(getRuntimeValue(playerStats.name, key, campaignName) ?? 0);
    await setRuntimeValue(playerStats.name, key, currentCost + costD6, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Cunning Strike',
        description: `Forgoing ${costD6}d6 Sneak Attack damage dice for Cunning Strike cost.`,
    }).catch(() => {});
}
