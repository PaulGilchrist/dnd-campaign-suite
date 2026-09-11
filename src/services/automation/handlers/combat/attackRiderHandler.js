import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { buildSaveDc, createSaveListener } from '../../../automation/common/savePrompt.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { checkOncePerTurn, checkOncePerTurnWithSkip, markOncePerTurn } from '../../common/oncePerTurn.js';
import { parseMagicItemName } from '../../../rules/core/attackCalc.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { restoreBaseAttackAfterBash } from '../../../combat/steps/features/shieldBash.js';
import { resolveMassFear } from './massFearHandler.js';
import { validateCunningStrikeOption, getCombatContextSync, applyCunningStrikeCost } from './cunningStrikeUtils.js';

// Slashing damage hit validation (used by Slasher feat Hamstring)
async function validateSlashingHit(action, playerStats, campaignName) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);

    if (!lastAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No attack hit recorded. Hamstring requires a recent attack hit.',
            },
        };
    }

    if (!lastAttack.hit) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Hamstring requires a hit. Your last attack missed.',
            },
        };
    }

    if (lastAttack.attackerName !== playerStats.name) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Hamstring only works on your own attacks.',
            },
        };
    }

    const damageType = (lastAttack.damageType || '').toLowerCase();
    if (damageType !== 'slashing') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Hamstring requires Slashing damage. Your last attack dealt ${lastAttack.damageType || 'unknown'} damage.`,
            },
        };
    }

    return null;
}

function infoPopup(name, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
        },
    };
}

function hasEquippedShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    const equipment = playerStats.equipment || [];
    return equipped.some(itemName => {
        const { baseName } = parseMagicItemName(itemName);
        const match = equipment.find(e => e.name === baseName);
        return match && (match.armor_category === 'Shield' || match.equipment_category === 'Shield');
    });
}

function resolveShieldBashSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') return buildSaveDc(auto, playerStats);
    return auto.saveDc || (8 + (playerStats.abilities?.find(a => a.name === 'Strength')?.bonus || 0) + (playerStats.proficiency || 0));
}

// Shield Bash with push_or_prone: validate prerequisites and do save first
async function handleShieldBash(action, auto, options, playerStats, campaignName) {
    if (!hasEquippedShield(playerStats)) {
        return infoPopup(action.name, 'Shield Bash requires an equipped shield.');
    }

    // Check lastAttack is player's melee weapon attack
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack?.hit) {
        return infoPopup(action.name, 'Shield Bash requires a hit with a melee weapon attack.');
    }
    if (lastAttack.attackerName !== playerStats.name) {
        return infoPopup(action.name, 'Shield Bash requires your own melee weapon attack.');
    }
    if (lastAttack.weaponType !== 'melee') {
        return infoPopup(action.name, 'Shield Bash requires a melee weapon attack.');
    }

    const targetName = lastAttack.targetName;
    if (!targetName) {
        return infoPopup(action.name, 'Shield Bash: no target found.');
    }

    // Check oncePerTurn with skip
    const skipResult = await checkOncePerTurnWithSkip(action.name, `_${action.name.replace(/\s+/g, '_')}_usedRound`, `_${action.name.replace(/\s+/g, '_')}_skippedRound`, playerStats, campaignName);
    if (skipResult) return skipResult;

    // Build save DC
    const saveDc = resolveShieldBashSaveDc(auto, playerStats);

    // FT-082 collateral: stash the base weapon attack; the save
    // resolution clobbers campaign lastAttack, which would falsely block
    // same-turn Slasher Hamstring. Restored on success / applyShieldBashEffect.
    await setRuntimeValue(playerStats.name, '_shieldBashBaseAttack', lastAttack, campaignName);

    // Create save prompt

    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'STR',
        saveDc,
        dcSuccess: false,
        sourceName: action.name,
    });

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType: 'STR',
        description: `${action.name}: ${targetName} must make a STR saving throw (DC ${saveDc}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    addEntry(campaignName, {
        type: 'roll',
        name: action.name,
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType: 'STR',
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        description: `${targetName} ${success ? 'succeeded' : 'failed'} the STR save (DC ${saveDc}).${!success ? ' Shield Bash effect applied.' : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });

    if (success) {
        await restoreBaseAttackAfterBash(playerStats, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on STR save (DC ${saveDc}). Shield Bash has no effect.`,
                automation: auto,
            },
        };
    }

    // On failed save — show shieldBash modal
    return {
        type: 'modal',
        modalName: 'shieldBash',
        payload: {
            action: {
                name: action.name,
                options: options,
                automation: auto,
            },
            playerStats,
            campaignName,
            targetName,
            saveDc,
        },
    };
}

