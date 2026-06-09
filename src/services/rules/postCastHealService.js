import { evaluateAutoExpression } from '../combat/automationService.js';
import { applyHealingDirectly, logHealingToSSE } from '../automation/common/healingRoll.js';

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
    'prayer of healing',
    'power word heal',
    'regenerate',
    'revivify',
]);

function isHealingSpell(spell) {
    return HEALING_SPELL_NAMES.has((spell.name || '').toLowerCase());
}

function getPostCastSelfHeals(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.filter(p => p.type === 'post_cast_self_heal');
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
    const level = playerStats.level || 1;
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    for (const heal of selfHeals) {
        if (heal.othersOnly && spell.range === 'Self') {
            continue;
        }

        const expression = heal.healExpression || '0';
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
