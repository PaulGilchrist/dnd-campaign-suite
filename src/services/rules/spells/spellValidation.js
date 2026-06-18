/**
 * Spell validation service for character creation wizard
 * Provides non-blocking warnings about spell selection rules
 * Supports both 5e and 2024 rulesets
 */

import { loadClassData, loadRaceData, loadBackgroundData, loadFeatData } from '../../ui/dataLoader.js';

/**
 * Gets the spell list for a given class
 * @param {string} className - The name of the class
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<string[]>} - Array of class names that have this spell list
 */
export async function getClassSpellList(className, version = '5e') {
  const classData = await loadClassData(version);
  const found = classData.find(c => c.name === className || c.index === className.toLowerCase());
  
  if (!found) {
    return [];
  }
  
   // For full casters, the spell list is the class name itself
   // For half casters and third casters, we need to check the subclass
   // The spell list is typically the class name for most purposes
  return [className];
}

/**
 * Checks if a race grants any spells
 * @param {object} raceData - The race data object
 * @param {string} version - '5e' or '2024'
 * @returns {object} - { spells: string[], cantrips: string[], details: string[] }
 */
function extractRaceSpells(raceData, version = '5e') {
  const result = { spells: [], cantrips: [], details: [] };
  
  if (!raceData) {
    return result;
  }
  
  // Check 2024 race structure
  if (version === '2024') {
    // Check traits for spell-granting features
    if (raceData.traits) {
      raceData.traits.forEach(trait => {
        const desc = trait.description || '';
        extractSpellsFromDescription(desc, result);
       });
      }
    
     // Check subraces for spell-granting features
    if (raceData.subraces) {
      raceData.subraces.forEach(subrace => {
        const desc = subrace.description || '';
        extractSpellsFromDescription(desc, result);
      });
    }
    } else {
      // Check 5e race structure
    if (raceData.traits) {
      raceData.traits.forEach(trait => {
        const desc = Array.isArray(trait.description) ? trait.description.join(' ') : (trait.description || '');
        extractSpellsFromDescription(desc, result);
        });
       }

      // Check subraces
    if (raceData.subraces) {
      raceData.subraces.forEach(subrace => {
        const desc = Array.isArray(subrace.description) ? subrace.description.join(' ') : (subrace.description || '');
        extractSpellsFromDescription(desc, result);
        });
       }
    }
  
  return result;
}

/**
 * Extracts spell names from a text description
 * This is a heuristic approach - looks for italicized spell names
 * @param {string} description - The text description
 * @param {object} result - The result object to add spells to
 */
function extractSpellsFromDescription(description, result) {
  if (!description) return;
  
  // Look for spell names in italics (HTML format)
  // Pattern: <em>Spell Name</em>
  const emPattern = /<em>([^<]+)<\/em>/gi;
  let match;
  
  while ((match = emPattern.exec(description)) !== null) {
    const spellName = match[1].trim();
    
    // Check if this is likely a spell (not a race, class, or other game term)
    // Common spell names that might appear in race descriptions
    const knownCantrips = [
      'Light', 'Prestidigitation', 'Druidcraft', 'Dancing Lights', 'Mending',
      'Minor Illusion', 'Thaumaturgy', 'Blade Ward', 'Friends', 'Guidance',
      'Illusory Script', 'Message', 'Resistance', 'Virtue', 'War Cry'
    ];
    
    const knownSpells = [
      'Speak with Animals', 'Detect Magic', 'Faerie Fire', 'Longstrider',
      'Darkness', 'Misty Step', 'Pass Without Trace', 'Invisibility',
      'Silent Image', 'Cursed Hunt', 'Ensnaring Strike'
    ];
    
    if (knownCantrips.includes(spellName)) {
      if (!result.cantrips.includes(spellName)) {
        result.cantrips.push(spellName);
      }
    } else if (knownSpells.includes(spellName)) {
      if (!result.spells.includes(spellName)) {
        result.spells.push(spellName);
      }
    }
  }
  
  // Also check for "you know the X cantrip" pattern
  const cantripPattern = /(?:know|learn)\s+(?:the\s+)?([\w\s]+?)\s+cantrip/gi;
  while ((match = cantripPattern.exec(description)) !== null) {
    const spellName = match[1].trim();
    if (!result.cantrips.includes(spellName) && !result.spells.includes(spellName)) {
      result.cantrips.push(spellName);
    }
  }
}

/**
 * Checks if a background grants any spells
 * @param {object} backgroundData - The background data object
 * @param {string} version - '5e' or '2024'
 * @returns {object} - { spells: string[], cantrips: string[], details: string[] }
 */
function extractBackgroundSpells(backgroundData) {
  const result = { spells: [], cantrips: [], details: [] };
  
  if (!backgroundData) {
    return result;
  }
  
  // Check features/traits for spell-granting abilities
  const features = backgroundData.features || backgroundData.traits || [];
  features.forEach(feature => {
    const desc = Array.isArray(feature.description) ? feature.description.join(' ') : (feature.description || '');
    extractSpellsFromDescription(desc, result);
  });
  
  return result;
}