function oncePerTurnUsedKey(action) {
    const isCsFeature = ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].includes(action.name);
    return isCsFeature ? '_CunningStrike_usedRound' : `_${action.name.replace(/\s+/g, '_')}_usedRound`;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || action;
    let options = auto.options || [];

    // Expand push_or_prone effect into options (used by Shield Master 2024)
    if (options.length === 0 && auto.effect === 'push_or_prone') {
        options = [
            {
                name: 'Prone',
                effect: 'prone',
                saveType: auto.saveType || 'STR',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'STR',
            },
        ];
    }

    if (auto.trigger === 'slashing_damage_hit') {
        const invalid = await validateSlashingHit(action, playerStats, campaignName);
        if (invalid) return invalid;
    }

    if (auto.effect === 'push_or_prone' && auto.oncePerTurn && auto.trigger) {
        return handleShieldBash(action, auto, options, playerStats, campaignName);
    }

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} used${targetName ? ` against ${targetName}` : ''}`,
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });

    if (auto.oncePerTurn) {
        const usedKey = oncePerTurnUsedKey(action);
        const skip = await checkOncePerTurn(action.name, usedKey, playerStats.name, campaignName);
        if (skip) return skip;
    }

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
        if (auto.oncePerTurn) {
            const usedKey = oncePerTurnUsedKey(action);
            await markOncePerTurn(action.name, usedKey, playerStats, campaignName);
        }
        const chosen = options[0];
        const result = await applyRiderEffect(action, playerStats, campaignName, targetName, chosen, _mapName);
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

    // CLA-376: clear stale Versatile Trickster picker keys at apply entry so
    // the AttackRiderModal only ever reads this cast's freshly-written keys
    // (stale-key replay re-surfaced the chooser on non-Trip applies).
    setRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', null, campaignName);
    setRuntimeValue(playerStats.name, 'versatileTricksterPrimaryTarget', null, campaignName);
    setRuntimeValue(playerStats.name, 'versatileTricksterAction', null, campaignName);

    // Check oncePerTurn for Charger feat
    if (auto.oncePerTurn) {
        const usedKey = oncePerTurnUsedKey(action);
        const skip = await checkOncePerTurn(action.name, usedKey, playerStats.name, campaignName);
        if (skip) return skip;
    }

    setRuntimeValue(playerStats.name, 'pendingRiderChoice', null, campaignName);

    // Store the chosen option for features that read it from runtime state (e.g., Stalker's Flurry)
    const optKey = `_${action.name.replace(/\s+/g, '_')}_option`;
    if (chosenOptions.length === 1) {
            // Storing option in chosenOptions
        await setRuntimeValue(playerStats.name, optKey, chosenOptions[0].name, campaignName);
    }

    // Validate prerequisites and size limits before applying
    for (const chosen of chosenOptions) {
        const validation = validateCunningStrikeOption(chosen, targetName, playerStats, getCombatContextSync);
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
        const usedKey = oncePerTurnUsedKey(action);
        await markOncePerTurn(action.name, usedKey, playerStats, campaignName);
    }

    // Calculate total cost for Cunning Strike (Sneak Attack dice to forgo)
    const totalCostD6 = chosenOptions.reduce((sum, opt) => {
        const costMatch = opt.cost?.match(/^(\d+)d6$/);
        return sum + (costMatch ? parseInt(costMatch[1], 10) : 0);
    }, 0);

    // Deduct Sneak Attack dice if Cunning Strike cost is specified
    if (totalCostD6 > 0) {
        await applyCunningStrikeCost(playerStats, campaignName, totalCostD6, getRuntimeValue, setRuntimeValue, addEntry);
    }

    const results = [];
    let versatileTricksterSecondaryTarget = null;
    let hasVersatileTrickster = false;

    // Check if Versatile Trickster is available (Arcane Trickster level 13+)
    const hasVersatileTricksterPassive = (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'versatile_trickster'
    );

    for (const chosen of chosenOptions) {
        const res = await applyRiderEffect(action, playerStats, campaignName, targetName, chosen, undefined);
        results.push(res);

        // If Trip was applied and Versatile Trickster is available, find secondary targets
        if (chosen.effect === 'prone' && hasVersatileTricksterPassive && targetName) {
            hasVersatileTrickster = true;
            const secondaryTargets = await scanNearbySecondaryTargets(campaignName, targetName);
            if (secondaryTargets.length > 0) {
                versatileTricksterSecondaryTarget = secondaryTargets;
            }
        }
    }

    // If Versatile Trickster found secondary Trip targets, set runtime value for modal to pick up
    if (hasVersatileTrickster && versatileTricksterSecondaryTarget && versatileTricksterSecondaryTarget.length > 0) {
        setRuntimeValue(playerStats.name, 'versatileTricksterSecondaryTargets', versatileTricksterSecondaryTarget, campaignName);
        setRuntimeValue(playerStats.name, 'versatileTricksterPrimaryTarget', targetName, campaignName);
        setRuntimeValue(playerStats.name, 'versatileTricksterAction', { type: 'versatile_trickster', automation: { type: 'versatile_trickster', casting_time: 'passive' } }, campaignName);
    }

    // If Sudden Strike or Mass Fear was applied, find secondary targets for the effect
    const hasStalkersFlurry = chosenOptions.some(o => o.effect === 'sudden_strike');
    let stalkersFlurrySecondaryTarget = null;
    if (hasStalkersFlurry && targetName) {
        stalkersFlurrySecondaryTarget = await scanNearbySecondaryTargets(campaignName, targetName);
    }

    if (stalkersFlurrySecondaryTarget && stalkersFlurrySecondaryTarget.length > 0) {
        const stalkerFlurryOptions = chosenOptions.map(o => o.name);
        // CLA-326: store the combatant objects directly (like versatileTrickster
        // secondary targets) — cs creatures have no `.creature` field, so the old
        // `.map(t => t.creature)` produced undefined rows that crashed the picker
        // and left the featureRiders pause unresolved (stranded trigger-hit damage).
        setRuntimeValue(playerStats.name, 'stalkersFlurrySecondaryTargets', stalkersFlurrySecondaryTarget, campaignName);
        setRuntimeValue(playerStats.name, 'stalkersFlurryPrimaryTarget', targetName, campaignName);
        setRuntimeValue(playerStats.name, 'stalkersFlurryOptions', stalkerFlurryOptions, campaignName);
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

async function scanNearbySecondaryTargets(campaignName, targetName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return [];
    const secondaryTargets = [];
    for (const c of cs.creatures) {
        if (c.name === targetName) continue;
        if (await isWithinRange(targetName, c.name, 5)) secondaryTargets.push(c);
    }
    return secondaryTargets;
}

function riderNotice(name, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}

// Remove Psychic Veil buff (and its Invisible condition) from the attacker
// when a psychic-fueled rider triggers.
function stripPsychicVeil(playerStats, campaignName) {
    const attackerBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
    if (!attackerBuffArray.some(b => b.name === 'Psychic Veil')) return;

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

// Push effect: just log and popup, no targetEffect (push is instant)
function applyPushEffect(action, auto, playerStats, campaignName, targetName, option) {
    const pushDistance = option.value || 10;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} pushed ${targetName} ${pushDistance} feet away.`,
        targetName: targetName,
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });
    return riderNotice(action.name, auto, `${targetName} was pushed ${pushDistance} feet away.`);
}

