/**
 * Roadmap Item 8 — the ONE canonical XP → implied-level ladder.
 *
 * Neither ruleset's classes.json carries an XP column (verified 2026-11-19:
 * `public/data/classes.json` class_levels rows carry level/prof_bonus/features/
 * class_specific only; `public/data/2024/classes.json` class_levels rows carry
 * level/proficiency_bonus/features/spellcasting only), and the sheet's XP modal
 * never computed a projected level — it only previewed the XP number. This
 * module is therefore the app's single threshold calculator: the PHB cumulative
 * "Total Character Experience" ladder, which the 5e (2014) and 2024 printings
 * publish IDENTICALLY (0 / 300 / 900 / 2700 / … / 355000), so one ruleset-
 * agnostic table serves both character `rules` values.
 *
 * The ladder is presentation canon for the LEVEL UP celebration only — XP
 * semantics are unchanged everywhere else. A character's stored `level` still
 * advances solely through the wizard's Basic Information step (the milestone /
 * advancement edit the celebration hands off to).
 *
 * Level 20 is the ceiling (rules-validation.json publishes level_range max 20
 * for BOTH rulesets): any XP past 355,000 still implies level 20 — the
 * calculator never invents a level 21.
 */

export const MAX_CHARACTER_LEVEL = 20;

/** Minimum cumulative XP required to reach level index+1 (levels 1..20). */
export const XP_LEVEL_THRESHOLDS = Object.freeze([
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]);

/**
 * Highest level the given cumulative XP implies (1..20). Non-numeric, null or
 * negative input implies level 1; multi-level jumps are honoured by construction.
 */
export function impliedLevelFromXp(xp) {
    const value = Number(xp);
    if (!Number.isFinite(value) || value < 0) return 1;
    let level = 1;
    for (let i = 1; i < XP_LEVEL_THRESHOLDS.length; i++) {
        if (value < XP_LEVEL_THRESHOLDS[i]) break;
        level = i + 1;
    }
    return level;
}
