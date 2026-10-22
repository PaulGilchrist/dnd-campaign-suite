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
 * Preserve rules type for downstream dispatch.
 *
 * #1455(b) EXPLICIT-WINS precedence (flips the old summary-clobbers-stats
 * quirk at :46): an explicit stats-side rules field is the character owner's
 * choice — AGENTS.md dual-ruleset law ("each character has a `rules` field
 * ('5e' or '2024')", both rulesets coexist in one campaign). This write now
 * matches the READ precedence getRulesType enforces at :8-10: stats first,
 * summary is fallback context metadata, '5e' only when both are silent.
 * Pre-fix winner bytes (captured): stats:{rules:'2024'} + summary:{rules:'5e'}
 * clobbered to {"rules":"5e"}; stats:{rules:'2024'} + summary:{} also clobbered
 * to {"rules":"5e"}. Both now keep '2024'. Golden unguarded deref preserved:
 * no stats.rules + undefined summary still throws TypeError, console untouched.
 */
export function applyRulesType(playerStats, playerSummary) {
    if (playerStats.rules) return;
    playerStats.rules = playerSummary.rules || '5e';
}