function buildRiderEffect(action, targetName, playerStats, option, auto) {
    return {
        target: targetName,
        source: playerStats.name,
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
        damageExpression: option.damageExpression || null,
        damageType: option.damageType || null,
        label: auto.name || action.name,
    };
}

// Log speed_reduction effect immediately (before save handling)
function logSpeedReduction(action, playerStats, campaignName, targetName, option) {
    const speedValue = option.value || 10;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used Hamstring on ${targetName}: target's Speed reduced by ${speedValue} ft until the start of ${playerStats.name}'s next turn`,
        targetName: targetName,
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });

    // FT-082: register expiry so "until the start of your next turn" is
    // enforced. Drain seam: expireStaleEffects phase 1 (navigationHandlers
    // / sseHandlers turn boundaries) expires entries whose
    // expireOnCreatureName matches the newly active store owner once the
    // round has advanced — i.e. at the holder's next turn start (same
    // verified pattern as slasher.js slasher_enhanced_critical).
    // Scoped by effect+source+option+target so other speed_reduction
    // writers (Slow mastery, giant ancestry) are untouched.
    if (!option.saveType) {
        addExpiration(playerStats.name, targetName, [
            { type: 'remove_target_effect', effectKey: 'speed_reduction', source: playerStats.name, option: option.name, target: targetName }
        ], campaignName, undefined, playerStats.name);
    }
}

// Envenom Weapons: when Poison option of Cunning Strike fails, apply 2d6 Poison damage ignoring resistance
async function applyEnvenomWeapons(playerStats, campaignName, targetName) {
    const passives = playerStats.automation?.passives || [];
    const envenomPassive = passives.find(p =>
        p.type === 'damage_bonus' &&
        p.trigger === 'cunning_strike_poison_save_fail' &&
        p.name === 'Envenom Weapons'
    );
    if (!envenomPassive) return;

    const rollResult = rollExpression(envenomPassive.automation?.damageExpression || '2d6');
    const poisonDamage = rollResult?.total || 7;
    if (poisonDamage <= 0) return;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return;

    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    await applyDamageToTarget(
        combatSummary,
        targetName,
        poisonDamage,
        [envenomPassive.automation?.damageType || 'Poison'],
        campaignName,
        characters,
        true,
        playerStats.name
    );
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Envenom Weapons',
        description: `2d6 Poison damage (${poisonDamage}) applied to ${targetName} on failed Cunning Strike poison save`,
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });
}

async function handleRiderSave(action, playerStats, campaignName, targetName, option) {
    const saveDc = buildSaveDc(option, playerStats);
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: option.saveType,
        saveDc,
        dcSuccess: false,
        saveAbility: option.saveAbility,
    });

    const saveResult = await promise;

    if (saveResult.success === false && option.condition) {
        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== option.condition.toLowerCase());
        const updatedConditions = [...filtered, option.condition];
        setRuntimeValue(targetName, 'activeConditions', updatedConditions, campaignName);
    }

    if (saveResult.success === false && option.effect === 'poisoned' && option.saveType === 'CON') {
        await applyEnvenomWeapons(playerStats, campaignName, targetName);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${option.name} applied to ${targetName} — ${targetName} rolled ${saveResult.roll} on ${option.saveType} save (DC ${saveDc}), ${saveResult.success ? 'succeeded' : 'failed'} — ${saveResult.success ? 'no effect' : `${option.condition} condition applied`}`,
    }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });

    // Handle Psychic Veil interaction
    stripPsychicVeil(playerStats, campaignName);

    return null;
}

