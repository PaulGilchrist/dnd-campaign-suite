import { findFeat } from '../shared/featFinder.js';
import { mergeDeduplicated } from '../shared/buffApplier.js';
import { resolveFeatChosenAbility } from '../shared/abilityLookup.js';

/**
 * Feat Buff Service
 * Computes and applies stat buffs from feats for both 5e and 2024 rulesets.
 * Used by the wizard (during character creation) and the character sheet display.
 */

const ABILITY_PATTERN = /Increase your (\w+) score by (\d+)/i;
const ABILITY_OR_PATTERN = /Increase your (\w+) or (\w+) score by (\d+)/i;
const ABILITY_CHOOSE_PATTERN = /Choose one ability score.*?Increase (?:it|the chosen ability score) by (\d+)/i;
const ABILITY_CHOSEN_PATTERN = /Increase the chosen ability score by (\d+)/i;
const PROFICIENCY_PATTERN = /You gain proficiency with ([^.]+)/i;
const PROFICIENCY_CHOICE_PATTERN = /You gain proficiency in any combination of (.+) of your choice/i;
const SAVE_PROFICIENCY_PATTERN = /You gain proficiency in saving throws using the chosen ability/i;
const SPEED_PATTERN = /Your speed increases by (\d+) feet/i;
const INITIATIVE_PATTERN = /You gain a \+(\d+) bonus to initiative/i;
const HP_PER_LEVEL_PATTERN = /your hit point maximum increases by an additional (\d+) hit point/i;
const HP_FLAT_PATTERN = /Your hit point maximum increases by (\d+)/i;
const LANGUAGE_PATTERN = /You learn (\d+) languages? of your choice/i;
const RESISTANCE_PATTERN = /(?:You have|You gain) resistance to (\w+)/i;

function getMaxAbilityValue(text) {
  return text.toLowerCase().includes('maximum of 30') ? 30 : 20;
}

