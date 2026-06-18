import { evaluateAutoExpression } from '../../combat/automation/automationService.js';
import { applyHealingDirectly, logHealingToSSE } from '../../automation/common/healingRoll.js';

const HEALING_SPELL_NAMES = new Set([
    'aid',
    'aura of life',
    'bless',
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
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[postCastHealService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    return passives.filter(p => p.type === 'post_cast_self_heal');
}

function getPostCastAllyHeals(playerStats) {
    const passives = playerStats.automation?.passives;
    if (passives == null) {
        console.error('[postCastHealService] Missing array:', passives);
        throw new Error('Expected array, got ' + passives);
    }
    const activeBuffs = playerStats.activeBuffs;
    if (activeBuffs == null) {
        console.error('[postCastHealService] Missing array:', activeBuffs);
        throw new Error('Expected array, got ' + activeBuffs);
    }
    const starryFormActive = activeBuffs.some(b => b.name === 'Starry Form' && b.constellation === 'Chalice');
    if (!starryFormActive) {
        return [];
    }
    return passives.filter(p => p.type === 'post_cast_ally_heal');
}

export function hasPostCastSelfHeal(playerStats) {
    return getPostCastSelfHeals(playerStats).length > 0;
}

export async function triggerPostCastSelfHeals(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isHealingSpell(spell)) {
        return null;
    }

    if (spell.level === 0) {
        return null;
    }

    const selfHeals = getPostCastSelfHeals(playerStats);
    if (selfHeals.length === 0) {
        return null;
    }

    const results = [];
    const prof = playerStats.proficiency || 0;
    if (playerStats.level == null) {
        console.error('[postCastHealService] triggerPostCastSelfHeals: playerStats.level is missing')
        throw new Error('playerStats.level is required for post-cast self heals')
      }
      const level = playerStats.level
      if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[postCastHealService] triggerPostCastSelfHeals: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for post-cast self heals')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;

    for (const heal of selfHeals) {
        if (heal.othersOnly && spell.range === 'Self') {
            continue;
        }

        let expression = heal.healExpression || '0';
        const isTwinkled = level >= 10;
        if (isTwinkled) {
            expression = expression.replace(/1d8/g, '2d8');
        }
        const amount = evaluateAutoExpression(expression, playerStats, prof, level, slotLevel);
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
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
    if (!isHealingSpell(spell)) {
        return null;
    }

    if (spell.level === 0) {
        return null;
    }

    const allyHeals = getPostCastAllyHeals(playerStats);
    if (allyHeals.length === 0) {
        return null;
    }

    const results = [];
    const prof = playerStats.proficiency || 0;
    if (playerStats.level == null) {
        console.error('[postCastHealService] triggerPostCastAllyHeals: playerStats.level is missing')
        throw new Error('playerStats.level is required for post-cast ally heals')
      }
      const level = playerStats.level
      if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[postCastHealService] triggerPostCastAllyHeals: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for post-cast ally heals')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;

    for (const heal of allyHeals) {
        if (heal.othersOnly && spell.range === 'Self') {
            continue;
        }

        let expression = heal.healExpression || '0';
        const isTwinkled = level >= 10;
        if (isTwinkled) {
            expression = expression.replace(/1d8/g, '2d8');
        }
        const amount = evaluateAutoExpression(expression, playerStats, prof, level, slotLevel);
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            continue;
        }

        const targetName = heal.targetName || playerStats.name;
        const { newHp, maxHp, actualHeal } = applyHealingDirectly(playerStats, targetName, amount, campaignName);

        logHealingToSSE(campaignName, {
            targetName,
            sourceName: heal.name,
            actualHeal,
            newHp,
            maxHp,
        });

        results.push({ name: heal.name, amount, actualHeal, targetName });
    }

    return results.length > 0 ? results : null;
}
