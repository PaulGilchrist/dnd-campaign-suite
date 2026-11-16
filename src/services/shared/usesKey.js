// Single source of truth for uses-latch runtime keys (2026-11-15 convention convergence).
// Every feature-uses counter persisted in change-data derives its key here, so the
// camelCase stem + 'Uses' form matches the data-declared resourceKey values in
// public/data/2024/classes.json (Zealous Presence -> zealousPresenceUses,
// Rage of the Gods -> rageOfTheGodsUses, Nature's Veil -> naturesVeilUses, ...).
// Rules: strip apostrophes, strip whitespace, first letter lowercase, first letter of
// each subsequent word uppercase. Throws on non-string input (mirrors the legacy
// inline derivations it replaces).
export function getRuntimeUsesKey(featureName) {
    const stem = featureName
        .replace(/['\u2019]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join('');
    return stem + 'Uses';
}