// Ordered dispatch for no-save Cunning Strike option descriptions
const NO_SAVE_DESCRIPTION_RULES = [
    [o => o.effect === 'poisoned', () => ' — target must make a Constitution save or be Poisoned for 1 minute (repeats save at end of each turn)'],
    [o => o.effect === 'prone', () => ' — target must make a Dexterity save or gain the Prone condition'],
    [o => o.effect === 'no_opportunity_attacks' && o.movement, () => ' — move up to half Speed without provoking Opportunity Attacks'],
    [o => o.effect === 'ally_movement' && o.movement, () => ' — ally moves up to half Speed without provoking Opportunity Attacks'],
    [o => o.effect === 'daze', () => ' — target must make a Constitution save or on next turn can only do one of: move, action, or Bonus Action'],
    [o => o.effect === 'unconscious', () => ' — target must make a Constitution save or be Unconscious for 1 minute (repeats save at end of each turn)'],
    [o => o.effect === 'blinded', () => ' — target must make a Dexterity save or be Blinded until end of its next turn'],
    [o => o.effect === 'speed_reduction', o => ` — target's Speed reduced by ${o.value || 10} ft until the start of your next turn`],
    [o => o.noOpportunityAttacks, () => ' — target cannot make Opportunity Attacks until the start of your next turn'],
    [o => o.effect === 'disadvantage_on_next_save', () => ' — target has Disadvantage on the next saving throw it makes'],
    [o => o.effect === 'next_attack_advantage', (o, targetName) => ` — the next attack against ${targetName} gains +${o.value || '5'}`],
    [o => o.effect === 'damage_bonus', o => ` — ${o.damageExpression || '1d6'} extra damage`],
];

