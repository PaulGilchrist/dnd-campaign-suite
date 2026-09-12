import { buildSaveDc } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';

function mazePopup(name, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
        },
    };
}

function getMazeEffects() {
    return (getRuntimeValue('campaign', 'targetEffects') || []).filter(te => te.effect === 'maze');
}

/**
 * True when a creature is currently trapped by Maze.
 */
export function isCreatureTrappedInMaze(creatureName) {
    if (!creatureName) return false;
    return getMazeEffects().some(te => te.target === creatureName);
}

/**
 * True when an attack/effect between attacker and target must be blocked by
 * a Maze barrier. Allowed only when both are inside the same maze or
 * both are outside any maze.
 */
export function isMazeBlocked(attackerName, targetName, _campaignName) {
    if (!attackerName || !targetName) return false;
    const mazeEffects = getMazeEffects();
    if (mazeEffects.length === 0) return false;

    const attackerTrapped = mazeEffects.some(te => te.target === attackerName);
    const targetTrapped = mazeEffects.some(te => te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
        // Both trapped — allowed only if they share the same maze (same source)
        const attackerSources = mazeEffects
            .filter(te => te.target === attackerName)
            .map(te => te.source);
        return !mazeEffects.some(te => te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
}

/**
 * Maze spell handler (2024 ruleset).
 * Mechanics:
 * - 60-foot range, single target you can see
 * - Target is banished to a labyrinthine demiplane for the duration
 * - Target remains there for duration or until it escapes
 * - Target can take Study action to escape: DC 20 Intelligence (Investigation) check
 * - On escape: spell ends, target reappears in original space (or nearest unoccupied)
 * - When spell ends (concentration loss, etc.): target reappears in original space (or nearest unoccupied)
 * - Concentration, up to 10 minutes
 * - No attack roll, no save on cast — the banishment is automatic (unlike banishment which requires a save)
 *
 * Note: The 2024 Maze spell does NOT require a saving throw on cast.
 * The target is simply banished. The only escape is the DC 20 INT (Investigation) Study action.
 */

function hasSense(casterSenses, senseName) {
    return casterSenses.some(s => String(s.name || s.type || '').toLowerCase() === senseName);
}

function isTargetInvisibleButUnseen(targetCreature, casterCreature) {
    const targetInvisible = targetCreature.conditions?.some(c => {
        const cStr = typeof c === 'object' ? String(c.key || c) : String(c);
        return cStr.toLowerCase() === 'invisible';
    });
    const casterSenses = casterCreature?.senses || [];
    const hasTruesight = hasSense(casterSenses, 'truesight');
    const hasBlindsight = hasSense(casterSenses, 'blindsight');
    return targetInvisible && !hasTruesight && !hasBlindsight;
}

function applyMazeBanishment(campaignName, casterName, action, targetName, dc, casterCreature, playerStats, cs) {
    // Maze doesn't require a save — the target is simply banished
    // Store spell last attack for rollback tracking
    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
        saveDc: dc,
        attackScope: 'single',
    });

    // Apply maze target effect to track the banishment
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    // Remove any existing maze effect on this target from this caster
    const otherEffects = targetEffects.filter(
        te => !(te.target === targetName && te.effect === 'maze' && te.source === casterName)
    );
    const mazeEffect = {
        effect: 'maze',
        target: targetName,
        source: casterName,
        dc: 20, // Fixed DC for escape check per spell description
        duration: 'Concentration, up to 10 minutes',
        concentration: true,
    };
    setRuntimeValue('campaign', 'targetEffects', [...otherEffects, mazeEffect], campaignName);

    // Store maze metadata for escape trigger tracking
    setRuntimeValue(targetName, 'mazeData', {
        casterName,
        dc: 20, // Fixed DC 20 for INT (Investigation) Study action
        timestamp: Date.now(),
    }, campaignName);

    // Apply incapacitated condition (target is effectively removed from combat)
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'incapacitated'], campaignName);

    // Store condition metadata
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        incapacitated: {
            ...(existingMeta.incapacitated || {}),
            dc: 20,
            ability: 'wis',
        },
    }, campaignName);

    // Track for expiration cleanup
    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'incapacitated' },
        { type: 'remove_target_effect', effectKey: 'maze', target: targetName, source: casterName },
    ], campaignName);

    // Track concentration
    if (casterCreature) {
        const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
        addConcentration(cs, casterName, action.name, concentrationDc);
    }

    // Log to campaign journal
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} is banished to a labyrinthine demiplane.`,
    }).catch((e) => { console.error("[maze] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Incapacitated',
        reason: action.name,
        note: `${targetName} is Incapacitated by ${action.name} (banished to a labyrinthine demiplane). Target can take a Study action (DC 20 INT Investigation) to escape.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[maze] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-maze',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} is banished to a labyrinthine demiplane by ${action.name}.`,
    }).catch((e) => { console.error("[maze] Error:", e); });
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return mazePopup(action.name, `No creatures in combat. ${action.name} has no effect.`);
    }

    const casterName = playerStats.name;

    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return mazePopup(action.name, `No target selected. ${action.name} has no effect.`);
    }

    const targetCreature = cs.creatures.find(c => c.name === targetName);
    if (!targetCreature) {
        return mazePopup(action.name, `Target "${targetName}" not found in combat. ${action.name} has no effect.`);
    }

    const casterCreature = cs.creatures.find(c => c.name === casterName);

    // Check if target is invisible and caster doesn't have truesight/blindsight
    if (isTargetInvisibleButUnseen(targetCreature, casterCreature)) {
        return mazePopup(action.name, `${targetName} is invisible. You can't see the target. ${action.name} has no effect.`);
    }

    applyMazeBanishment(campaignName, casterName, action, targetName, dc, casterCreature, playerStats, cs);

    return mazePopup(action.name, `${targetName} is banished to a labyrinthine demiplane. ${targetName} is Incapacitated and can take a Study action (DC 20 INT Investigation) to escape.`);
}

