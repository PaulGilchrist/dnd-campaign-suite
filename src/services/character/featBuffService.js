import { findFeat } from '../shared/featFinder.js';
import { mergeDeduplicated } from '../shared/buffApplier.js';

/**
 * Feat Buff Service
 * Computes and applies stat buffs from feats for both 5e and 2024 rulesets.
 * Used by the wizard (during character creation) and the character sheet display.
 */

const ABILITY_PATTERN = /Increase your (\w+) score by (\d+)/i;
const ABILITY_OR_PATTERN = /Increase your (\w+) or (\w+) score by (\d+)/i;
const ABILITY_CHOOSE_PATTERN = /Choose one ability score.*?Increase (?:it|the chosen ability score) by (\d+)/i;
const PROFICIENCY_PATTERN = /You gain proficiency with ([^.]+)/i;
const PROFICIENCY_CHOICE_PATTERN = /You gain proficiency in any combination of (.+) of your choice/i;
const SPEED_PATTERN = /Your speed increases by (\d+) feet/i;
const INITIATIVE_PATTERN = /You gain a \+(\d+) bonus to initiative/i;
const HP_PER_LEVEL_PATTERN = /your hit point maximum increases by an additional (\d+) hit point/i;
const HP_FLAT_PATTERN = /Your hit point maximum increases by (\d+)/i;
const LANGUAGE_PATTERN = /You learn (\d+) languages? of your choice/i;
const RESISTANCE_PATTERN = /(?:You have|You gain) resistance to (\w+)/i;

function parse5eBenefitText(text) {
  const buffs = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  let match = text.match(ABILITY_OR_PATTERN);
  if (match) {
    const maxVal = text.toLowerCase().includes('maximum of 30') || text.toLowerCase().includes('maximum of 30.') ? 30 : 20;
    buffs.abilityScoreIncreases.push(
      { name: match[1], amount: parseInt(match[3], 10), isChoice: true, max_value: maxVal },
      { name: match[2], amount: parseInt(match[3], 10), isChoice: true, max_value: maxVal }
    );
    return buffs;
  }

  match = text.match(ABILITY_PATTERN);
  if (match) {
    const maxVal = text.toLowerCase().includes('maximum of 30') || text.toLowerCase().includes('maximum of 30.') ? 30 : 20;
    buffs.abilityScoreIncreases.push({
      name: match[1],
      amount: parseInt(match[2], 10),
      isChoice: text.includes(' or '),
      max_value: maxVal,
    });
    return buffs;
  }

  match = text.match(ABILITY_CHOOSE_PATTERN);
  if (match) {
    const maxVal = text.toLowerCase().includes('maximum of 30') || text.toLowerCase().includes('maximum of 30.') ? 30 : 20;
    buffs.abilityScoreIncreases.push({
      name: 'any',
      amount: parseInt(match[1], 10),
      isChoice: true,
      description: text,
      max_value: maxVal,
    });
    return buffs;
  }

  match = text.match(PROFICIENCY_PATTERN);
  if (match) {
    buffs.proficiencies.push({ name: match[1].trim() });
    return buffs;
  }

  match = text.match(PROFICIENCY_CHOICE_PATTERN);
  if (match) {
    buffs.proficiencies.push({ name: match[1].trim(), isChoice: true });
    return buffs;
  }

  match = text.match(SPEED_PATTERN);
  if (match) {
    buffs.features.push({
      name: 'Speed Bonus',
      description: text,
      type: 'speed',
      value: parseInt(match[1], 10),
    });
    return buffs;
  }

  match = text.match(INITIATIVE_PATTERN);
  if (match) {
    buffs.features.push({
      name: 'Initiative Bonus',
      description: text,
      type: 'initiative',
      value: parseInt(match[1], 10),
    });
    return buffs;
  }

  match = text.match(HP_PER_LEVEL_PATTERN);
  if (match) {
    buffs.features.push({
      name: 'Hit Point Bonus',
      description: text,
      type: 'hp_per_level',
      value: parseInt(match[1], 10),
    });
    return buffs;
  }

  match = text.match(HP_FLAT_PATTERN);
  if (match) {
    buffs.features.push({
      name: 'Hit Point Bonus',
      description: text,
      type: 'hp_flat',
      value: parseInt(match[1], 10),
    });
    return buffs;
  }

  match = text.match(LANGUAGE_PATTERN);
  if (match) {
    buffs.features.push({
      name: 'Language Bonus',
      description: text,
      type: 'language',
      value: parseInt(match[1], 10),
    });
    return buffs;
  }

  match = text.match(RESISTANCE_PATTERN);
  if (match) {
    buffs.resistances.push(match[1]);
    return buffs;
  }

  buffs.features.push({
    name: 'Passive Benefit',
    description: text,
    type: 'passive',
  });

  return buffs;
}

