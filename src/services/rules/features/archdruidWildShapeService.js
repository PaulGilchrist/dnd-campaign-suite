// @improved-by-ai
// CLA-013 (2014 SRD Archdruid, public/data/classes.json lv20): "You can use
// your Wild Shape an unlimited number of times." The 2024 lv20 capstone is
// FINITE (public/data/2024/classes.json lv20 wild_shape: 4 — Evergreen Wild
// Shape / Nature Magician / Longevity), so the unlimited tier is keyed off
// rules "5e" AND the lv20 Archdruid feature row in the 2014 class data.
// 2024 hosts never match and stay byte-identical.
export function hasUnlimitedWildShape(playerStats) {
    if (!playerStats) return false;
    const cls = playerStats.class || {};
    const classNames = [cls.name, (cls.major || {}).name];
    if (!classNames.includes('Druid')) return false;
    if ((playerStats.rules || '5e') !== '5e') return false;
    if ((playerStats.level || 0) < 20) return false;
    const lv20 = (cls.class_levels || []).find(cl => cl.level === 20);
    return ((lv20 || {}).features || []).some(f => f.name === 'Archdruid');
}
