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
export async function getSpellLimits(className, level, version = '5e', majorName = null, extraOptions = null, abilityScores = null) {
  try {
    const classData = await fetchClassData(className, version);
    
    if (!classData || !classData.class_levels) {
      console.warn(`Could not find class data for ${className} (${version})`);
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
    if (version === '2024' && levelEntry.spellcasting.required_major) {
      if (levelEntry.spellcasting.required_major !== majorName) {
        return getDefaultSpellLimits(className);
     }
    }

    let limits = convertSpellcastingToLimits(levelEntry.spellcasting, className, abilityScores, level);

    // Apply 2024 Divine Order / Primal Order bonus cantrips
    if (version === '2024' && extraOptions) {
      if (extraOptions.divineOrder === 'Thaumaturge' && className === 'Cleric') {
        limits.cantrip = (limits.cantrip || 0) + 1;
      }
      if (extraOptions.primalOrder === 'Magician' && className === 'Druid') {
        limits.cantrip = (limits.cantrip || 0) + 1;
      }
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
function findSpellcastingInClass(classData, level, version, majorName = null) {
   // First, try to find spellcasting in current or previous levels
   for (let i = level - 1; i >= 0; i--) {
     const levelEntry = classData.class_levels[i];
     if (levelEntry && levelEntry.spellcasting) {
        // For 2024 classes, check if spellcasting requires a specific major
       if (version === '2024' && levelEntry.spellcasting.required_major) {
         if (levelEntry.spellcasting.required_major !== majorName) {
           continue; // Skip this level's spellcasting if major doesn't match
         }
       }
       return levelEntry.spellcasting;
     }
   }

   // Check subclass class_levels for spellcasting (5e subclasses like Arcane Trickster)
   if (classData.subclasses && Array.isArray(classData.subclasses)) {
     const subclass = classData.subclasses.find(s => s.name === majorName || s.index === majorName?.toLowerCase());
     if (subclass && subclass.class_levels) {
       for (let i = level - 1; i >= 0; i--) {
         const levelEntry = subclass.class_levels[i];
         if (levelEntry && levelEntry.spellcasting) {
           return levelEntry.spellcasting;
         }
       }
     }
   }

   // If not found, check subclass features (for 2024)
   if (version === '2024' && classData.subclass) {
     const subclass = classData.subclass;
     if (subclass.features) {
       for (const feature of subclass.features) {
         if (feature.spellcasting) {
            // For 2024 classes, check if spellcasting requires a specific major
           if (feature.spellcasting.required_major && feature.spellcasting.required_major !== majorName) {
             continue; // Skip this feature's spellcasting if major doesn't match
           }
           return feature.spellcasting;
         }
       }
     }
   }

   return null;
}

/**
 * Converts spellcasting object to spell limits format
 */
function convertSpellcastingToLimits(spellcasting, className = null, abilityScores = null, characterLevel = null) {
  if (!spellcasting) {
    return getDefaultSpellLimits(className);
   }

   const isKnown = spellcasting.spell_type !== 'prepared';
   let preparedSpells = spellcasting.prepared_spells;

   // For prepared spellcasters, compute preparedSpells if not in JSON
   if (isKnown) {
    // Known spellcasters use spells_known for level 1
    preparedSpells = null;
   } else if (preparedSpells === null || preparedSpells === undefined) {
    // Compute prepared spells limit based on class rules
    preparedSpells = computePreparedSpellsLimit(className, spellcasting, abilityScores, characterLevel);
   }

   const limits = {
     cantrip: spellcasting.cantrips_known || 0,
     spellType: spellcasting.spell_type || 'known',
     preparedSpells: preparedSpells,
     level1: isKnown && spellcasting.spells_known ? spellcasting.spells_known : (spellcasting.spell_slots_level_1 || 0),
     level2: spellcasting.spell_slots_level_2 || 0,
     level3: spellcasting.spell_slots_level_3 || 0,
     level4: spellcasting.spell_slots_level_4 || 0,
     level5: spellcasting.spell_slots_level_5 || 0,
     level6: spellcasting.spell_slots_level_6 || 0,
     level7: spellcasting.spell_slots_level_7 || 0,
     level8: spellcasting.spell_slots_level_8 || 0,
     level9: spellcasting.spell_slots_level_9 || 0
   };

   return limits;
}

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
  let spellcastingAbility = null;
  switch (className) {
    case 'Cleric':
    case 'Druid':
      spellcastingAbility = 'Wisdom';
      break;
    case 'Wizard':
      spellcastingAbility = 'Intelligence';
      break;
    case 'Paladin':
      spellcastingAbility = 'Charisma';
      break;
    default:
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
     if (counts.level1 > limits.level1) {
       violations.push(`1st level: ${counts.level1}/${limits.level1}`);
      }
     if (counts.level2 > limits.level2) {
       violations.push(`2nd level: ${counts.level2}/${limits.level2}`);
      }
     if (counts.level3 > limits.level3) {
       violations.push(`3rd level: ${counts.level3}/${limits.level3}`);
      }
     if (counts.level4 > limits.level4) {
       violations.push(`4th level: ${counts.level4}/${limits.level4}`);
      }
     if (counts.level5 > limits.level5) {
       violations.push(`5th level: ${counts.level5}/${limits.level5}`);
      }
     if (counts.level6 > limits.level6) {
       violations.push(`6th level: ${counts.level6}/${limits.level6}`);
      }
     if (counts.level7 > limits.level7) {
       violations.push(`7th level: ${counts.level7}/${limits.level7}`);
      }
     if (counts.level8 > limits.level8) {
       violations.push(`8th level: ${counts.level8}/${limits.level8}`);
      }
     if (counts.level9 > limits.level9) {
       violations.push(`9th level: ${counts.level9}/${limits.level9}`);
      }
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
