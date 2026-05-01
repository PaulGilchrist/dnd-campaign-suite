let classDataCache = {
  '5e': null,
  '2024': null
};

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
    
    console.log(`Loading ${version} classes from:`, path);
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
export async function fetchClassData(className, version = '5e') {
  const classes = await loadClassData(version);
  return classes.find(c => c.name === className || c.index === className.toLowerCase()) || null;
}

/**
 * Fetches spell limits for a given class and level from the appropriate JSON file
 * @param {string} className - The name of the class (e.g., 'Wizard', 'Bard')
 * @param {number} level - The character level (1-20)
 * @param {string} version - '5e' or '2024'
 * @returns {object} - Object containing spell limits for each level
 */
export async function getSpellLimits(className, level, version = '5e', majorName = null) {
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
        return convertSpellcastingToLimits(spellcasting);
      }
      return getDefaultSpellLimits(className);
    }
    
    // For 2024 classes, check if spellcasting requires a specific major
    if (version === '2024' && levelEntry.spellcasting.required_major) {
      if (levelEntry.spellcasting.required_major !== majorName) {
        return getDefaultSpellLimits(className);
      }
    }
    
    return convertSpellcastingToLimits(levelEntry.spellcasting, className);
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
function convertSpellcastingToLimits(spellcasting, className = null) {
  if (!spellcasting) {
    return getDefaultSpellLimits(className);
  }
  
  const limits = {
    cantrip: spellcasting.cantrips_known || 0,
    level1: spellcasting.spell_slots_level_1 || 0,
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
 * Returns default spell limits for classes without spellcasting
 */
function getDefaultSpellLimits(className) {
  const defaultLimits = {
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
  
  // Classes that have cantrips but no spell slots at level 1
  const cantripOnlyClasses = ['Barbarian', 'Monk', 'Rogue', 'Fighter', 'Paladin'];
  
  if (cantripOnlyClasses.includes(className)) {
    return {
      cantrip: 2, // Most non-spellcasting classes get 2 cantrips
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
  
  return defaultLimits;
}

/**
 * Validates if spell selection is within limits for a given class and level
 */
export async function validateSpellSelection(selectedSpells, allSpells, className, level, version = '5e', majorName = null) {
  const limits = await getSpellLimits(className, level, version, majorName);
  const counts = countSpellsByLevel(selectedSpells, allSpells);
  
  const violations = [];
  
  if (counts.cantrip > limits.cantrip) {
    violations.push(`Cantrips: ${counts.cantrip}/${limits.cantrip}`);
  }
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
 * Gets spell limits for all levels (1-20) for a class
 */
export async function getAllSpellLimits(className, version = '5e', majorName = null) {
  const limits = {};
  
  for (let level = 1; level <= 20; level++) {
    limits[level] = await getSpellLimits(className, level, version, majorName);
   }
  
  return limits;
}