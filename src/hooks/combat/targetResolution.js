import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js';
import { checkCompelledDuelAttackExpiry } from '../../services/automation/handlers/spells/compelledDuelHandler.js';
import { getManeuversForRules } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { loadManeuvers } from '../../services/ui/dataLoader.js';
import { getSuperiorityDice } from './battleMaster.js';

// Compute available superiority maneuvers for skill/initiative checks
async function computeAvailableSuperiorityManeuvers(context, characterName, campaignName, getKnownManeuvers) {
    const knownNames = getKnownManeuvers(characterName, campaignName);
    const superiorityDice = getSuperiorityDice(characterName, campaignName);
    if (!(knownNames.length > 0 && superiorityDice > 0)) return null;
    const allManeuvers = await loadManeuvers('2024');
    const isInitiative = context.rollType === 'initiative';
    const skillName = isInitiative ? 'Initiative' : context.name;
    return allManeuvers.filter(m => {
        if (!knownNames.includes(m.name)) return false;
        if (m.actionType !== 'skill_check') return false;
        if (m.initiativeBonus && isInitiative) return true;
        if (m.skills && m.skills.length > 0) {
            const skillLower = skillName?.toLowerCase() || '';
            return m.skills.some(s => s.toLowerCase().includes(skillLower) || skillLower.includes(s.toLowerCase()));
        }
        return false;
    }).map(m => ({
        name: m.name,
        dieExpression: m.dieExpression || 'superiority_die',
        skills: m.skills || [],
        isInitiative: !!m.initiativeBonus,
    }));
}

function resolveCombatTarget(combatSummary, characterName, explicitTargetName) {
    const fallbackTarget = () => (combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null);
    if (!explicitTargetName) return fallbackTarget();
    return findCreatureByName(combatSummary, explicitTargetName) || fallbackTarget();
}

// Compelled Duel / Taunting Step: disadvantage on attacks against creatures other than source
function applySourceGatedDisadvantage(context, characterName, target) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const sourceGatedEffects = allTargetEffects.filter(te =>
        (te.effect === 'compelled_duel' || te.effect === 'taunting_step') &&
        te.target === utils.getName(characterName) &&
        te.source && te.source !== target.name
    );
    if (sourceGatedEffects.length === 0) return;
    if (context.forcedMode === 'advantage') {
        context.forcedMode = 'normal';
    } else if (context.forcedMode === 'normal' || context.forcedMode == null) {
        context.forcedMode = 'disadvantage';
    }
}

export async function resolveTarget(characterName, campaignName, context, combatSummary, characters, getKnownManeuvers) {
    const rollType = context?.rollType;
    const isSkillCheckContext = rollType === 'check' || rollType === 'skill' || rollType === 'initiative';

    // Pre-load maneuver cache for skill check / initiative superiority buttons
    if (isSkillCheckContext) {
        await getManeuversForRules('2024');
    }

    const availableSuperiorityManeuvers = isSkillCheckContext
        ? await computeAvailableSuperiorityManeuvers(context, characterName, campaignName, getKnownManeuvers)
        : null;

    const target = resolveCombatTarget(combatSummary, characterName, context?.targetName);

    if (rollType === 'attack' && target) {
        // Compelled Duel: the caster attacking a creature other than the duel target ends the effect
        const duelPopup = checkCompelledDuelAttackExpiry(characterName, target.name, campaignName);
        if (duelPopup) {
            context._duelPopup = duelPopup;
        }
        applySourceGatedDisadvantage(context, characterName, target);
    }

    return { target, availableSuperiorityManeuvers };
}
