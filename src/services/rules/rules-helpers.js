import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

/**
 * Determine which ruleset to use. Checks playerStats.rules first,
 * then falls back to playerSummary.rules, then defaults to '5e'.
 */
export function getRulesType(playerStats, playerSummary) {
    if (playerStats && playerStats.rules) return playerStats.rules;
    if (playerSummary && playerSummary.rules) return playerSummary.rules;
    return '5e';
}

export function is2024(playerStats, playerSummary) {
    return getRulesType(playerStats, playerSummary) === '2024';
}

/**
 * Merge automation specialActions back into playerStats.specialActions
 * so features like bonus_healing (Replenishing Meal) appear in CharSpecialActions.
 */
export function mergeAutomationSpecialActions(playerStats) {
    const automationSpecialActions = playerStats.automation?.specialActions || [];
    const existingNames = new Set((playerStats.specialActions || []).map(s => s.name));
    for (const sa of automationSpecialActions) {
        if (!existingNames.has(sa.name)) {
            if (!playerStats.specialActions) playerStats.specialActions = [];
            playerStats.specialActions.push({ name: sa.name, description: sa.description || '', automation: sa, featName: sa.featName, hasAutomation: true });
        }
    }
}

/**
 * Read Fey Touched and Shadow Touched spells from runtime store
 */
export function applyFeyShadowTouchedSpells(playerStats) {
    const ftSpell = getRuntimeValue(playerStats.name, 'feyTouchedSpell');
    if (ftSpell) playerStats.feyTouchedSpell = ftSpell;
    const stSpell = getRuntimeValue(playerStats.name, 'shadowTouchedSpell');
    if (stSpell) playerStats.shadowTouchedSpell = stSpell;
}

/**
 * Preserve rules type for downstream dispatch
 */
export function applyRulesType(playerStats, playerSummary) {
    playerStats.rules = playerSummary.rules || '5e';
}
