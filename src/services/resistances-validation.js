/**
 * Resistances & Immunities validation service for character creation wizard
 * Provides non-blocking warnings about resistance/immunity selections
 * Supports both 5e and 2024 rulesets
 */

import { fetchClassData, fetchRaceData, fetchBackgroundData } from './data-loader.js';

export { fetchClassData, fetchRaceData, fetchBackgroundData };
/**
 * Extracts resistances from race traits for 5e
 * Reads from race JSON data instead of hardcoded mappings
 * @param {object} raceData - The race data object
 * @param {string} subraceName - The selected subrace name (optional)
 * @returns {string[]} - Array of resistance types
 */
function extract5eRaceResistances(raceData, subraceName) {
  const resistances = new Set();

  if (!raceData || !raceData.traits) {
    return [];
  }

  // Check base race traits
  raceData.traits.forEach(trait => {
    const desc = Array.isArray(trait.desc) ? trait.desc.join(' ') : (trait.desc || '');
    const name = trait.name || '';

    // Tiefling: Hellish Resistance - fire damage resistance
    if (name.includes('Hellish Resistance') && desc.includes('resistance to fire damage')) {
      resistances.add('Fire');
    }

    // Dwarf: Dwarven Resilience - poison damage resistance
    if (name.includes('Dwarven Resilience') && desc.includes('resistance against poison damage')) {
      resistances.add('Poison');
    }

    // Dragonborn: Damage Resistance - depends on draconic ancestry
      // Read from subrace data instead of hardcoded mapping
    if (name.includes('Damage Resistance') || name.includes('damage resistance')) {
        // For dragonborn, the resistance type depends on ancestry choice
        // We'll handle this in the subrace check below
      }
    });

  // Check subrace traits
  if (subraceName && raceData.subraces) {
    const subrace = raceData.subraces.find(sr =>
      sr.name === subraceName || sr.index === subraceName.toLowerCase()
    );
    if (subrace && subrace.racial_traits) {
      subrace.racial_traits.forEach(trait => {
        const desc = Array.isArray(trait.desc) ? trait.desc.join(' ') : (trait.desc || '');
        const name = trait.name || '';

        // Stout Halfling: Scout Resilience - poison damage resistance
        if (name.includes('Scout Resilience') && desc.includes('resistance against poison damage')) {
          resistances.add('Poison');
          }
          
          // Check for damage resistance in subrace traits
        if (desc.match(/resistance to (\w+) damage/i)) {
          const match = desc.match(/resistance to (\w+) damage/i);
          if (match) {
            const resistanceType = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            resistances.add(resistanceType);
            }
          }
          
          // For Dragonborn, read resistance from subrace description
        if (raceData.name === 'Dragonborn' && desc.match(/resistance to (\w+)/i)) {
          const match = desc.match(/resistance to (\w+)/i);
          if (match) {
            const resistanceType = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            resistances.add(resistanceType);
            }
          }
        });
      }
    }

  return Array.from(resistances);
}

/**
 * Extracts resistances from race traits for 2024
 * Reads from race JSON data instead of hardcoded mappings
 * @param {object} raceData - The race data object
 * @param {string} subraceName - The selected subrace name (optional)
 * @returns {string[]} - Array of resistance types
 */