function parse2024Benefit(benefit, feat) {
  const buffs = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  switch (benefit.type) {
    case 'ability_score_increase': {
      const asi = feat.ability_score_increase;
      const maxVal = asi?.max_value || 20;
      if (asi && asi.scores) {
        if (asi.amount === 'variable') {
          buffs.abilityScoreIncreases.push({
            name: 'any',
            amount: [1, 2],
            isChoice: true,
            description: benefit.description,
            max_value: maxVal,
          });
        } else if (asi.scores.length > 2) {
          buffs.abilityScoreIncreases.push({
            name: 'any',
            amount: Array.isArray(asi.amount) ? asi.amount : [asi.amount],
            isChoice: true,
            description: benefit.description,
            max_value: maxVal,
          });
        } else if (asi.scores.length === 2) {
          const amount = typeof asi.amount === 'number' ? asi.amount : 1;
          buffs.abilityScoreIncreases.push({
            name: 'any',
            amount,
            isChoice: true,
            scores: asi.scores,
            description: benefit.description,
            max_value: maxVal,
          });
        } else {
          const amount = typeof asi.amount === 'number' ? asi.amount : 1;
          asi.scores.forEach(score => {
            buffs.abilityScoreIncreases.push({
              name: score,
              amount,
              isChoice: false,
              description: benefit.description,
              max_value: maxVal,
            });
          });
        }
      }
      break;
    }

    case 'proficiency': {
      const desc = benefit.description;
      if (desc.includes('improvised')) {
        buffs.proficiencies.push({ name: 'Improvised Weapons', type: 'proficiency' });
        break;
      }
      if (desc.includes('all skills')) {
        buffs.proficiencies.push({ name: 'all_skills', type: 'skill' });
      } else if (desc.includes('Expertise')) {
        const skillMatch = desc.match(/(?:Choose one of the following skills:\s*|Choose one skill:\s*)(.+?)\.\s*(?:If|You|This|When)/i);
        if (skillMatch) {
          const skillList = skillMatch[1].split(/,\s*|,\s*(?:and\s+|\bor\s+)|(?:and\s+|\bor\s+)/).map(s => s.trim()).filter(s => s.length > 0);
          if (skillList.length > 0) {
            buffs.proficiencies.push({
              name: benefit.name,
              type: 'proficiency',
              isChoice: true,
              choose: 1,
              from: [skillList.join(', ')],
              grantsExpertise: true,
            });
          } else {
            buffs.features.push({
              name: benefit.name,
              description: desc,
              type: 'expertise',
            });
          }
        } else if (/choose.*skill.*proficiency.*expertise/i.test(desc)) {
          const allSkills = 'Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival';
          buffs.proficiencies.push({
            name: benefit.name,
            type: 'proficiency',
            isChoice: true,
            choose: 1,
            from: [allSkills],
            grantsExpertise: true,
          });
        } else {
          buffs.features.push({
            name: benefit.name,
            description: desc,
            type: 'expertise',
          });
        }
      } else {
        const numWords = '(?:one|two|three|four|five|six|seven|eight|nine|ten|1|2|3|4|5|6|7|8|9|10)';
        const chooseMatch = desc.match(new RegExp(numWords + '\\s+(?:different\\s+)?(.+?)\\s+of\\s+your\\s+choice', 'i'));
        if (chooseMatch) {
          const firstWord = chooseMatch[0].split(' ')[0].toLowerCase();
          const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
          let count = wordToNum[firstWord] || 1;
          if (!wordToNum[firstWord]) {
            const numMatch = firstWord.match(/^(\d+)/);
            if (numMatch) count = parseInt(numMatch[1], 10);
          }
          const fromList = chooseMatch[1].trim();
          buffs.proficiencies.push({
            name: benefit.name,
            type: 'proficiency',
            isChoice: true,
            choose: count,
            from: [fromList],
          });
        } else {
          const armorTrainingMatch = desc.match(/training with (\w+(?:\s+(?:and\s+)?\w+)*)\s*armor(?:\s+and\s+shields)?/i);
          if (armorTrainingMatch) {
            const armorType = armorTrainingMatch[1];
            const formattedArmor = armorType.charAt(0).toUpperCase() + armorType.slice(1) + ' Armor';
            buffs.proficiencies.push({ name: formattedArmor, type: 'proficiency' });
            if (/shields/i.test(armorTrainingMatch[0])) {
              buffs.proficiencies.push({ name: 'Shields', type: 'proficiency' });
            }
          } else {
            const weaponMatch = desc.match(/proficiency with (Martial|Simple|Light Martial|Finesse Martial|Heavy Martial) weapons?/i);
            if (weaponMatch) {
              const weaponType = weaponMatch[1].charAt(0).toUpperCase() + weaponMatch[1].slice(1);
              buffs.proficiencies.push({ name: `${weaponType} Weapons`, type: 'proficiency' });
            } else {
              buffs.proficiencies.push({ name: benefit.name, type: 'proficiency' });
            }
          }
        }
      }
      break;
    }

    case 'resistance': {
      const auto = benefit.automation;
      if (auto) {
        const validTypes = auto.validTypes || [];
        if (validTypes.length > 0) {
          const numChoice = Array.isArray(auto.resistanceType)
            ? auto.resistanceType[0]?.replace('player_choice_', '').replace('_from_list', '') || '2'
            : '2';
          const count = parseInt(numChoice, 10) || 2;
          buffs.features.push({
            name: benefit.name,
            description: benefit.description,
            type: 'resistance_choice',
            automation: {
              ...auto,
              count,
              validTypes,
            },
          });
        } else {
          buffs.features.push({
            name: benefit.name,
            description: benefit.description,
            type: 'resistance',
            automation: auto,
          });
        }
      } else {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'resistance',
        });
      }
      break;
    }

    case 'saving_throw': {
      const auto = benefit.automation;
      if (auto) {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'saving_throw',
          automation: auto,
        });
      }
      break;
    }

    case 'damage': {
      if (benefit.automation?.type === 'reroll_damage_once_per_turn') {
        buffs.features.push({
          name: 'Savage Attacker',
          description: benefit.description,
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        });
      } else if (benefit.name && (benefit.name.includes('Great Weapon Fighting') || benefit.name.includes('Damage Die Reroll'))) {
        buffs.features.push({
          name: 'Great Weapon Fighting',
          description: benefit.description,
          type: 'great_weapon_fighting',
          automation: { type: 'great_weapon_fighting' },
        });
      } else if (benefit.name && benefit.name.includes('Enhanced Unarmed')) {
        buffs.features.push({
          name: 'Enhanced Unarmed Strike',
          description: benefit.description,
          type: 'damage',
          automation: benefit.automation,
        });
      } else if (benefit.name && benefit.name.includes('Extra Attack Damage')) {
        buffs.features.push({
          name: 'Two Weapon Fighting',
          description: benefit.description,
          type: 'two_weapon_fighting',
          automation: { type: 'two_weapon_fighting' },
        });
      } else if (benefit.name && benefit.name.includes('Dual Wielding')) {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'two_weapon_fighting',
          automation: { type: 'two_weapon_fighting' },
        });
      } else {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: benefit.type,
          automation: benefit.automation,
        });
      }
      break;
    }

    case 'spell': {
      const isLevel1Spell = benefit.name && benefit.name.toLowerCase().includes('level 1');
      if (isLevel1Spell && benefit.automation) {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'free_spell',
          automation: benefit.automation,
        });
      } else {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'spell',
          automation: benefit.automation,
        });
      }
      break;
    }

    default: {
      const benefitName = benefit.name || '';
      if (benefitName.includes('Great Weapon Fighting') || benefitName.includes('Damage Die Reroll')) {
        buffs.features.push({
          name: 'Great Weapon Fighting',
          description: benefit.description,
          type: 'great_weapon_fighting',
          automation: { type: 'great_weapon_fighting' },
        });
      } else if (benefitName.includes('Savage Strike') || benefitName === 'Savage Attacker') {
        buffs.features.push({
          name: 'Savage Attacker',
          description: benefit.description,
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        });
      } else if (benefitName.includes('Damage Reroll') || benefitName.includes('reroll.*1', 'i')) {
        buffs.features.push({
          name: 'Tavern Brawler Damage Reroll',
          description: benefit.description,
          type: 'passive',
          automation: { type: 'tavern_brawler_reroll_ones' },
        });
      } else if (benefitName.includes('Push') && benefit.type === 'action') {
        buffs.features.push({
          name: 'Tavern Brawler Push',
          description: benefit.description,
          type: 'action',
          automation: { type: 'tavern_brawler_push', oncePerTurn: true },
        });
      } else if (benefit.automation?.type === 'weapon_mastery_choice') {
        buffs.features.push({
          name: benefit.name || 'Mastery Property',
          description: benefit.description,
          type: 'passive',
          automation: benefit.automation,
        });
      } else if (benefit.type === 'bonus_action') {
        const desc = benefit.description || '';
        const profMatch = desc.match(PROFICIENCY_PATTERN);
        if (profMatch) {
          buffs.proficiencies.push({ name: profMatch[1].trim() });
        }
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: 'bonus_action',
          automation: benefit.automation,
          isBonusAction: true,
        });
      } else {
        buffs.features.push({
          name: benefit.name,
          description: benefit.description,
          type: benefit.type,
          automation: benefit.automation,
        });
      }
      break;
    }
  }

  return buffs;
}

