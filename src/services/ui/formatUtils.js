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

function getAttackSpellLevel(spellAbilities, attackName) {
    const spell = spellAbilities?.spells?.find(s => s.name === attackName);
    return spell ? spell.level : null;
}

export { signFormatter, formatRange, getAttackSpellLevel };
