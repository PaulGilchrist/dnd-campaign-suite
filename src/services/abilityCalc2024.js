import { loadSkills } from './dataLoader.js';

export async function getAbilities(playerStats) {
    const skills = await loadSkills();
    return playerStats.abilities.map((ability) => {
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const newAbility = { ...ability };
        newAbility.totalScore = ability.baseScore + ability.abilityImprovements + ability.miscBonus;
        newAbility.bonus = Math.floor((newAbility.totalScore - 10) / 2);
        newAbility.proficient = playerStats.class.saving_throw_proficiencies ? playerStats.class.saving_throw_proficiencies.includes(newAbility.name) : false;
        newAbility.save = newAbility.proficient ? newAbility.bonus + proficiency : newAbility.bonus;
        newAbility.skills = skills.filter(skill => skill.ability === newAbility.name);
        newAbility.skills = newAbility.skills.map((skill) => {
            const proficient = playerStats.skillProficiencies.includes(skill.name);
            const newSkill = { ...skill };
            newSkill.bonus = proficient ? newAbility.bonus + proficiency : newAbility.bonus;
            if (playerStats.expertise && playerStats.expertise.includes(skill.name)) {
                newSkill.bonus += proficiency;
              }
            return newSkill;
           });
        return newAbility;
       });
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

    return hitPoints;
}
