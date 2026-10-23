import { loadSkills } from '../../ui/dataLoader.js';
import { applyMaxHpPassives } from './carryingCapacity.js';
export { getCarryingCapacity } from './carryingCapacity.js';

export async function getAbilities(playerStats) {
    const skills = await loadSkills();
    const computedAbilities = playerStats.abilities.map((ability) => {
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const newAbility = { ...ability };
        newAbility.totalScore = Math.min(
            ability.baseScore + ability.featIncrease + ability.backgroundIncrease + ability.miscIncrease,
            20
        );
        if ((newAbility.name === 'Strength' || newAbility.name === 'Constitution') && playerStats.class.name === 'Barbarian' && playerStats.level > 19) {
            newAbility.totalScore = Math.min(newAbility.totalScore + 4, 25);
        }
        if (newAbility.name === 'Dexterity' && playerStats.class.name === 'Monk' && playerStats.level > 19) {
            newAbility.totalScore = Math.min(newAbility.totalScore + 4, 25);
        }
        if (newAbility.name === 'Wisdom' && playerStats.class.name === 'Monk' && playerStats.level > 19) {
            newAbility.totalScore = Math.min(newAbility.totalScore + 4, 25);
        }
        newAbility.bonus = Math.floor((newAbility.totalScore - 10) / 2);
        const classSaves = playerStats.class.saving_throw_proficiencies || [];
        const featureSaves = playerStats.saveProficiencies || [];
        const allSaveProfs = [...new Set([...classSaves, ...featureSaves])];
        newAbility.proficient = allSaveProfs.includes(newAbility.name);
        newAbility.save = newAbility.proficient ? newAbility.bonus + proficiency : newAbility.bonus;
        newAbility.skills = skills.filter(skill => skill.ability === newAbility.name);
        newAbility.skills = newAbility.skills.map((skill) => {
            const proficient = playerStats.skillProficiencies.includes(skill.name);
            const newSkill = { ...skill };
            newSkill.bonus = proficient ? newAbility.bonus + proficiency : newAbility.bonus;
            // RAW law (both editions): expertise is granted only "in two of your
            // skill proficiencies" (2024/classes.json Bard/Rogue Expertise rows) — the
            // double-proficiency bonus applies ONLY where already proficient.
            if (proficient && playerStats.expertise && playerStats.expertise.includes(skill.name)) {
                newSkill.bonus += proficiency; // expert = proficient + doubled proficiency
              }
            return newSkill;
           });

        return newAbility;
       });

    // CLA-265: Divine/Primal Order bonuses must read the COMPUTED Wisdom
    // modifier. The raw stored abilities list carries no `bonus` field
    // (it is only computed above), so reading playerStats.abilities here
    // resolved wisMod to 0 and pinned the bonus at the +1 minimum.
    const thaumaturgeActive = playerStats.class?.divineOrder === 'Thaumaturge' && playerStats.class?.name === 'Cleric';
    const magicianActive = playerStats.class?.primalOrder === 'Magician' && playerStats.class?.name === 'Druid';
    if (!thaumaturgeActive && !magicianActive) {
        return computedAbilities;
    }

    const wisAbility = computedAbilities.find(a => a.name === 'Wisdom');
    if (!wisAbility) {
        console.error('getAbilities: Wisdom ability missing; order bonus falls back to +1 minimum');
    }
    const orderBonus = Math.max(1, wisAbility ? wisAbility.bonus : 0);
    const orderSkillNames = thaumaturgeActive ? ['Arcana', 'Religion'] : ['Arcana', 'Nature'];

    return computedAbilities.map((ability) => ({
        ...ability,
        skills: ability.skills.map((skill) => {
            if (orderSkillNames.includes(skill.name)) {
                return { ...skill, bonus: skill.bonus + orderBonus };
            }
            return skill;
        }),
    }));
}

export function getHitPoints(playerStats) {
    const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
    const hitDieStr = playerStats.class.hit_point_die || playerStats.class.hit_die;
    let hitPointDie = parseInt(String(hitDieStr).replace(/[^0-9]/g, ''), 10);
    if (isNaN(hitPointDie)) {
        hitPointDie = 8;
     }
    let hitPoints = hitPointDie + ((hitPointDie / 2 + 1) * (playerStats.level - 1)) + (constitution.bonus * playerStats.level);

    if (playerStats.race.subrace && playerStats.race.subrace.hit_point_bonus_per_level) {
        hitPoints += playerStats.race.subrace.hit_point_bonus_per_level * playerStats.level;
     }

    if (playerStats.class.major && playerStats.class.major.hit_point_bonus_per_level) {
        hitPoints += playerStats.class.major.hit_point_bonus_per_level * playerStats.level;
     }

    return applyMaxHpPassives(playerStats, hitPoints);
}


