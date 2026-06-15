import { rules5e as raceRules } from '../../character/race-rules/index.js';
import { loadSkills } from '../../ui/dataLoader.js';
import { evaluateAutoExpression } from '../../combat/automationExpressions.js';

export async function getAbilities(playerStats) {
    const skills = await loadSkills();
    return playerStats.abilities.map((ability) => {
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const newAbility = { ...ability };
        newAbility.totalScore = Math.min(
            ability.baseScore + ability.abilityImprovements + ability.miscBonus + raceRules.getRacialBonus(playerStats, ability.name),
            20
        );
        if((newAbility.name === 'Strength' || newAbility.name === 'Constitution') && playerStats.class.name === 'Barbarian' && playerStats.level > 19) {
            newAbility.totalScore += 4; // Primal Champion
         }
        newAbility.bonus = Math.floor((newAbility.totalScore - 10) / 2);
        newAbility.proficient = playerStats.class.saving_throws.includes(newAbility.name);
        newAbility.save = newAbility.proficient ? newAbility.bonus + proficiency : newAbility.bonus;
        newAbility.skills = skills.filter(skill => skill.ability === newAbility.name);
        newAbility.skills = newAbility.skills.map((skill) => {
            const proficient = playerStats.skillProficiencies.includes(skill.name);
            const newSkill = { ...skill };
            newSkill.bonus = proficient ? newAbility.bonus + proficiency : newAbility.bonus;
            if (playerStats.expertise && playerStats.expertise.includes(skill.name)) {
                newSkill.bonus += proficiency; // Rogues can double their proficiency for two selected areas of expertise
             }
            return newSkill;
         });
        return newAbility;
     });
}

export function getHitPoints(playerStats) {
    const constitution = playerStats.abilities?.find((ability) => ability.name === 'Constitution');
    const conBonus = constitution?.bonus || 0;
    let hitPoints = playerStats.class.hit_die + ((playerStats.class.hit_die / 2 + 1) * (playerStats.level - 1)) + (conBonus * playerStats.level);

     // Check for racial hit point bonus (e.g., Hill Dwarf Dwarven Toughness)
    if(playerStats.race?.subrace?.hit_point_bonus_per_level) {
        hitPoints += playerStats.race.subrace.hit_point_bonus_per_level * playerStats.level;
     }

      // Check for subclass hit point bonus (e.g., Draconic Sorcerer Draconic Resilience)
    if(playerStats.class.subclass?.hit_point_bonus_per_level) {
        hitPoints += playerStats.class.subclass.hit_point_bonus_per_level * playerStats.level;
     }

     // Check for feat-based max HP increase (e.g., Tough feat)
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'max_hp_increase') {
            if (passive.amount) {
                hitPoints += passive.amount;
            } else if (passive.bonusExpression) {
                const bonus = evaluateAutoExpression(passive.bonusExpression, playerStats);
                if (typeof bonus === 'number' && !isNaN(bonus)) {
                    hitPoints += bonus;
                }
            }
        }
    }

    return hitPoints
}

export function getCarryingCapacity(playerStats) {
    const str = playerStats.abilities.find((a) => a.name === 'Strength');
    const strScore = str?.totalScore || 10;
    let capacity = strScore * 15;
    const sizeMultiplier = playerStats.sizeMultiplier || 1;
    return capacity * sizeMultiplier;
}