// Build description for Cunning Strike options
function buildNoSaveDescription(action, playerStats, campaignName, targetName, option) {
    let desc = `${option.name} applied to ${targetName}`;
    const rule = NO_SAVE_DESCRIPTION_RULES.find(([when]) => when(option));
    if (rule) desc += rule[1](option, targetName);

    if (option.effect === 'no_opportunity_attacks' && option.movement) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Cunning Strike',
            description: `${option.name} — ${playerStats.name} can move up to half Speed without provoking Opportunity Attacks.`,
        }).catch((e) => { console.error("[attackRiderHandler:log-error]", e); });
    }
    return desc;
}

async function applyRiderEffect(action, playerStats, campaignName, targetName, option, _mapName) {
    const auto = action.automation || action;
    if (!targetName) {
        return riderNotice(action.name, auto, `${option.name}: ${option.effect}<br/><br/><i>No target selected — effect noted for manual application.</i>`);
    }

    // Handle sudden_strike: record for bonus action attack
    if (option.effect === 'sudden_strike') {
        setRuntimeValue(playerStats.name, 'pendingSuddenStrike', true, campaignName);
        return riderNotice(action.name, auto, `Sudden Strike enabled. Make a bonus action attack against a different creature within 5 ft of ${targetName}.`);
    }

    // Handle mass_fear: resolve saves directly
    if (option.effect === 'mass_fear') {
        stripPsychicVeil(playerStats, campaignName);
        return resolveMassFear(campaignName, playerStats.name, targetName, option, playerStats, _mapName);
    }

    if (option.effect === 'push') {
        return applyPushEffect(action, auto, playerStats, campaignName, targetName, option);
    }

    // Default: apply standard rider effect
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const newEffect = buildRiderEffect(action, targetName, playerStats, option, auto);
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);

    if (option.effect === 'speed_reduction') {
        logSpeedReduction(action, playerStats, campaignName, targetName, option);
    }

    if (option.saveType) {
        return handleRiderSave(action, playerStats, campaignName, targetName, option);
    }

    return riderNotice(action.name, auto, buildNoSaveDescription(action, playerStats, campaignName, targetName, option));
}


