import { evaluateAutoExpression } from '../../combat/automation/automationService.js';
import { resolveDiceExpression } from '../../combat/automation/automationExpressions.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { applyHealingDirectly, logHealingToSSE } from '../../automation/common/healingRoll.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

const HEALING_SPELL_NAMES = new Set([
    'aid',
    'aura of life',
    'cure wounds',
    'death ward',
    'greater restoration',
    'heal',
    'healing word',
    'lesser restoration',
    'mass cure wounds',
    'mass healing word',
    'mass heal',
    'prayer of healing',
    'power word heal',
    'regenerate',
    'revivify',
]);

function isHealingSpell(spell) {
    return HEALING_SPELL_NAMES.has((spell.name || '').toLowerCase());
}

function getPostCastSelfHeals(playerStats) {
    const passives = playerStats.automation?.passives ?? [];
    return passives.filter(p => p.type === 'post_cast_self_heal');
}

function getPostCastAllyHeals(playerStats, campaignName) {
    const passives = playerStats.automation?.passives ?? [];
    const storedBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(storedBuffs) ? storedBuffs : (playerStats.activeBuffs ?? []);
    const allyHealPassives = passives.filter(p => p.type === 'post_cast_ally_heal');
    const starryBuffs = activeBuffs.filter(b => b.name === 'Starry Form');
    const starryFormActive = starryBuffs.some(b => b.constellation === 'Chalice');
    if (!starryFormActive) {
        return [];
    }
    return allyHealPassives;
}

// Shared guard: only leveled healing spells trigger post-cast heals.
function canTriggerPostCastHeal(spell) {
    return isHealingSpell(spell) && spell.level !== 0;
}

// Shared level/slot validation for both post-cast heal paths.
function resolvePostCastLevelContext(playerStats, metaCtx, spell, fnName, resourceLabel) {
    const prof = playerStats.proficiency || 0;
    if (playerStats.level == null) {
        console.error(`[postCastHealService] ${fnName}: playerStats.level is missing`);
        throw new Error(`playerStats.level is required for ${resourceLabel}`);
    }
    const level = playerStats.level;
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error(`[postCastHealService] ${fnName}: slot level is missing (metaCtx.slotLevel and spell.level)`);
        throw new Error(`slot level is required for ${resourceLabel}`);
    }
    const slotLevel = metaCtx?.slotLevel || spell.level;
    return { prof, level, slotLevel };
}

// Resolve a passive's heal expression and roll it. Returns 0 when the
// passive targets self-only spells or the roll is invalid/zero.
function rollPostCastHealAmount(heal, spell, playerStats, prof, level, slotLevel) {
    if (heal.othersOnly && spell.range === 'Self') {
        return 0;
    }

    let expression = heal.healExpression || '0';
    if (level >= 10) {
        expression = expression.replace(/1d8/g, '2d8');
    }
    const resolvedExpression = resolveDiceExpression(expression, playerStats, slotLevel);
    const evaluated = evaluateAutoExpression(resolvedExpression, playerStats, prof, level, slotLevel);
    const rollResult = typeof evaluated === 'number'
        ? { total: evaluated, rolls: [evaluated], formula: resolvedExpression }
        : rollExpression(resolvedExpression);
    const amount = rollResult?.total ?? 0;
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        return 0;
    }
    return amount;
}

export async function triggerPostCastSelfHeals(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!canTriggerPostCastHeal(spell)) {
        return null;
    }

    const selfHeals = getPostCastSelfHeals(playerStats);
    if (selfHeals.length === 0) {
        return null;
    }

    const { prof, level, slotLevel } = resolvePostCastLevelContext(playerStats, metaCtx, spell, 'triggerPostCastSelfHeals', 'post-cast self heals');

    const results = [];
    for (const heal of selfHeals) {
        const amount = rollPostCastHealAmount(heal, spell, playerStats, prof, level, slotLevel);
        if (amount <= 0) {
            continue;
        }

        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, playerStats.name, amount, campaignName);

        logHealingToSSE(campaignName, {
            targetName: playerStats.name,
            sourceName: heal.name,
            actualHeal,
            newHp,
            maxHp,
        });

        results.push({ name: heal.name, amount, actualHeal });
    }

    return results.length > 0 ? results : null;
}

export async function triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!canTriggerPostCastHeal(spell)) {
        return null;
    }

    const allyHeals = getPostCastAllyHeals(playerStats, campaignName);
    if (allyHeals.length === 0) {
        return null;
    }

    const { prof, level, slotLevel } = resolvePostCastLevelContext(playerStats, metaCtx, spell, 'triggerPostCastAllyHeals', 'post-cast ally heals');

    for (const heal of allyHeals) {
        const amount = rollPostCastHealAmount(heal, spell, playerStats, prof, level, slotLevel);
        if (amount <= 0) {
            continue;
        }

        const cs = getCombatSummary(campaignName);
        const creatureNames = (cs?.creatures || []).map(c => c.name);
        const allTargets = [playerStats.name, ...creatureNames.filter(n => n !== playerStats.name)];

        setRuntimeValue('campaign', 'pendingStarryChaliceHeal', {
            amount,
            casterName: playerStats.name,
            campaignName,
            targetNames: allTargets,
            sourceName: heal.name,
        }, campaignName, true);

        return { needsModal: true, amount };
    }

    return null;
}

export async function applyStarryChaliceHeal(targetName, campaignName) {
    const pending = getRuntimeValue('campaign', 'pendingStarryChaliceHeal', campaignName);
    if (!pending) return null;

    const { amount, sourceName } = pending;
    const cs = getCombatSummary(campaignName);
    const result = applyHealingToTarget(cs, targetName, amount, campaignName);

    let newHp, maxHp, actualHeal;
    if (result) {
        newHp = result.newHp;
        actualHeal = result.actualHeal;
        const creature = cs?.creatures?.find(c => c.name === targetName);
        maxHp = creature?.type === 'player'
            ? (getRuntimeValue(targetName, 'hitPoints', campaignName) ?? creature?.maxHp)
            : (creature?.maxHp ?? getRuntimeValue(targetName, 'hitPoints', campaignName) ?? newHp);
    } else {
        const fallback = applyHealingDirectly({}, targetName, amount, campaignName, null);
        newHp = fallback.newHp;
        maxHp = fallback.maxHp;
        actualHeal = fallback.actualHeal;
    }

    logHealingToSSE(campaignName, {
        targetName,
        sourceName,
        actualHeal,
        newHp,
        maxHp,
    });

    setRuntimeValue('campaign', 'pendingStarryChaliceHeal', null, campaignName, true);

    return { targetName, actualHeal, newHp, maxHp };
}