/**
 * Checks if a feat grants any spells
 * @param {object} featData - The feat data object
 * @param {string} version - '5e' or '2024'
 * @returns {object} - { spells: string[], cantrips: string[], spellListAccess: string[], details: string[] }
 */
function extractFeatSpells(featData) {
  const result = { 
    spells: [], 
    cantrips: [], 
    spellListAccess: [], 
    details: [],
    grantedSpellLevels: {} 
  };
  
  if (!featData) {
    return result;
  }
  
  const featName = featData.name || '';
  const desc = featData.description || '';
  
  // Magic Initiate feat
  if (featName === 'Magic Initiate') {
    // Grants 2 cantrips and 1 first-level spell from a chosen class's spell list
    result.details.push('Magic Initiate grants 2 cantrips and 1 first-level spell from a chosen class spell list');
    result.spellListAccess.push('Any class (chosen by player)');
    result.grantedSpellLevels.cantrips = 2;
    result.grantedSpellLevels.level1 = 1;
  }
  
  // Fey Touched feat (2024)
  if (featName === 'Fey Touched') {
    // Grants Misty Step and one level 1 spell from Divination or Enchantment
    result.spells.push('Misty Step');
    result.details.push('Fey Touched grants Misty Step and one level 1 Divination or Enchantment spell');
    result.grantedSpellLevels.level1 = 1; // Plus one player-chosen
  }
  
  // Shadow Touched feat (2024)
  if (featName === 'Shadow Touched') {
    // Grants Invisibility and one level 1 spell from Illusion or Necromancy
    result.spells.push('Invisibility');
    result.details.push('Shadow Touched grants Invisibility and one level 1 Illusion or Necromancy spell');
    result.grantedSpellLevels.level1 = 1; // Plus one player-chosen
  }
  
  // Telepathy feat (2024)
  if (featName === 'Telepathy') {
    // Grants Detect Thoughts (level 2) as a free spell
    result.spells.push('Detect Thoughts');
    result.details.push('Telepathy grants Detect Thoughts (level 2) as a free spell');
    result.grantedSpellLevels.level2 = 1;
  }
  
  // War Caster feat - doesn't grant spells but affects casting
  // No special handling needed
  
  // Tough - no spells
  
  // Check for other spell-granting feats by parsing description
  if (desc.includes('cantrip') || desc.includes('spell')) {
    extractSpellsFromDescription(desc, result);
  }
  
  // Check benefits array (2024 format)
  if (featData.benefits) {
    featData.benefits.forEach(benefit => {
      if (benefit.type === 'spell') {
        const benefitDesc = benefit.description || '';
        extractSpellsFromDescription(benefitDesc, result);
      }
    });
  }
  
  return result;
}

/**
 * Gets all spell-granting sources for a character
 * @param {object} formData - The character form data
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object>} - Object containing all spell sources
 */
export async function getSpellSources(formData, version = '5e') {
  const sources = {
    class: {
      name: formData.class?.name || '',
      spellList: [],
      isSpellcaster: false
    },
    race: {
      name: formData.race?.name || '',
      spells: [],
      cantrips: []
    },
    background: {
      name: formData.background?.name || '',
      spells: [],
      cantrips: []
    },
    feats: {
      grantedSpells: [],
      grantedCantrips: [],
      spellListAccess: []
    }
  };
  
  // Get class spell list
  if (formData.class?.name) {
    const classes = await loadClassData(version);
    const classData = classes.find(c => c.name === formData.class.name);
    
    if (classData) {
      // Check if this class has spellcasting
      const hasSpellcasting = classData.class_levels?.some(level => level.spellcasting) ||
                            classData.subclass?.features?.some(feature => feature.spellcasting);
      
      sources.class.isSpellcaster = !!hasSpellcasting;
      sources.class.spellList = [formData.class.name];
    }
  }
  
  // Get race spells
  if (formData.race?.name) {
    const races = await loadRaceData(version);
    const raceData = races.find(r => r.name === formData.race.name);
    const raceSpells = extractRaceSpells(raceData, version);
    
    sources.race.spells = raceSpells.spells;
    sources.race.cantrips = raceSpells.cantrips;
  }
  
  // Get background spells
  if (formData.background?.name) {
    const backgrounds = await loadBackgroundData(version);
    const backgroundData = backgrounds.find(b => b.name === formData.background.name);
    const backgroundSpells = extractBackgroundSpells(backgroundData, version);
    
    sources.background.spells = backgroundSpells.spells;
    sources.background.cantrips = backgroundSpells.cantrips;
  }
  
  // Get feat spells
  if (formData.feats && formData.feats.length > 0) {
    const feats = await loadFeatData(version);
    
    formData.feats.forEach(featName => {
      const featData = feats.find(f => f.name === featName);
      if (featData) {
        const featSpells = extractFeatSpells(featData, version);
        
        sources.feats.grantedSpells.push(...featSpells.spells);
        sources.feats.grantedCantrips.push(...featSpells.cantrips);
        sources.feats.spellListAccess.push(...featSpells.spellListAccess);
      }
    });
  }
  
  return sources;
}

