import { applyAbilityScoreIncreases, mergeDeduplicated } from '../shared/buffApplier.js';

/**
 * Race Buff Service
 * Computes race-granted stat buffs for both 5e and 2024 rulesets.
 * Used to apply racial bonuses during character creation (wizard).
 */

const FULL_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function expandAbilityName(name) {
  return FULL_NAMES[name.toLowerCase()] || name;
}

/**
 * Compute race buffs from a selected race + subrace
 * @param {object} race - Race data from JSON
 * @param {object} playerData - Character data (has race.name, race.subrace etc)
 * @param {string} ruleset - '5e' or '2024'
 * @returns {object} - Structured buff result
 */
export function computeRaceBuffs(race, playerData, ruleset = '5e') {
  const result = {
    abilityScoreIncreases: [],
    proficiencies: [],
    languages: [],
    resistances: [],
    traits: [],
    speed: null,
    hitPointBonusPerLevel: 0,
  };

  if (!race) return result;

  if (ruleset === '2024' && race.damage_resistance) {
    if (!result.resistances.includes(race.damage_resistance)) {
      result.resistances.push(race.damage_resistance);
    }
  }

  if (ruleset === '5e') {
    const abilityBonuses = race.ability_bonuses || [];
    abilityBonuses.forEach(ab => {
      result.abilityScoreIncreases.push({
        name: expandAbilityName(ab.name),
        amount: ab.bonus || 1,
      });
    });
  }

  const startingProfs = race.starting_proficiencies || [];
  startingProfs.forEach(prof => {
    result.proficiencies.push({ name: prof });
  });

  const raceLanguages = race.languages || [];
  raceLanguages.forEach(lang => {
    result.languages.push(lang);
  });

  const traits = race.traits || [];
  traits.forEach(trait => {
    result.traits.push({ name: trait.name, description: trait.description });

    if (ruleset === '5e') {
      if (trait.proficiencies) {
        trait.proficiencies.forEach(prof => {
          result.proficiencies.push({ name: prof });
         });
       }
      if (trait.proficiency_choices) {
        trait.proficiency_choices.forEach(pc => {
          result.proficiencies.push({
            name: `${pc.choose} from: ${(pc.from || []).join(', ')}`,
            isChoice: true,
            choose: pc.choose,
            from: pc.from,
           });
         });
       }
     }

    if (trait.trait_type === 'speed' || (trait.name && trait.name.toLowerCase().includes('speed'))) {
      const speedMatch = trait.description ? trait.description.match(/(\d+)\s*feet?/i) : null;
      if (speedMatch) {
        result.speed = parseInt(speedMatch[1], 10);
       }
     }

    if (ruleset === '2024' && trait.description) {
      const skillMatch = trait.description.match(/proficiency in the ([A-Z][a-z]+(?:,|[,\s]and[,\s]|[,\s]or[,\s]|,?)[A-Za-z\s]+?)\s*skill/i);
      if (skillMatch) {
        const skillsStr = skillMatch[1]
          .replace(/\s+and\s+/g, ',')
          .replace(/\s+or\s+/g, ',')
          .replace(/,\s*,/g, ',')
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        skillsStr.forEach(sName => {
          result.proficiencies.push({ name: `Skill: ${sName}` });
        });
      }
    }

    if (ruleset === '5e') {
      if (trait.description) {
        const resistMatches = [...trait.description.matchAll(/(?:resistance|resistant) to (\w+)/gi)];
        resistMatches.forEach(match => {
          result.resistances.push(match[1]);
        });
      }
    }

    if (trait.name === 'Trance') {
      if (!result.traits.some(t => t.name === 'Trance')) {
        result.traits.push({ name: 'Trance', description: trait.description });
      }
    }
  });

  const subrace = race.subraces
    ? race.subraces.find(sr => sr.name === playerData?.race?.subrace?.name)
    : null;

    if (subrace) {
    if (ruleset === '2024' && subrace.damage_resistance) {
      if (!result.resistances.includes(subrace.damage_resistance)) {
        result.resistances.push(subrace.damage_resistance);
      }
    }

    if (ruleset === '5e' && subrace.ability_bonuses) {
      subrace.ability_bonuses.forEach(ab => {
        const existing = result.abilityScoreIncreases.find(
          inc => inc.name === expandAbilityName(ab.name)
        );
        if (existing) {
          existing.amount += ab.bonus || 1;
        } else {
          result.abilityScoreIncreases.push({
            name: expandAbilityName(ab.name),
            amount: ab.bonus || 1,
          });
        }
      });
    }

    if (subrace.starting_proficiencies) {
      subrace.starting_proficiencies.forEach(prof => {
        result.proficiencies.push({ name: prof });
      });
    }

    if (subrace.languages) {
      subrace.languages.forEach(lang => {
        if (!result.languages.includes(lang)) {
          result.languages.push(lang);
        }
      });
    }

    if (subrace.hit_point_bonus_per_level) {
      result.hitPointBonusPerLevel += subrace.hit_point_bonus_per_level;
    }

    if (subrace.racial_traits) {
      subrace.racial_traits.forEach(trait => {
        result.traits.push({ name: trait.name, description: trait.description });
        if (trait.proficiencies) {
          trait.proficiencies.forEach(prof => {
            result.proficiencies.push({ name: prof });
          });
        }
      });
    }
  }

  return result;
}

/**
 * Apply race buffs to formData/playerStats
 * @param {object} playerData - Character data (mutated in place)
 * @param {object} buffs - Buff result from computeRaceBuffs
 */
export function applyRaceBuffsToPlayerData(playerData, buffs) {
  applyAbilityScoreIncreases(playerData.abilities, buffs.abilityScoreIncreases);
  mergeDeduplicated(playerData, 'languages', buffs.languages);
}