function extract2024RaceResistances(raceData, subraceName) {
  const resistances = new Set();

  if (!raceData || !raceData.traits) {
    return [];
  }

  // Check base race traits
  raceData.traits.forEach(trait => {
    const desc = trait.description || '';
    const name = trait.name || '';

    // Aasimar: Celestial Resistance - Necrotic and Radiant
    if (name.includes('Celestial Resistance') && desc.includes('Resistance to Necrotic')) {
      resistances.add('Necrotic');
      resistances.add('Radiant');
    }

    // Dwarf: Dwarven Resilience - Poison damage resistance
    if (name.includes('Dwarven Resilience') && desc.includes('Resistance to Poison')) {
      resistances.add('Poison');
    }

    // Dragonborn: Damage Resistance - depends on ancestry
      // Read from subrace data instead of hardcoded mapping
    if (name.includes('Damage Resistance') && desc.includes('Resistance to')) {
        // Handle in subrace check below
      }

    // Tiefling: Fiendish Legacy - check for resistance in the table description
    if (name.includes('Fiendish Legacy') || name.includes('Fiendish Legacies')) {
        // Parse the table for resistance types based on legacy
        // This will be handled by subrace-specific data
      }
  });

  // Check subrace-specific resistances
  if (subraceName && raceData.subraces) {
    const subrace = raceData.subraces.find(sr => sr.name === subraceName);
    if (subrace) {
      const subDesc = subrace.description || '';
      const subraceTraits = subrace.traits || [];

      subraceTraits.forEach(trait => {
        const desc = trait.description || '';
        if (desc.match(/Resistance to (\w+)/i)) {
          const match = desc.match(/Resistance to (\w+)/i);
          if (match) {
            resistances.add(match[1]);
            }
          }
      });
      }
    }

    // For Dragonborn, determine resistance based on subrace/ancestry from JSON
  if (raceData.name === 'Dragonborn' && subraceName) {
    const subrace = raceData.subraces?.find(sr => sr.name === subraceName);
    if (subrace) {
        // Check subrace description for resistance type
      const desc = subrace.description || '';
      if (desc.match(/Resistance to (\w+)/i)) {
        const match = desc.match(/Resistance to (\w+)/i);
        resistances.add(match[1]);
        }
      }
    }

    // For Tiefling, determine resistance based on subrace/legacy from JSON
  if (raceData.name === 'Tiefling' && subraceName) {
    const subrace = raceData.subraces?.find(sr => sr.name === subraceName);
    if (subrace) {
        // Check subrace traits for resistance
      const subraceTraits = subrace.traits || [];
      subraceTraits.forEach(trait => {
        const desc = trait.description || '';
        if (desc.match(/Resistance to (\w+)/i)) {
          const match = desc.match(/Resistance to (\w+)/i);
          resistances.add(match[1]);
          }
        });
      }
    }

  return Array.from(resistances);
}

/**
 * Extracts immunities from class features
 * @param {object} classData - The class data object
 * @param {string} version - '5e' or '2024'
 * @param {number} level - Character level
 * @returns {string[]} - Array of immunity types
 */
function extractClassImmunities(classData, version, level) {
  const immunities = new Set();

  if (!classData || !classData.class_levels) {
    return [];
  }

  classData.class_levels.forEach(levelData => {
    if (levelData.level > level) {
      return;
    }

    const features = levelData.features || [];
    features.forEach(feature => {
      const desc = feature.description || '';
      const name = feature.name || '';

      // 2024 Barbarian Path of the Berserker: Mindless Rage gives Immunity to Charmed and Frightened
      if (name.includes('Mindless Rage') && desc.includes('Immunity to')) {
          // These are condition immunities, not damage immunities
          // We don't track condition immunities in the resistances step
        }

      // Check for damage immunities in feature descriptions
      if (desc.match(/Immunity to (\w+)/gi)) {
        const matches = desc.match(/Immunity to (\w+)/gi);
        matches.forEach(match => {
          const immunityType = match.replace(/Immunity to /i, '');
          // Only add if it's a valid damage type
          const validTypes = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
            'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
          if (validTypes.includes(immunityType)) {
            immunities.add(immunityType);
      }
          });
        }
      });
    });

    // Check subclass features for 2024
  if (version === '2024' && classData.majors) {
    classData.majors.forEach(major => {
      const features = major.features || [];
      features.forEach(feature => {
        if (feature.level > level) {
          return;
        }
        const desc = feature.description || '';
        if (desc.match(/Immunity to (\w+)/gi)) {
          const matches = desc.match(/Immunity to (\w+)/gi);
          matches.forEach(match => {
            const immunityType = match.replace(/Immunity to /i, '');
            const validTypes = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
              'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
            if (validTypes.includes(immunityType)) {
              immunities.add(immunityType);
        }
            });
          }
        });
      });
  }

  // 5e subclass features
  if (version === '5e' && classData.subclasses) {
    classData.subclasses.forEach(subclass => {
      const classLevels = subclass.class_levels || [];
      classLevels.forEach(levelData => {
        if (levelData.level > level) {
          return;
        }
        const features = levelData.features || [];
         features.forEach(feature => {
           const desc = feature.description || '';
           if (desc.match(/Immunity to (\w+)/gi)) {
            const matches = desc.match(/Immunity to (\w+)/gi);
            matches.forEach(match => {
              const immunityType = match.replace(/Immunity to /i, '');
              const validTypes = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
                'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
              if (validTypes.includes(immunityType)) {
                immunities.add(immunityType);
          }
              });
            }
          });
        });
      });
  }

  return Array.from(immunities);
}