function capitalizeWords(name) {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function pushAnyAbilityIncrease(match, buffs, text) {
  buffs.abilityScoreIncreases.push({
    name: 'any',
    amount: parseInt(match[1], 10),
    isChoice: true,
    description: text,
    max_value: getMaxAbilityValue(text),
  });
}

function pushAbilityOrIncrease(match, buffs, text) {
  const amount = parseInt(match[3], 10);
  const maxValue = getMaxAbilityValue(text);
  buffs.abilityScoreIncreases.push(
    { name: match[1], amount, isChoice: true, max_value: maxValue },
    { name: match[2], amount, isChoice: true, max_value: maxValue }
  );
}

function pushAbilityIncrease(match, buffs, text) {
  buffs.abilityScoreIncreases.push({
    name: match[1],
    amount: parseInt(match[2], 10),
    isChoice: text.includes(' or '),
    max_value: getMaxAbilityValue(text),
  });
}

function pushProficiency(match, buffs) {
  buffs.proficiencies.push({ name: capitalizeWords(match[1].trim()), type: 'proficiency' });
}

function pushProficiencyChoice(match, buffs) {
  buffs.proficiencies.push({ name: capitalizeWords(match[1].trim()), type: 'proficiency', isChoice: true });
}

function pushResilientFeature(match, buffs, text) {
  buffs.features.push({
    name: 'Resilient',
    description: text,
    type: 'saving_throw',
    automation: {
      type: 'save_proficiency',
      saveType: 'Strength',
      fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
    },
  });
}

function pushValueFeature(match, buffs, text, rule) {
  buffs.features.push({
    name: rule.name,
    description: text,
    type: rule.type,
    value: parseInt(match[1], 10),
  });
}

function pushResistance(match, buffs) {
  buffs.resistances.push(match[1]);
}

const BENEFIT_TEXT_RULES_5E = [
  { pattern: ABILITY_OR_PATTERN, apply: pushAbilityOrIncrease },
  { pattern: ABILITY_PATTERN, apply: pushAbilityIncrease },
  { pattern: ABILITY_CHOOSE_PATTERN, apply: pushAnyAbilityIncrease },
  { pattern: ABILITY_CHOSEN_PATTERN, apply: pushAnyAbilityIncrease },
  { pattern: PROFICIENCY_PATTERN, apply: pushProficiency },
  { pattern: PROFICIENCY_CHOICE_PATTERN, apply: pushProficiencyChoice },
  { pattern: SAVE_PROFICIENCY_PATTERN, apply: pushResilientFeature },
  { pattern: SPEED_PATTERN, name: 'Speed Bonus', type: 'speed', apply: pushValueFeature },
  { pattern: INITIATIVE_PATTERN, name: 'Initiative Bonus', type: 'initiative', apply: pushValueFeature },
  { pattern: HP_PER_LEVEL_PATTERN, name: 'Hit Point Bonus', type: 'hp_per_level', apply: pushValueFeature },
  { pattern: HP_FLAT_PATTERN, name: 'Hit Point Bonus', type: 'hp_flat', apply: pushValueFeature },
  { pattern: LANGUAGE_PATTERN, name: 'Language Bonus', type: 'language', apply: pushValueFeature },
  { pattern: RESISTANCE_PATTERN, apply: pushResistance },
];

function parse5eBenefitText(text) {
  const buffs = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  for (const rule of BENEFIT_TEXT_RULES_5E) {
    const match = text.match(rule.pattern);
    if (match) {
      rule.apply(match, buffs, text, rule);
      return buffs;
    }
  }

  buffs.features.push({
    name: 'Passive Benefit',
    description: text,
    type: 'passive',
  });

  return buffs;
}

const WORD_TO_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const NUM_WORD_PATTERN = '(?:one|two|three|four|five|six|seven|eight|nine|ten|1|2|3|4|5|6|7|8|9|10)';
const ALL_SKILLS_LIST = 'Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival';

function parse2024AbilityScoreIncrease(benefit, feat, buffs) {
  const asi = feat.ability_score_increase;
  if (!asi || !asi.scores) return;
  const maxVal = asi.max_value || 20;

  if (asi.amount === 'variable') {
    buffs.abilityScoreIncreases.push({
      name: 'any',
      amount: [1, 2],
      isChoice: true,
      description: benefit.description,
      max_value: maxVal,
    });
    return;
  }

  if (asi.scores.length > 2) {
    buffs.abilityScoreIncreases.push({
      name: 'any',
      amount: Array.isArray(asi.amount) ? asi.amount : [asi.amount],
      isChoice: true,
      description: benefit.description,
      max_value: maxVal,
    });
    return;
  }

  if (asi.scores.length === 2) {
    buffs.abilityScoreIncreases.push({
      name: 'any',
      amount: typeof asi.amount === 'number' ? asi.amount : 1,
      isChoice: true,
      scores: asi.scores,
      description: benefit.description,
      max_value: maxVal,
    });
    return;
  }

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

function parse2024ExpertiseBenefit(benefit, desc, buffs) {
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
    return;
  }

  if (/choose.*skill.*proficiency.*expertise/i.test(desc)) {
    buffs.proficiencies.push({
      name: benefit.name,
      type: 'proficiency',
      isChoice: true,
      choose: 1,
      from: [ALL_SKILLS_LIST],
      grantsExpertise: true,
    });
    return;
  }

  buffs.features.push({
    name: benefit.name,
    description: desc,
    type: 'expertise',
  });
}

function parse2024ProficiencyChoice(benefit, desc, buffs) {
  const chooseMatch = desc.match(new RegExp(NUM_WORD_PATTERN + '\\s+(?:different\\s+)?(.+?)\\s+of\\s+your\\s+choice', 'i'));
  if (chooseMatch) {
    const firstWord = chooseMatch[0].split(' ')[0].toLowerCase();
    let count = WORD_TO_NUM[firstWord] || 1;
    if (!WORD_TO_NUM[firstWord]) {
      const numMatch = firstWord.match(/^(\d+)/);
      if (numMatch) count = parseInt(numMatch[1], 10);
    }
    buffs.proficiencies.push({
      name: benefit.name,
      type: 'proficiency',
      isChoice: true,
      choose: count,
      from: [chooseMatch[1].trim()],
    });
    return;
  }

  const armorTrainingMatch = desc.match(/training with (\w+(?:\s+(?:and\s+)?\w+)*)\s*armor(?:\s+and\s+shields)?/i);
  if (armorTrainingMatch) {
    const armorType = armorTrainingMatch[1];
    const formattedArmor = armorType.charAt(0).toUpperCase() + armorType.slice(1) + ' Armor';
    buffs.proficiencies.push({ name: formattedArmor, type: 'proficiency' });
    if (/shields/i.test(armorTrainingMatch[0])) {
      buffs.proficiencies.push({ name: 'Shields', type: 'proficiency' });
    }
    return;
  }

  const weaponMatch = desc.match(/proficiency with (Martial|Simple|Light Martial|Finesse Martial|Heavy Martial) weapons?/i);
  if (weaponMatch) {
    const weaponType = weaponMatch[1].charAt(0).toUpperCase() + weaponMatch[1].slice(1);
    buffs.proficiencies.push({ name: `${weaponType} Weapons`, type: 'proficiency' });
    return;
  }

  buffs.proficiencies.push({ name: benefit.name, type: 'proficiency' });
}

function parse2024Proficiency(benefit, feat, buffs) {
  const desc = benefit.description;
  if (desc.includes('improvised')) {
    buffs.proficiencies.push({ name: 'Improvised Weapons', type: 'proficiency' });
    return;
  }
  if (desc.includes('all skills')) {
    buffs.proficiencies.push({ name: 'all_skills', type: 'skill' });
    return;
  }
  if (desc.includes('Expertise')) {
    parse2024ExpertiseBenefit(benefit, desc, buffs);
    return;
  }
  parse2024ProficiencyChoice(benefit, desc, buffs);
}

function parse2024Resistance(benefit, feat, buffs) {
  const auto = benefit.automation;
  if (!auto) {
    buffs.features.push({
      name: benefit.name,
      description: benefit.description,
      type: 'resistance',
    });
    return;
  }

  const validTypes = auto.validTypes || [];
  if (validTypes.length === 0) {
    buffs.features.push({
      name: benefit.name,
      description: benefit.description,
      type: 'resistance',
      automation: auto,
    });
    return;
  }

  const numChoice = Array.isArray(auto.resistanceType)
    ? auto.resistanceType[0]?.replace('player_choice_', '').replace('_from_list', '') || '2'
    : '2';
  buffs.features.push({
    name: benefit.name,
    description: benefit.description,
    type: 'resistance_choice',
    automation: {
      ...auto,
      count: parseInt(numChoice, 10) || 2,
      validTypes,
    },
  });
}

function parse2024SavingThrow(benefit, feat, buffs) {
  const auto = benefit.automation;
  if (!auto) return;
  buffs.features.push({
    name: benefit.name,
    description: benefit.description,
    type: 'saving_throw',
    automation: auto,
  });
}

function parse2024Damage(benefit, feat, buffs) {
  const name = benefit.name;
  if (benefit.automation?.type === 'reroll_damage_once_per_turn') {
    buffs.features.push({
      name: 'Savage Attacker',
      description: benefit.description,
      type: 'reroll_damage_once_per_turn',
      automation: { type: 'reroll_damage_once_per_turn' },
    });
    return;
  }
  if (name && (name.includes('Great Weapon Fighting') || name.includes('Damage Die Reroll'))) {
    buffs.features.push({
      name: 'Great Weapon Fighting',
      description: benefit.description,
      type: 'great_weapon_fighting',
      automation: { type: 'great_weapon_fighting' },
    });
    return;
  }
  if (name && name.includes('Enhanced Unarmed')) {
    buffs.features.push({
      name: 'Enhanced Unarmed Strike',
      description: benefit.description,
      type: 'damage',
      automation: benefit.automation,
    });
    return;
  }
  if (name && name.includes('Extra Attack Damage')) {
    buffs.features.push({
      name: 'Two Weapon Fighting',
      description: benefit.description,
      type: 'two_weapon_fighting',
      automation: { type: 'two_weapon_fighting' },
    });
    return;
  }
  if (name && name.includes('Dual Wielding')) {
    buffs.features.push({
      name: benefit.name,
      description: benefit.description,
      type: 'two_weapon_fighting',
      automation: { type: 'two_weapon_fighting' },
    });
    return;
  }
  buffs.features.push({
    name: benefit.name,
    description: benefit.description,
    type: benefit.type,
    automation: benefit.automation,
  });
}

function parse2024Spell(benefit, feat, buffs) {
  const automationType = benefit.automation?.type;
  if (automationType === 'free_spell') {
    buffs.features.push({
      name: benefit.name,
      description: benefit.description,
      type: 'free_spell',
      automation: benefit.automation,
    });
    return;
  }
  if (benefit.name && benefit.name.toLowerCase().includes('level 1') && benefit.automation) {
    buffs.features.push({
      name: benefit.name,
      description: benefit.description,
      type: 'free_spell',
      automation: benefit.automation,
    });
    return;
  }
  if (benefit.name && benefit.name.includes('Minor Telekinesis')) {
    buffs.features.push({
      name: 'Minor Telekinesis',
      description: benefit.description,
      type: 'spell',
      automation: {
        type: 'minor_telekinesis_spell',
        spell: 'Mage Hand',
      },
    });
    return;
  }
  buffs.features.push({
    name: benefit.name,
    description: benefit.description,
    type: 'spell',
    automation: benefit.automation,
  });
}

function parse2024OtherBenefit(benefit, feat, buffs) {
  const benefitName = benefit.name || '';
  if (benefitName.includes('Great Weapon Fighting') || benefitName.includes('Damage Die Reroll')) {
    buffs.features.push({
      name: 'Great Weapon Fighting',
      description: benefit.description,
      type: 'great_weapon_fighting',
      automation: { type: 'great_weapon_fighting' },
    });
    return;
  }
  if (benefitName.includes('Savage Strike') || benefitName === 'Savage Attacker') {
    buffs.features.push({
      name: 'Savage Attacker',
      description: benefit.description,
      type: 'reroll_damage_once_per_turn',
      automation: { type: 'reroll_damage_once_per_turn' },
    });
    return;
  }
  if (benefitName.includes('Damage Reroll') || benefitName.includes('reroll.*1', 'i')) {
    buffs.features.push({
      name: 'Tavern Brawler Damage Reroll',
      description: benefit.description,
      type: 'passive',
      automation: { type: 'tavern_brawler_reroll_ones' },
    });
    return;
  }
  if (benefitName.includes('Push') && benefit.type === 'action') {
    buffs.features.push({
      name: 'Tavern Brawler Push',
      description: benefit.description,
      type: 'action',
      automation: { type: 'tavern_brawler_push', oncePerTurn: true },
    });
    return;
  }
  if (benefit.automation?.type === 'weapon_mastery_choice') {
    buffs.features.push({
      name: benefit.name || 'Mastery Property',
      description: benefit.description,
      type: 'passive',
      automation: benefit.automation,
    });
    return;
  }
  if (benefit.type === 'bonus_action') {
    const profMatch = (benefit.description || '').match(PROFICIENCY_PATTERN);
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
    return;
  }
  buffs.features.push({
    name: benefit.name,
    description: benefit.description,
    type: benefit.type,
    automation: benefit.automation || feat.automation,
  });
}

const BENEFIT_PARSERS_2024 = {
  ability_score_increase: parse2024AbilityScoreIncrease,
  proficiency: parse2024Proficiency,
  resistance: parse2024Resistance,
  saving_throw: parse2024SavingThrow,
  damage: parse2024Damage,
  spell: parse2024Spell,
};

function parse2024Benefit(benefit, feat) {
  const buffs = {
    abilityScoreIncreases: [],
    proficiencies: [],
    resistances: [],
    features: [],
  };

  const parse = Object.prototype.hasOwnProperty.call(BENEFIT_PARSERS_2024, benefit.type)
    ? BENEFIT_PARSERS_2024[benefit.type]
    : parse2024OtherBenefit;
  parse(benefit, feat, buffs);

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

    // 5e feats may have a single automation object at the feat level
    if (feat.automation) {
      const automations = Array.isArray(feat.automation) ? feat.automation : [feat.automation];
      automations.forEach(auto => {
        result.features.push({
          name: feat.name,
          description: feat.description,
          type: auto.type || 'passive',
          automation: auto,
        });
      });
    }
  }

  return result;
}

