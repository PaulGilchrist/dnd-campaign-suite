export function buildStarryFormLuminousArrow(playerStats) {
    const activeBuffs = playerStats.activeBuffs ?? [];
    const starryFormBuff = activeBuffs.find(b => b.name === 'Starry Form' && b.constellation === 'Archer');
    if (!starryFormBuff) return null;

    const wis = playerStats.abilities.find(a => a.name === 'Wisdom');
    const wisMod = wis?.bonus || 0;
    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;
    const damageDice = isTwinkled ? '2d8' : '1d8';
    const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
    return {
        name: 'Starry Form: Luminous Arrow',
        attackType: 'spell',
        isRanged: true,
        range: '120_ft',
        toHit: spellAttackMod,
        hitBonusFormula: `To Hit Bonus = Spell Attack Modifier (${spellAttackMod})`,
        damageFormula: `Damage Formula = ${damageDice} + Wisdom Modifier (${wisMod})`,
        damage: {
            damage_dice: damageDice,
            damage_type: 'Radiant',
            damage_at_character_level: { [level]: `${damageDice} + ${wisMod}` },
        },
        abilityName: 'Wisdom',
        actionType: 'Bonus Action',
    };
}