/**
 * Gets the allowed resistances and immunities based on ruleset, class, race, and background
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { resistances: string[], immunities: string[], details: string }
 */
export async function getResistanceLimits(formData) {
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const raceName = formData.race?.name || '';
  const subraceName = formData.race?.subrace?.name || formData.race?.subrace || '';
  const level = formData.level || 1;

  let resistances = [];
  let immunities = [];

  if (ruleset === '2024') {
    // 2024 rules: Check race traits for resistances
    if (raceName) {
      const raceData = await fetchRaceData(raceName, '2024');
      resistances = extract2024RaceResistances(raceData, subraceName);
    }

    // Check class features for immunities
    if (className) {
      const classData = await fetchClassData(className, '2024');
      immunities = extractClassImmunities(classData, '2024', level);
      }
    } else {
      // 5e rules: Check race traits for resistances
    if (raceName) {
      const raceData = await fetchRaceData(raceName, '5e');
      resistances = extract5eRaceResistances(raceData, subraceName);
    }

      // Dragonborn special case - determine resistance from subrace JSON data
    if (raceName === 'Dragonborn' && subraceName) {
      const raceData = await fetchRaceData(raceName, '5e');
      const subrace = raceData?.subraces?.find(sr => sr.name === subraceName);
      if (subrace) {
          // Check subrace description for resistance type
        const desc = subrace.desc || subrace.description || '';
        if (desc.match(/resistance to (\w+)/i)) {
          const match = desc.match(/resistance to (\w+)/i);
          const resistanceType = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
          if (!resistances.includes(resistanceType)) {
            resistances.push(resistanceType);
            }
          }
        }
      }

    // Check class features for immunities (rare in 5e base rules)
    if (className) {
      const classData = await fetchClassData(className, '5e');
      immunities = extractClassImmunities(classData, '5e', level);
      }
    }

  return {
    resistances,
    immunities,
    details: ruleset === '2024'
       ? `In 2024 rules, resistances and immunities come from your race (${raceName}) and class (${className}) features`
       : `In 5e rules, resistances come from your race (${raceName}) and class (${className}) features`
    };
}

/**
 * Determines which resistances and immunities are pre-selected (automatically granted)
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { resistances: string[], immunities: string[] }
 */
export async function getPreSelectedResistances(formData) {
  const limits = await getResistanceLimits(formData);
  return {
    resistances: limits.resistances,
    immunities: limits.immunities
  };
}

/**
 * Validates resistance and immunity selections and returns warnings
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - Array of warning objects { message: string, type: 'warning'|'info' }
 */
