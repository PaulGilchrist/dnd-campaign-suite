import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

/**
 * Forcecage spell handler (2024 ruleset).
 * Mechanics:
 * - 100-foot range, Cube-shaped prison of magical force (cage or box)
 * - Creatures completely inside the area are trapped (selected via CreatureSelectionModal)
 * - Trapped creatures can't leave by nonmagical means
 * - No attack, spell, or effect can pass between inside and outside the prison
 * - Trapped creature can attempt a CHA save (click the badge) to use
 *   teleportation/interplanar travel to exit; success ends the trap for that creature
 * - Cage extends into the Ethereal Plane (blocks ethereal travel)
 * - Can't be dispelled by Dispel Magic
 * - Concentration, up to 1 hour (2024)
 */

function getForcecageEffects() {
    const effects = getRuntimeValue('campaign', 'targetEffects') || [];
    return Array.isArray(effects) ? effects.filter(te => te.effect === 'forcecage') : [];
}

/**
 * True when a creature is inside any Forcecage.
 */
export function isCreatureTrappedInForcecage(creatureName) {
    if (!creatureName) return false;
    return getForcecageEffects().some(te => te.target === creatureName);
}

/**
 * True when an attack/effect between attacker and target must be blocked by
 * a Forcecage barrier. Allowed only when both are inside the same cage or
 * both are outside any cage.
 */
