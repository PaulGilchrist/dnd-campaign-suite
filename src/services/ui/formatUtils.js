import { rangeToFeet, MELEE_RANGE_FT } from '../rules/combat/rangeValidation.js';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function formatRange(range) {
    if (!range && range !== 0) return '';
    let s = String(range);
    // Plain number: append ft.
    if (/^\d+$/.test(s)) return s + ' ft.';
    // Normalize: strip trailing dots/spaces, convert feet/foot to ft
    s = s.replace(/\.\s*$/, '');
    s = s.replace(/\bfeet\b/gi, 'ft');
    s = s.replace(/\bfoot\b/gi, 'ft');
    // Add the trailing dot
    s = s.replace(/(\d+)\s*ft$/i, '$1 ft.');
    s = s.replace(/(\d+\/\d+)\s*ft$/i, '$1 ft.');
    return s;
}

/**
 * Format the Range cell for a weapon attack row.
 * Melee-lane weapons (the same discriminator the range check uses:
 * rangeToFeet(range) <= MELEE_RANGE_FT, unless the row is explicitly ranged)
 * get an explicit "Reach " label so a bare "5 ft." is not misread as a
 * firing range. Ranged bands ("80 ft.", "20/60 ft.") and rows with no range
 * data render exactly as formatRange().
 * @param {Object} attack weapon attack row ({ range, weaponType })
 * @returns {string}
 */
function formatWeaponRange(attack) {
    const text = formatRange(attack?.range);
    if (!text || attack.weaponType === 'ranged') return text;
    const feet = rangeToFeet(attack.range);
    return feet != null && feet <= MELEE_RANGE_FT ? `Reach ${text}` : text;
}

function getAttackSpellLevel(spellAbilities, attackName) {
    const spell = spellAbilities?.spells?.find(s => s.name === attackName);
    return spell ? spell.level : null;
}

export { signFormatter, formatRange, formatWeaponRange, getAttackSpellLevel };