export function removeMazeEffect(targetName, sourceName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const existing = effects.find(te => te.effect === 'maze' && te.target === targetName && te.source === sourceName);
    if (!existing) return null;

    setRuntimeValue(
        'campaign',
        'targetEffects',
        effects.filter(te => !(te.effect === 'maze' && te.target === targetName && te.source === sourceName)),
        campaignName
    );
    return existing;
}

/**
 * mazeEscapeHandler — triggered when a maze'd creature takes a Study action
 * to escape the demiplane.
 * Mechanics:
 * - DC 20 Intelligence (Investigation) check
 * - On success: target escapes, spell ends, target reappears in original space
 * - On failure: target remains trapped
 */
export async function handleEscape(action, playerStats, campaignName, _mapName) {
    const targetName = action.metaCtx?.mazeTargetName;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Maze Escape',
                description: 'No target specified for Maze escape check.',
            },
        };
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const mazeEffect = targetEffects.find(
        te => te.effect === 'maze' && te.target === targetName
    );

    if (!mazeEffect) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Maze Escape',
                description: `${targetName} is not trapped by Maze.`,
            },
        };
    }

    const targetCreature = (action.metaCtx?.creatures || []).find(c => c.name === targetName);
    const intBonus = targetCreature?.abilities?.INT?.bonus ?? 0;
    const intProficiency = targetCreature?.proficiency ?? 0;
    const saveDc = mazeEffect.dc || 20;

    // Roll the INT (Investigation) check for Study action
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + intBonus + intProficiency;
    const success = total >= saveDc;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Maze Escape Attempt (Study Action)',
        description: `${targetName} attempts to escape Maze using Study action. INT (Investigation) check: ${roll} + ${intBonus + intProficiency} = ${total} vs DC ${saveDc}.`,
    }).catch((e) => { console.error("[mazeEscape] Error:", e); });

    if (success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: targetName,
            rollType: 'save-maze-escape',
            targetName,
            saveDc,
            saveType: 'INT',
            success: true,
            description: `${targetName} succeeded on INT (Investigation) check (${total} vs DC ${saveDc}) and escaped the Maze.`,
        }).catch((e) => { console.error("[mazeEscape] Error:", e); });

        // Remove the maze effect
        const remainingEffects = targetEffects.filter(
            te => !(te.effect === 'maze' && te.target === targetName)
        );
        setRuntimeValue('campaign', 'targetEffects', remainingEffects, campaignName);

        // Clear maze metadata
        setRuntimeValue(targetName, 'mazeData', null, campaignName);

        // Remove incapacitated condition from the target
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

        addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Incapacitated',
            reason: 'Maze escape',
            note: `${targetName} escaped the Maze and is no longer Incapacitated.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[mazeEscape] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Maze Escape',
                description: `${targetName} succeeded on INT (Investigation) check (${total} vs DC ${saveDc}) and escaped the Maze. ${targetName} reappears in the space it left, or the nearest unoccupied space if that space is occupied.`,
            },
        };
    } else {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: targetName,
            rollType: 'save-maze-escape',
            targetName,
            saveDc,
            saveType: 'INT',
            success: false,
            description: `${targetName} failed INT (Investigation) check (${total} vs DC ${saveDc}) and remains trapped in the Maze.`,
        }).catch((e) => { console.error("[mazeEscape] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Maze Escape',
                description: `${targetName} failed INT (Investigation) check (${total} vs DC ${saveDc}) and remains trapped in the Maze.`,
            },
        };
    }
}