/**
 * Validates spell selections and returns warnings
 * @param {object} formData - The character form data
 * @param {array} selectedSpells - Array of selected spell names
 * @param {array} allSpells - All available spells data
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object>} - { warnings: array, valid: boolean }
 */
export async function validateSpells(formData, selectedSpells, allSpells, version = '5e', grantedSpells = []) {
  const warnings = [];
  const selectedSpellNames = selectedSpells || [];
  
  if (selectedSpellNames.length === 0) {
    return { warnings, valid: true };
   }
  
  // Get all spell sources for this character
  const sources = await getSpellSources(formData, version);
  
  // Build list of allowed spells from all sources
  const allowedSpells = new Set();
  
  // Add class spell list access
  if (sources.class.isSpellcaster) {
     // Class spells will be validated by checking if the spell is on the class's list
    // We don't add all spells here, we check individually below
   }
  
  // Add race-granted spells
  sources.race.spells.forEach(spell => allowedSpells.add(spell));
  sources.race.cantrips.forEach(spell => allowedSpells.add(spell));
  
  // Add background-granted spells
  sources.background.spells.forEach(spell => allowedSpells.add(spell));
  sources.background.cantrips.forEach(spell => allowedSpells.add(spell));
  
  // Add feat-granted spells
  sources.feats.grantedSpells.forEach(spell => allowedSpells.add(spell));
  sources.feats.grantedCantrips.forEach(spell => allowedSpells.add(spell));
  
  // Add any explicitly granted spells (auto-assigned from subclass/race/subrace/feats)
  grantedSpells.forEach(spell => allowedSpells.add(spell));
  
  // Check if Bard has Magical Secrets (2024) — load class data once
  const className = sources.class.name;
  const isMagicalSecretsBard = className === 'Bard' && version === '2024';
  let magicalSecretsLevelEntry = null;
  if (isMagicalSecretsBard) {
    const classData = await loadClassData(version);
    const bardData = classData.find(c => c.name === className || c.index === 'bard');
    if (bardData) {
      magicalSecretsLevelEntry = bardData.class_levels?.find(entry => entry.level === formData.level);
    }
  }
  const magicalSecretsClasses = ['Bard', 'Cleric', 'Druid', 'Wizard'];
  
  // Check each selected spell
  const spellsOutsideClassList = [];

  for (const spellName of selectedSpellNames) {
    const spellData = allSpells.find(s => s.name === spellName || s.index === spellName);
    if (!spellData) {
      warnings.push({
        message: `Spell "${spellName}" not found in spell database.`,
        type: 'warning'
       });
      continue;
     }
    
    const spellClasses = spellData.classes || [];
    if (spellData.level == null) {
      console.error(`[spellValidation] Spell ${spellName} has no level defined`, { spellData: JSON.stringify(spellData), stack: new Error().stack });
    }
    const _spellLevel = spellData.level ?? 0;
    void _spellLevel;
    
    // Check if spell is allowed by class
    const isClassSpell = spellClasses.includes(className) ||
       (className === 'Fighter' && spellClasses.includes('Wizard')) ||
       (className === 'Rogue' && spellClasses.includes('Wizard'));
    // 2024 Bard Magical Secrets: allow spells from Bard, Cleric, Druid, and Wizard lists
    const isMagicalSecretsSpell = isMagicalSecretsBard && 
      magicalSecretsLevelEntry?.class_specific?.magical_secrets != null && 
      magicalSecretsLevelEntry.class_specific.magical_secrets > 0 &&
      magicalSecretsClasses.some(c => spellClasses.includes(c));
    const isGrantedSpell = allowedSpells.has(spellName);
    
      // If not a class spell and not granted by another source and not a Magical Secrets spell, collect it
    if (!isClassSpell && !isGrantedSpell && !isMagicalSecretsSpell) {
      spellsOutsideClassList.push(spellName);
     }
   }

    // Add a single consolidated warning for all spells outside the class list
  if (spellsOutsideClassList.length > 0) {
    const count = spellsOutsideClassList.length;
    const spellText = count === 1 ? 'Spell' : 'Spell(s)';
        warnings.push({
      message: `${spellText} (${count}) chosen outside of the class spell list.`,
          type: 'warning'
         });
   }
  // Note: Spell limit validation is handled in the UI by showing exceeded counts in red
  // We don't add redundant warnings here since the summary already shows this visually
  
  return {
    warnings,
    valid: warnings.filter(w => w.type === 'warning').length === 0
   };
}

/**
 * Gets spell validation info for display
 * @param {object} formData - The character form data
 * @param {array} selectedSpells - Array of selected spell names
 * @param {array} allSpells - All available spells data
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object>} - Object with validation info for UI display
 */
export async function getSpellValidationInfo(formData, selectedSpells, allSpells, version = '5e', grantedSpells = []) {
  const validation = await validateSpells(formData, selectedSpells, allSpells, version, grantedSpells);
  const sources = await getSpellSources(formData, version);
  
  return {
    ...validation,
    sources,
    spellCount: selectedSpells?.length || 0,
    classSpellList: sources.class.spellList,
    isSpellcaster: sources.class.isSpellcaster
   };
}