function resolveSaveTypeFromChoices(featName, choices) {
  return resolveFeatChosenAbility(featName, choices);
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
      buffs.features.forEach(f => {
        f.featName = feat.name;
      });
      aggregated.abilityScoreIncreases.push(...buffs.abilityScoreIncreases);
      aggregated.proficiencies.push(...buffs.proficiencies);
      aggregated.resistances.push(...buffs.resistances);
      aggregated.features.push(...buffs.features);
    }
  });

  // Resolve save_proficiency saveType from featAbilityChoices for feats like Resilient
  aggregated.features.forEach(feature => {
    if (feature.automation?.effect === 'ritual_spells' && feature.automation?.chosenSpells) {
      const resolved = resolveSaveTypeFromChoices(feature.featName, formData.featAbilityChoices);
      if (resolved && feature.automation.spellCastingAbility !== resolved) {
        feature.automation = { ...feature.automation, spellCastingAbility: resolved };
      }
    }
    if (feature.automation?.type === 'save_proficiency' &&
        feature.automation.saveType &&
        feature.automation.fallbackTypes &&
        feature.automation.fallbackTypes.length > 0) {
      const resolved = resolveSaveTypeFromChoices(feature.featName, formData.featAbilityChoices);
      if (resolved) {
        feature.automation.saveType = resolved;
        delete feature.automation.fallbackTypes;
      }
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
