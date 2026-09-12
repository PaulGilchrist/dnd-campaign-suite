let classDataCache = {
     '5e': null,
     '2024': null
};

/**
 * Resets the class data cache (for testing purposes)
 */
export function resetClassDataCache() {
  classDataCache = {
     '5e': null,
     '2024': null
    };
}

/**
 * Fetches class data from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of class data
 */
async function loadClassData(version = '5e') {
  if (classDataCache[version]) {
    return classDataCache[version];
}

  try {
    const path = version === '2024' ? 'data/2024/classes.json' : 'data/classes.json';
    
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${version} classes.json from ${path}`);
     }
    const data = await response.json();
    classDataCache[version] = data;
    return data;
  } catch (error) {
    console.error(`Error loading ${version} classes.json:`, error);
    return [];
  }
}

/**
 * Fetches a specific class by name from the JSON data
 * @param {string} className - The name of the class (e.g., 'Wizard', 'Bard')
 * @param {string} version - '5e' or '2024'
 * @returns {object|null} - The class data or null if not found
 */
async function fetchClassData(className, version = '5e') {
  const classes = await loadClassData(version);
  return classes.find(c => c.name === className || c.index === className.toLowerCase()) || null;
}

/**
 * Fetches spell limits for a given class and level from the appropriate JSON file
 * @param {string} className - The name of the class (e.g., 'Wizard', 'Bard')
 * @param {number} level - The character level (1-20)
 * @param {string} version - '5e' or '2024'
 * @param {string|null} majorName - The subclass name
 * @param {object} [extraOptions] - Additional class options (divineOrder, primalOrder)
 * @returns {object} - Object containing spell limits for each level
 */
// 2024 Divine Order / Primal Order bonus cantrip grants
const ORDER_CANTRIP_BONUSES = [
  { optionKey: 'divineOrder', optionValue: 'Thaumaturge', className: 'Cleric' },
  { optionKey: 'primalOrder', optionValue: 'Magician', className: 'Druid' },
];

function applyOrderCantripBonus(limits, extraOptions, className) {
  for (const bonus of ORDER_CANTRIP_BONUSES) {
    if (extraOptions[bonus.optionKey] === bonus.optionValue && className === bonus.className) {
      limits.cantrip = (limits.cantrip || 0) + 1;
    }
  }
}

export async function getSpellLimits(className, level, version = '5e', majorName = null, extraOptions = null, abilityScores = null) {
  try {
    const classData = await fetchClassData(className, version);

    if (!classData || !classData.class_levels) {
      return getDefaultSpellLimits(className);
    }

    // Find the class level entry
    const levelEntry = classData.class_levels.find(entry => entry.level === level);

    if (!levelEntry || !levelEntry.spellcasting) {
      // Check if class has spellcasting at higher levels (subclass feature)
      const spellcasting = findSpellcastingInClass(classData, level, version, majorName);
      if (spellcasting) {
        return convertSpellcastingToLimits(spellcasting, className, abilityScores, level);
      }
      return getDefaultSpellLimits(className);
    }

     // For 2024 classes, check if spellcasting requires a specific major
    if (version === '2024' && levelEntry.spellcasting.required_major && levelEntry.spellcasting.required_major !== majorName) {
      return getDefaultSpellLimits(className);
    }

    const limits = convertSpellcastingToLimits(levelEntry.spellcasting, className, abilityScores, level);

    // Apply 2024 Divine Order / Primal Order bonus cantrips
    if (version === '2024' && extraOptions) {
      applyOrderCantripBonus(limits, extraOptions, className);
    }

    return limits;
  } catch (error) {
    console.error(`Error fetching spell limits for ${className} level ${level}:`, error);
    return getDefaultSpellLimits(className);
  }
}

/**
 * Finds spellcasting information in class levels or subclass features
 */
function findClassLevelSpellcasting(classData, level, version, majorName) {
  // Try to find spellcasting in current or previous levels
  for (let i = level - 1; i >= 0; i--) {
    const levelEntry = classData.class_levels[i];
    if (!levelEntry || !levelEntry.spellcasting) continue;
    // For 2024 classes, check if spellcasting requires a specific major
    if (version === '2024' && levelEntry.spellcasting.required_major && levelEntry.spellcasting.required_major !== majorName) {
      continue; // Skip this level's spellcasting if major doesn't match
    }
    return levelEntry.spellcasting;
  }
  return null;
}

function findSubclassLevelSpellcasting(classData, level, majorName) {
  // Check subclass class_levels for spellcasting (5e subclasses like Arcane Trickster)
  if (!classData.subclasses || !Array.isArray(classData.subclasses)) return null;
  const subclass = classData.subclasses.find(s => s.name === majorName || s.index === majorName?.toLowerCase());
  if (!subclass || !subclass.class_levels) return null;
  for (let i = level - 1; i >= 0; i--) {
    const levelEntry = subclass.class_levels[i];
    if (levelEntry && levelEntry.spellcasting) {
      return levelEntry.spellcasting;
    }
  }
  return null;
}

function findSubclassFeatureSpellcasting(classData, version, majorName) {
  // If not found, check subclass features (for 2024)
  if (version !== '2024' || !classData.subclass || !classData.subclass.features) return null;
  for (const feature of classData.subclass.features) {
    if (!feature.spellcasting) continue;
    // For 2024 classes, check if spellcasting requires a specific major
    if (feature.spellcasting.required_major && feature.spellcasting.required_major !== majorName) {
      continue; // Skip this feature's spellcasting if major doesn't match
    }
    return feature.spellcasting;
  }
  return null;
}

function findSpellcastingInClass(classData, level, version, majorName = null) {
  return findClassLevelSpellcasting(classData, level, version, majorName)
    || findSubclassLevelSpellcasting(classData, level, majorName)
    || findSubclassFeatureSpellcasting(classData, version, majorName);
}

function resolvePreparedSpells(spellcasting, isKnown, className, abilityScores, characterLevel) {
  if (isKnown) {
    // Known spellcasters use spells_known for level 1
    return null;
  }
  if (spellcasting.prepared_spells !== null && spellcasting.prepared_spells !== undefined) {
    return spellcasting.prepared_spells;
  }
  // Compute prepared spells limit based on class rules
  return computePreparedSpellsLimit(className, spellcasting, abilityScores, characterLevel);
}

function buildSlotLimits(spellcasting, isKnown) {
  const slots = {
    level1: isKnown && spellcasting.spells_known ? spellcasting.spells_known : (spellcasting.spell_slots_level_1 || 0),
  };
  for (let i = 2; i <= 9; i++) {
    slots[`level${i}`] = spellcasting[`spell_slots_level_${i}`] || 0;
  }
  return slots;
}

/**
 * Converts spellcasting object to spell limits format
 */
function convertSpellcastingToLimits(spellcasting, className = null, abilityScores = null, characterLevel = null) {
  if (!spellcasting) {
    return getDefaultSpellLimits(className);
  }

  const isKnown = spellcasting.spell_type !== 'prepared';

  return {
    cantrip: spellcasting.cantrips_known || 0,
    spellType: spellcasting.spell_type || 'known',
    preparedSpells: resolvePreparedSpells(spellcasting, isKnown, className, abilityScores, characterLevel),
    ...buildSlotLimits(spellcasting, isKnown),
  };
}

const PREPARED_SPELLCASTING_ABILITIES = {
  Cleric: 'Wisdom',
  Druid: 'Wisdom',
  Wizard: 'Intelligence',
  Paladin: 'Charisma',
};

/**
 * Computes the prepared spells limit for classes where it's not in the JSON data
 */
function computePreparedSpellsLimit(className, spellcasting, abilityScores, characterLevel) {
  if (!className || !abilityScores || !Array.isArray(abilityScores)) {
    return null;
  }

  // Ability names are always in this order in formData.abilities
  const abilityOrder = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

  // Get the spellcasting ability name from class data
  const spellcastingAbility = PREPARED_SPELLCASTING_ABILITIES[className] ?? null;
  if (!spellcastingAbility) {
    return null;
  }

  // Find the ability index and compute total score + modifier
  const abilityIndex = abilityOrder.indexOf(spellcastingAbility);
  if (abilityIndex === -1) {
    return null;
  }

  const abilityData = abilityScores[abilityIndex];
  if (!abilityData) {
    return null;
  }

  const baseScore = parseInt(abilityData.baseScore) || 8;
  const backgroundIncrease = parseInt(abilityData.backgroundIncrease) || 0;
  const miscIncrease = parseInt(abilityData.miscIncrease) || 0;
  const featIncrease = parseInt(abilityData.featIncrease) || 0;
  const racialIncrease = parseInt(abilityData.racialIncrease) || 0;
  const totalScore = baseScore + backgroundIncrease + miscIncrease + featIncrease + racialIncrease;
  const abilityModifier = Math.floor((totalScore - 10) / 2);
  const level = characterLevel || 1;

  // Cleric/Druid/Wizard: level + ability modifier
  // Paladin: floor(level/2) + ability modifier
  if (className === 'Paladin') {
    return abilityModifier + Math.floor(level / 2);
  }

  return abilityModifier + level;
}

/**
 * Returns default spell limits for classes without spellcasting
 */
function getDefaultSpellLimits() {
  return {
    spellType: 'prepared',
    isNonSpellcaster: true,
    cantrip: 0,
    preparedSpells: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
    level6: 0,
    level7: 0,
    level8: 0,
    level9: 0
     };
}

const KNOWN_SPELL_LEVEL_LABELS = [
  ['level1', '1st level'],
  ['level2', '2nd level'],
  ['level3', '3rd level'],
  ['level4', '4th level'],
  ['level5', '5th level'],
  ['level6', '6th level'],
  ['level7', '7th level'],
  ['level8', '8th level'],
  ['level9', '9th level'],
];

function collectKnownSpellLevelViolations(counts, limits) {
  const violations = [];
  for (const [key, label] of KNOWN_SPELL_LEVEL_LABELS) {
    if (counts[key] > limits[key]) {
      violations.push(`${label}: ${counts[key]}/${limits[key]}`);
    }
  }
  return violations;
}

/**
 * Validates if spell selection is within limits for a given class and level
 */
export async function validateSpellSelection(selectedSpells, allSpells, className, level, version = '5e', majorName = null, abilityScores = null) {
  const limits = await getSpellLimits(className, level, version, majorName, null, abilityScores);
  const counts = countSpellsByLevel(selectedSpells, allSpells);

    // Non-spellcasting classes have no inherent restrictions — allow any selection for homebrew/feat/race feats
  if (limits.isNonSpellcaster) {
      return { valid: true, violations: [], limits, counts };
      }
   
   const violations = [];

   if (counts.cantrip > limits.cantrip) {
     violations.push(`Cantrips: ${counts.cantrip}/${limits.cantrip}`);
   }

   if (limits.spellType === 'prepared') {
     const totalPrepared = countAllNonCantripSpells(counts);
     if (totalPrepared > limits.preparedSpells) {
       violations.push(`Prepared spells: ${totalPrepared}/${limits.preparedSpells}`);
      }
   } else {
     violations.push(...collectKnownSpellLevelViolations(counts, limits));
   }

  return {
    valid: violations.length === 0,
    violations,
    limits,
    counts
  };
}

/**
 * Counts selected spells by level
 */
function countSpellsByLevel(selectedSpells, allSpells) {
  const counts = {
    cantrip: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
    level6: 0,
    level7: 0,
    level8: 0,
    level9: 0
   };

  if (!selectedSpells || selectedSpells.length === 0) {
    return counts;
   }

  selectedSpells.forEach(spellName => {
    const spell = allSpells.find(s => s.name === spellName || s.index === spellName);
    if (spell) {
      const level = spell.level !== undefined ? spell.level : 0;
      const levelKey = level === 0 ? 'cantrip' : `level${level}`;
      if (counts[levelKey] !== undefined) {
        counts[levelKey]++;
      }
    }
  });

  return counts;
}

/**
  * Counts total non-cantrip spells from counts object (for prepared spell classes)
  */
function countAllNonCantripSpells(counts) {
   return counts.level1 + counts.level2 + counts.level3 + counts.level4 + counts.level5 + counts.level6 + counts.level7 + counts.level8 + counts.level9;
}

/**
  * Gets spell limits for all levels (1-20) for a class
  */
export async function getAllSpellLimits(className, version = '5e', majorName = null) {
  const limits = {};
  
  for (let level = 1; level <= 20; level++) {
    limits[level] = await getSpellLimits(className, level, version, majorName);
    }

  return limits;
}