export function computeFeatBuffs(feat, ruleset = '2024') {
  const result = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  if (!feat || !feat.benefits) return result;

  if (ruleset === '2024' && Array.isArray(feat.benefits)) {
    feat.benefits.forEach(benefit => {
      if (benefit && typeof benefit === 'object' && benefit.type) {
        const parsed = parse2024Benefit(benefit, feat);
        result.abilityScoreIncreases.push(...parsed.abilityScoreIncreases);
        result.proficiencies.push(...parsed.proficiencies);
        result.resistances.push(...parsed.resistances);
        result.features.push(...parsed.features);
      }
    });
  } else if (Array.isArray(feat.benefits)) {
    feat.benefits.forEach(benefitText => {
      if (typeof benefitText === 'string') {
        const parsed = parse5eBenefitText(benefitText);
        result.abilityScoreIncreases.push(...parsed.abilityScoreIncreases);
        result.proficiencies.push(...parsed.proficiencies);
        result.resistances.push(...parsed.resistances);
        result.features.push(...parsed.features);
      }
    });
  }

  return result;
}

export function computeAllFeatBuffs(formData, allFeats) {
  const ruleset = formData.rules || '5e';
  const selectedFeats = formData.feats || [];

  const aggregated = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  selectedFeats.forEach(featName => {
    const feat = findFeat(featName, allFeats);
    if (feat) {
      const buffs = computeFeatBuffs(feat, ruleset);
      buffs.abilityScoreIncreases.forEach(inc => {
        inc.featName = feat.name;
        inc.featDescription = feat.description;
      });
      aggregated.abilityScoreIncreases.push(...buffs.abilityScoreIncreases);
      aggregated.proficiencies.push(...buffs.proficiencies);
      aggregated.resistances.push(...buffs.resistances);
      aggregated.features.push(...buffs.features);
    }
  });

  return aggregated;
}

export function applyFeatBuffsToFormData(formData, allFeats) {
  const buffs = computeAllFeatBuffs(formData, allFeats);

  const nonChoiceIncreases = buffs.abilityScoreIncreases.filter(inc => inc.name && inc.name !== 'any');
  nonChoiceIncreases.forEach(inc => {
    const ability = formData.abilities?.find(
      a => a.name.toLowerCase() === inc.name.toLowerCase()
    );
    if (ability) {
      ability.featIncrease = (ability.featIncrease || 0) + inc.amount;
    }
  });

  mergeDeduplicated(formData, 'resistances', buffs.resistances);

  return buffs;
}

function resetFeatIncreases(abilities) {
  if (!abilities) return;
  abilities.forEach(ability => {
    ability.featIncrease = 0;
  });
}

export function clearAppliedFeatBuffs(formData) {
  resetFeatIncreases(formData.abilities);
}