export async function validateResistances(formData) {
  const warnings = [];
  const selectedResistances = formData.resistances || [];
  const selectedImmunities = formData.immunities || [];
  const ruleset = formData.rules || '5e';

  // Get the allowed resistances and immunities
  const limits = await getResistanceLimits(formData);

  // Check for resistances that aren't granted by race/class/background
  const ungrantedResistances = selectedResistances.filter(r => !limits.resistances.includes(r));
  if (ungrantedResistances.length > 0) {
    warnings.push({
      message: `These resistances are not granted by your race, class, or background: ${ungrantedResistances.join(', ')}. Verify with your DM.`,
      type: 'warning'
      });
    }

  // Check for immunities that aren't granted by race/class/background
  const ungrantedImmunities = selectedImmunities.filter(i => !limits.immunities.includes(i));
  if (ungrantedImmunities.length > 0) {
    warnings.push({
      message: `These immunities are not granted by your race, class, or background: ${ungrantedImmunities.join(', ')}. Verify with your DM.`,
      type: 'warning'
      });
    }

  // Check for duplicate selections
  const uniqueResistances = new Set(selectedResistances);
  if (uniqueResistances.size < selectedResistances.length) {
    warnings.push({
      message: 'Some resistances are selected multiple times. Each resistance should only be selected once.',
      type: 'warning'
      });
    }

  const uniqueImmunities = new Set(selectedImmunities);
  if (uniqueImmunities.size < selectedImmunities.length) {
    warnings.push({
      message: 'Some immunities are selected multiple times. Each immunity should only be selected once.',
      type: 'warning'
      });
    }

  // Info message if character has no resistances or immunities
  if (selectedResistances.length === 0 && selectedImmunities.length === 0) {
    warnings.push({
      message: `Your ${ruleset === '2024' ? '2024' : '5e'} ${formData.race?.name || 'race'} ${formData.class?.name || 'class'} does not grant any resistances or immunities at level ${formData.level || 1}.`,
      type: 'info'
      });
    }

  // Info message about granted but unselected resistances/immunities
  const unselectedResistances = limits.resistances.filter(r => !selectedResistances.includes(r));
  if (unselectedResistances.length > 0) {
    warnings.push({
      message: `Your race/class grants these resistances that are not selected: ${unselectedResistances.join(', ')}. You may want to select them.`,
      type: 'info'
      });
    }

  const unselectedImmunities = limits.immunities.filter(i => !selectedImmunities.includes(i));
  if (unselectedImmunities.length > 0) {
    warnings.push({
      message: `Your race/class grants these immunities that are not selected: ${unselectedImmunities.join(', ')}. You may want to select them.`,
      type: 'info'
      });
    }

  return warnings;
}

/**
 * Gets resistance/immunity information for display
 * @param {string} type - The resistance/immunity type
 * @param {string} category - 'resistance' or 'immunity'
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { isGranted: boolean, source: string, isPreSelected: boolean }
 */
export async function getResistanceInfo(type, category, formData) {
  const ruleset = formData.rules || '5e';
  const sources = [];
  let isPreSelected = false;

  const limits = await getResistanceLimits(formData);
  const grantedTypes = category === 'resistance' ? limits.resistances : limits.immunities;

  if (grantedTypes.includes(type)) {
    isPreSelected = true;

    // Determine source
    const raceName = formData.race?.name || '';
    const className = formData.class?.name || '';

    if (raceName) {
      const raceData = await fetchRaceData(raceName, ruleset);
      const raceResistances = ruleset === '2024'
         ? extract2024RaceResistances(raceData, formData.race?.subrace?.name || '')
         : extract5eRaceResistances(raceData, formData.race?.subrace?.name || '');
      if (raceResistances.includes(type)) {
        sources.push('Race');
        }
      }

    if (className && category === 'immunity') {
      const classData = await fetchClassData(className, ruleset);
      const classImmunities = extractClassImmunities(classData, ruleset, formData.level || 1);
      if (classImmunities.includes(type)) {
        sources.push('Class');
        }
      }
    }

  return {
    isGranted: grantedTypes.includes(type),
    source: sources.join(', ') || 'Unknown',
    isPreSelected
  };
}