// Single source of truth for the data-testid stamped on every castable spell row
// on the character sheet (2026-11-15 improve: discoverability across lanes).
// Spell rows are routed to the Actions grid / Bonus Actions / Reactions / Spells
// table by casting_time + damage presence (src/services/ui/spellSectionUtils.js),
// so a probe keyed to one lane false-negatives on casters whose spell lands in
// another. One name-derived testid value means [data-testid=castable-row-revivify]
// finds the row in whichever lane it renders.
// Rules: lowercase, runs of non-alphanumerics collapse to a single '-', leading/
// trailing '-' trimmed. Name-derived only — no slot level, index, ruleset, or
// session components — so values are stable across reloads. 5e/2024 spell names
// are unique display strings, so distinct names cannot collide.

export function spellNameSlug(name) {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function castableRowTestId(spellName) {
    return `castable-row-${spellNameSlug(spellName)}`;
}
