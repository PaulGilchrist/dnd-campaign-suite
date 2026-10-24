export function buildStarryFormLuminousArrow(playerStats, activeBuffs) {
    const buffs = Array.isArray(activeBuffs) ? activeBuffs : (playerStats.activeBuffs ?? []);
    const starryFormBuff = buffs.find(b => b.name === 'Starry Form' && b.constellation === 'Archer');
    if (!starryFormBuff) return null;

    // fix#351(a)(i) abilities-absent-degrade: `(playerStats.abilities ?? [])`
    // reuses THIS file's own sibling-degrade idiom at :2 (`playerStats.activeBuffs
    // ?? []`) — the same ?? [] shape, so a malformed stats object with no
    // abilities key degrades wis->undefined->wisMod 0 through the existing
    // `wis?.bonus || 0` on the next line instead of throwing on bare .find
    // (2024-twin parity with abilityCalc.js:42-43 `?.` + `|| 0` guards cited in
    // the fix#337S ledger row; the #1495-class self-catch shape was NOT chosen
    // because the file already carries the cheaper structural ?? [] law inline).
    const wis = (playerStats.abilities ?? []).find(a => a.name === 'Wisdom');
    const wisMod = wis?.bonus || 0;
    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;
    const damageDice = isTwinkled ? '2d8' : '1d8';
    const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
    const damageFormula = `${damageDice}+${wisMod}`;
    return {
        name: 'Starry Form: Luminous Arrow',
        attackType: 'spell',
        isRanged: true,
        // fix#351(a)(ii) disk-law range: 2024/classes.json 'Starry Form' BY-name
        // (:4397) — "make a ranged spell attack, hurling a luminous arrow that
        // targets one creature within 60 feet of yourself". The 120_ft constant
        // contradicted disk and is corrected to disk canon (#1279/#337S owner
        // pass; double-pinned lanes flipped per #1348).
        range: '60_ft',
        toHit: spellAttackMod,
        hitBonus: spellAttackMod,
        hitBonusFormula: `To Hit Bonus = Wisdom Modifier (${wisMod}) + Proficiency (${playerStats.proficiency || 0})`,
        damage: damageFormula,
        damageType: 'Radiant',
        damageFormula: `Damage Formula = ${damageDice} + Wisdom Modifier (${wisMod})`,
        damage_dice: damageDice,
        damage_at_character_level: { [level]: `${damageDice} + ${wisMod}` },
        autoDamageFormula: damageFormula,
        autoDamageName: 'Starry Form: Luminous Arrow',
        abilityName: 'Wisdom',
        actionType: 'Bonus Action',
    };
}
