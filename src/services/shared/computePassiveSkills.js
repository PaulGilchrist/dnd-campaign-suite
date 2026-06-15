export function computePassiveSkills(playerStats) {
    const getPassiveScore = (abilityName, skillName) => {
        const ability = playerStats.abilities?.find(a => a.name === abilityName);
        if (!ability) return null;
        const skill = ability.skills?.find(s => s.name === skillName);
        const base = 10 + (ability.bonus || 0);
        if (!skill) return base;
        return 10 + (skill.bonus || 0);
    };

    const passPer = getPassiveScore('Wisdom', 'Perception');
    const passInv = getPassiveScore('Intelligence', 'Investigation');
    const passIns = getPassiveScore('Wisdom', 'Insight');

    const senses = playerStats.senses ? [...playerStats.senses] : [];
    if (passPer !== null) senses.push({ name: 'Passive Perception', value: String(passPer) });
    if (passInv !== null) senses.push({ name: 'Passive Investigation', value: String(passInv) });
    if (passIns !== null) senses.push({ name: 'Passive Insight', value: String(passIns) });

    return senses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