export function isForcecageBlocked(attackerName, targetName, _campaignName) {
    if (!attackerName || !targetName) return false;
    const forcecageEffects = getForcecageEffects();
    if (forcecageEffects.length === 0) return false;

    const attackerTrapped = forcecageEffects.some(te => te.target === attackerName);
    const targetTrapped = forcecageEffects.some(te => te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
        // Both trapped — allowed only if they share the same cage (same source)
        const attackerSources = forcecageEffects
            .filter(te => te.target === attackerName)
            .map(te => te.source);
        return !forcecageEffects.some(te => te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
}

/**
 * Remove the Forcecage target effect for a creature inside a specific cage.
 * Returns the removed effect, or null when none was found.
 */
export function removeForcecageEffect(targetName, sourceName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const existing = effects.find(te => te.effect === 'forcecage' && te.target === targetName && te.source === sourceName);
    if (!existing) return null;

    setRuntimeValue(
        'campaign',
        'targetEffects',
        effects.filter(te => !(te.effect === 'forcecage' && te.target === targetName && te.source === sourceName)),
        campaignName
    );
    return existing;
}

function imprisonTarget(targetName, casterName, dc, campaignName) {
    // Track the Forcecage effect with DC and source for cleanup and escape checks
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
    const forcecageEffect = {
        target: targetName,
        effect: 'forcecage',
        source: casterName,
        dc: dc,
        saveAbility: 'CHA',
        duration: 'concentration',
        concentration: true,
    };
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === 'forcecage'
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = forcecageEffect;
    } else {
        effects.push(forcecageEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

    addExpiration(casterName, targetName, [
        { type: 'remove_target_effect', effectKey: 'forcecage', target: targetName, source: casterName },
    ], campaignName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Forcecaged',
        reason: 'Forcecage spell',
        note: `${targetName} is trapped in a Forcecage cast by ${casterName}. Cannot leave by nonmagical means. No attack, spell, or effect can pass between inside and outside the prison. Must make a CHA save (DC ${dc}) to use teleportation or interplanar travel to exit. Cage extends into the Ethereal Plane. Can't be dispelled by Dispel Magic. Concentration, up to 1 hour.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[forcecage] Error:", e); });
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    let dc = buildSaveDc(auto, playerStats);
    if (auto.saveDc === 'ability' && playerStats.spellAbilities?.saveDc != null) {
        dc = playerStats.spellAbilities.saveDc;
    }
    const casterName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures in combat. Forcecage has no effect.',
            },
        };
    }

    // Selected targets come from the CreatureSelectionModal. No fallback — missing
    // targets means the handler was invoked without a proper selection.
    const selectedTargetNames = action.metaCtx?.creatures;
    if (!Array.isArray(selectedTargetNames) || selectedTargetNames.length === 0) {
        console.error(`[forcecage] No creatures selected for Forcecage. action.metaCtx.creatures is missing.`);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Forcecage. Nothing is trapped.',
            },
        };
    }

    const targets = cs.creatures.filter(c => selectedTargetNames.includes(c.name));
    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No creatures selected for Forcecage. Nothing is trapped.',
            },
        };
    }

    // Register concentration (2024 rules — concentration, up to 1 hour)
    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary) {
        const concentrationDc = playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
        addConcentration(combatSummary, casterName, 'Forcecage', concentrationDc);
        storage.set('combatSummary', combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    const trapped = [];

    for (const target of targets) {
        imprisonTarget(target.name, casterName, dc, campaignName);
        trapped.push(target.name);
    }

    const summary = trapped.length > 0
        ? `Forcecage traps ${trapped.length} creature(s): ${trapped.join(', ')}. Trapped creatures can't leave by nonmagical means. No attack, spell, or effect can pass between inside and outside the prison. Click a creature's Forcecaged badge to attempt a CHA save (DC ${dc}); on success the creature can use teleportation or interplanar travel to exit.`
        : 'No creatures trapped by Forcecage.';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: summary,
        },
    };
}

/**
 * forcecageEscapeHandler — triggered when a forcecaged creature attempts
 * teleportation or interplanar travel to escape (forcecage_escape action).
 * Mechanics:
 * - CHA saving throw against the caster's DC
 * - On success: creature escapes and the Forcecage effect is removed
 * - On failure: creature doesn't exit and wastes the spell/effect
 */
export async function handleEscape(action, playerStats, campaignName, _mapName) {
    const targetName = action.metaCtx?.target || action.metaCtx?.forcecageTargetName;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Forcecage Escape',
                description: 'No target specified for Forcecage escape check.',
            },
        };
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(targetEffects) ? targetEffects : [];
    const forcecageEffect = effects.find(
        te => te.effect === 'forcecage' && te.target === targetName
    );

    if (!forcecageEffect) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Forcecage Escape',
                description: `${targetName} is not trapped by Forcecage.`,
            },
        };
    }

    const targetCreature = (action.metaCtx?.creatures || []).find(c => c.name === targetName);
    const chaBonus = targetCreature?.abilities?.CHA?.bonus ?? 0;
    const chaProficiency = targetCreature?.proficiency ?? 0;
    const saveDc = forcecageEffect.dc || 15;

    // Roll the CHA saving throw
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + chaBonus + chaProficiency;
    const success = total >= saveDc;

    if (success) {
        const removed = removeForcecageEffect(targetName, forcecageEffect.source, campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: targetName,
            rollType: 'save-forcecage-escape',
            targetName,
            saveDc,
            saveType: 'CHA',
            success: true,
            description: `${targetName} succeeded on CHA save and escaped the Forcecage.`,
        }).catch((e) => { console.error("[forcecageEscape] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Forcecage Escape',
                description: removed
                    ? `${targetName} succeeded on CHA save (${total} vs DC ${saveDc}) and escaped the Forcecage using teleportation/interplanar travel.`
                    : `${targetName} succeeded on CHA save (${total} vs DC ${saveDc}).`,
            },
        };
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: targetName,
        rollType: 'save-forcecage-escape',
        targetName,
        saveDc,
        saveType: 'CHA',
        success: false,
        description: `${targetName} failed CHA save and remains trapped in Forcecage.`,
    }).catch((e) => { console.error("[forcecageEscape] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Forcecage Escape',
            description: `${targetName} failed CHA save (${total} vs DC ${saveDc}) and remains trapped in the Forcecage. The teleportation/interplanar travel spell or effect is wasted.`,
        },
    };
}
