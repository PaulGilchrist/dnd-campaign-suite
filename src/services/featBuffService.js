/**
 * Feat Buff Service
 * Computes and applies stat buffs from feats for both 5e and 2024 rulesets.
 * Used by the wizard (during character creation) and the character sheet display.
 */

const ABILITY_PATTERN = /Increase your (\w+) score by (\d+)/i;
const ABILITY_OR_PATTERN = /Increase your (\w+) or (\w+) score by (\d+)/i;
const ABILITY_CHOOSE_PATTERN = /Choose one ability score.*?Increase (?:it|the chosen ability score) by (\d+)/i;
const PROFICIENCY_PATTERN = /You gain proficiency with (.+)/i;
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
    buffs.abilityScoreIncreases.push(
      { name: match[1], amount: parseInt(match[3], 10), isChoice: true },
      { name: match[2], amount: parseInt(match[3], 10), isChoice: true }
    );
    return buffs;
  }

  match = text.match(ABILITY_PATTERN);
  if (match) {
    buffs.abilityScoreIncreases.push({
      name: match[1],
      amount: parseInt(match[2], 10),
      isChoice: text.includes(' or '),
    });
    return buffs;
  }

  match = text.match(ABILITY_CHOOSE_PATTERN);
  if (match) {
    buffs.abilityScoreIncreases.push({
      name: 'any',
      amount: parseInt(match[1], 10),
      isChoice: true,
      description: text,
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
      if (asi && asi.scores) {
        if (asi.amount === 'variable') {
          buffs.abilityScoreIncreases.push({
            name: 'any',
            amount: [1, 2],
            isChoice: true,
            description: benefit.description,
          });
        } else if (asi.scores.length > 2) {
          buffs.abilityScoreIncreases.push({
            name: 'any',
            amount: Array.isArray(asi.amount) ? asi.amount : [asi.amount],
            isChoice: true,
            description: benefit.description,
          });
        } else {
          const amount = typeof asi.amount === 'number' ? asi.amount : 1;
          asi.scores.forEach(score => {
            buffs.abilityScoreIncreases.push({
              name: score,
              amount,
              isChoice: asi.scores.length > 1,
              description: benefit.description,
            });
          });
        }
      }
      break;
    }

    case 'proficiency': {
      const desc = benefit.description;
      if (desc.includes('all skills')) {
        buffs.proficiencies.push({ name: 'all_skills', type: 'skill' });
      } else if (desc.includes('Expertise')) {
        buffs.features.push({
          name: benefit.name,
          description: desc,
          type: 'expertise',
        });
      } else {
        buffs.proficiencies.push({ name: benefit.name, type: 'proficiency' });
      }
      break;
    }

    default: {
      buffs.features.push({
        name: benefit.name,
        description: benefit.description,
        type: benefit.type,
      });
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

function findFeat(featName, allFeats) {
  const exact = allFeats.find(f => f.name === featName);
  if (exact) return exact;
  const stripped = featName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (stripped !== featName) {
    return allFeats.find(f => f.name === stripped);
  }
  return null;
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
  const ruleset = formData.rules || '5e';
  const level = formData.level || 1;

  if (formData.abilities) {
    formData.abilities.forEach(ability => {
      ability.miscBonus = 0;
    });

    buffs.abilityScoreIncreases.forEach(inc => {
      if (inc.name && inc.name !== 'any') {
        const ability = formData.abilities.find(
          a => a.name.toLowerCase() === inc.name.toLowerCase()
        );
        if (ability) {
          ability.miscBonus = (ability.miscBonus || 0) + inc.amount;
        }
      }
    });
  }

  if (buffs.resistances.length > 0) {
    const existing = new Set((formData.resistances || []).map(r => r.toLowerCase()));
    buffs.resistances.forEach(r => {
      if (!existing.has(r.toLowerCase())) {
        formData.resistances = formData.resistances || [];
        formData.resistances.push(r);
        existing.add(r.toLowerCase());
      }
    });
  }

  const existingActions = new Set(
    (formData.specialActions || []).map(a => (typeof a === 'string' ? a : a.name))
  );
  const nonAbilityBuffs = buffs.features.filter(f => {
    if (ruleset !== '5e') return true;
    if (f.type === 'speed' || f.type === 'initiative' || f.type === 'hp_per_level' || f.type === 'hp_flat') return false;
    return true;
  });
  nonAbilityBuffs.forEach(f => {
    if (!existingActions.has(f.name)) {
      formData.specialActions = formData.specialActions || [];
      formData.specialActions.push({
        name: f.name,
        description: f.description,
        type: f.type || 'passive',
        source: 'feat',
      });
      existingActions.add(f.name);
    }
  });

  return buffs;
}

export function clearAppliedFeatBuffs(formData) {
  if (formData.abilities) {
    formData.abilities.forEach(ability => {
      ability.miscBonus = 0;
    });
  }
}
