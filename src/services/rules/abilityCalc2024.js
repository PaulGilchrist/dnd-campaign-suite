import { loadSkills } from '../ui/dataLoader.js';

export async function getAbilities(playerStats) {
    const skills = await loadSkills();
    return playerStats.abilities.map((ability) => {
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const newAbility = { ...ability };
        newAbility.totalScore = ability.baseScore + ability.abilityImprovements + ability.miscBonus;
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
        const allSaveProfs = featureSaves.length > 0 ? featureSaves : classSaves;
        newAbility.proficient = allSaveProfs.includes(newAbility.name);
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

        // Divine Order: Thaumaturge grants WIS mod (min +1) bonus to Arcana and Religion checks
        if (playerStats.class?.divineOrder === 'Thaumaturge' && playerStats.class?.name === 'Cleric') {
            const wisAbility = playerStats.abilities.find(a => a.name === 'Wisdom');
            const wisMod = wisAbility?.bonus || 0;
            const divineBonus = Math.max(1, wisMod);
            newAbility.skills = newAbility.skills.map((skill) => {
                if (skill.name === 'Arcana' || skill.name === 'Religion') {
                    return { ...skill, bonus: skill.bonus + divineBonus };
                }
                return skill;
            });
        }

        // Primal Order: Magician grants WIS mod (min +1) bonus to Arcana and Nature checks
        if (playerStats.class?.primalOrder === 'Magician' && playerStats.class?.name === 'Druid') {
            const wisAbility = playerStats.abilities.find(a => a.name === 'Wisdom');
            const wisMod = wisAbility?.bonus || 0;
            const primalBonus = Math.max(1, wisMod);
            newAbility.skills = newAbility.skills.map((skill) => {
                if (skill.name === 'Arcana' || skill.name === 'Nature') {
                    return { ...skill, bonus: skill.bonus + primalBonus };
                }
                return skill;
            });
        }

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
