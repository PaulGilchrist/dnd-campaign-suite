/**
 * Spell validation service for character creation wizard
 * Provides non-blocking warnings about spell selection rules
 * Supports both 5e and 2024 rulesets
 */

import { loadClassData, loadRaceData, loadBackgroundData, loadFeatData, loadSpells } from '../../ui/dataLoader.js';

// #1530: canonical spell-catalog index (one Map per ruleset version, lazily built once).
// Prose-parser captures MUST match this catalog with a case-insensitive EXACT key
// comparison (Map.get on the lowercased token — never substring: 'Armor' must not match
// 'Mage Armor'). Matched tokens are canonicalized to the catalog's disk title;
// unmatched junk ('two', unsplittable clause fragments) is dropped loudly via console.error
// and never enters a result bucket / the allowed-spells set.
const spellCatalogIndexCache = {};

async function getSpellCatalogIndex(version) {
  if (!spellCatalogIndexCache[version]) {
    const spells = await loadSpells(version);
    const index = new Map();
    spells.forEach(spell => {
      if (spell?.name) index.set(spell.name.toLowerCase(), spell.name);
      if (spell?.index) index.set(spell.index.toLowerCase(), spell.name);
    });
    spellCatalogIndexCache[version] = index;
  }
  return spellCatalogIndexCache[version];
}

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
async function extractRaceSpells(raceData, version = '5e') {
  const result = { spells: [], cantrips: [], details: [] };
  
  if (!raceData) {
    return result;
  }

  // Traits + subrace descriptions share one extraction loop; version only selects the
  // description coercion (5e joins array descriptions, 2024 reads them raw — pinned quirk).
  const entries = [...(raceData.traits || []), ...(raceData.subraces || [])];
  for (const entry of entries) {
    const raw = entry.description || '';
    const desc = version === '2024' ? raw : (Array.isArray(raw) ? raw.join(' ') : raw);
    await extractSpellsFromDescription(desc, result, version);
  }
  
  return result;
}

/**
 * Extracts spell names from a text description
 * This is a heuristic approach - looks for italicized spell names
 * #1530: pattern-arm captures are catalog-validated (case-fold EXACT match via
 * loadSpells), conjunction/slash fragments are split before matching, and junk
 * tokens are console.error'd and dropped — never stored as pseudo-spells.
 * @param {string} description - The text description
 * @param {object} result - The result object to add spells to
 * @param {string} version - '5e' or '2024' (selects the spell catalog)
 */
async function extractSpellsFromDescription(description, result, version = '5e') {
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
  
  // Also check for "you know the X cantrip" pattern — catalog-validated (#1530).
  // The lazy capture grabs whole clause fragments, so each capture is first split on
  // conjunctions/slashes ("Mending and Prestidigitation"), then every part is looked up
  // in the spell catalog case-insensitively (rescues lowercase prose like 'thaumaturgy').
  // Catalog misses ('two', 'another') are junk: console.error + drop.
  const cantripPattern = /(?:know|learn)\s+(?:the\s+)?([\w\s/]+?)\s+cantrip/gi;
  let catalog = null;
  while ((match = cantripPattern.exec(description)) !== null) {
    for (const fragment of match[1].split(/\s+and\s+|\s*\/\s*/)) {
      const token = fragment.trim();
      if (!token) continue;
      catalog = catalog || await getSpellCatalogIndex(version);
      const canonicalName = catalog.get(token.toLowerCase());
      if (!canonicalName) {
        console.error(`spellValidation: dropping non-spell token "${token}" captured from feature text (not in ${version} spell catalog)`);
        continue;
      }
      if (!result.cantrips.includes(canonicalName) && !result.spells.includes(canonicalName)) {
        result.cantrips.push(canonicalName);
      }
    }
  }
}

/**
 * Checks if a background grants any spells
 * @param {object} backgroundData - The background data object
 * @param {string} version - '5e' or '2024'
 * @returns {object} - { spells: string[], cantrips: string[], details: string[] }
 */
async function extractBackgroundSpells(backgroundData, version = '5e') {
  const result = { spells: [], cantrips: [], details: [] };
  
  if (!backgroundData) {
    return result;
  }
  
  // Check features/traits for spell-granting abilities
  const features = backgroundData.features || backgroundData.traits || [];
  for (const feature of features) {
    const desc = Array.isArray(feature.description) ? feature.description.join(' ') : (feature.description || '');
    await extractSpellsFromDescription(desc, result, version);
  }
  
  return result;
}

/**
 * Checks if a feat grants any spells
 * @param {object} featData - The feat data object
 * @param {string} version - '5e' or '2024'
 * @returns {object} - { spells: string[], cantrips: string[], spellListAccess: string[], details: string[] }
 */
async function extractFeatSpells(featData, version = '5e') {
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
    await extractSpellsFromDescription(desc, result, version);
  }
  
  // Check benefits array (2024 format)
  if (featData.benefits) {
    for (const benefit of featData.benefits) {
      if (benefit.type === 'spell') {
        const benefitDesc = benefit.description || '';
        await extractSpellsFromDescription(benefitDesc, result, version);
      }
    }
  }
  
  return result;
}

/**
 * Gets all spell-granting sources for a character
 * @param {object} formData - The character form data
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object>} - Object containing all spell sources
 */
async function applyRaceSpellSource(sources, formData, version) {
  const races = await loadRaceData(version);
  const raceData = races.find(r => r.name === formData.race.name);
  const raceSpells = await extractRaceSpells(raceData, version);

  sources.race.spells = raceSpells.spells;
  sources.race.cantrips = raceSpells.cantrips;
}

async function applyBackgroundSpellSource(sources, formData, version) {
  const backgrounds = await loadBackgroundData(version);
  const backgroundData = backgrounds.find(b => b.name === formData.background.name);
  const backgroundSpells = await extractBackgroundSpells(backgroundData, version);

  sources.background.spells = backgroundSpells.spells;
  sources.background.cantrips = backgroundSpells.cantrips;
}

async function applyFeatSpellSources(sources, formData, version) {
  const feats = await loadFeatData(version);

  for (const featName of formData.feats) {
    const featData = feats.find(f => f.name === featName);
    if (featData) {
      const featSpells = await extractFeatSpells(featData, version);

      sources.feats.grantedSpells.push(...featSpells.spells);
      sources.feats.grantedCantrips.push(...featSpells.cantrips);
      sources.feats.spellListAccess.push(...featSpells.spellListAccess);
    }
  }
}

async function applyClassSpellSource(sources, formData, version) {
  const classes = await loadClassData(version);
  const classData = classes.find(c => c.name === formData.class.name);

  sources.class.isSpellcaster = true;
  sources.class.spellList = classData ? [formData.class.name] : [];
}

function sourceName(block) {
  return block?.name || '';
}

export async function getSpellSources(formData, version = '5e') {
  const sources = {
    class: {
      name: sourceName(formData.class),
      spellList: [],
      isSpellcaster: false
    },
    race: {
      name: sourceName(formData.race),
      spells: [],
      cantrips: []
    },
    background: {
      name: sourceName(formData.background),
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
    await applyClassSpellSource(sources, formData, version);
  }
  
  // Get race spells
  if (formData.race?.name) {
    await applyRaceSpellSource(sources, formData, version);
  }
  
  // Get background spells
  if (formData.background?.name) {
    await applyBackgroundSpellSource(sources, formData, version);
  }
  
  // Get feat spells
  if (formData.feats && formData.feats.length > 0) {
    await applyFeatSpellSources(sources, formData, version);
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
// Allowed-spells set from every non-class source (race/background/feat grants,
// explicitly granted spells, and feat-chosen spells — these never trigger the
// "outside class list" warning).
function buildAllowedSpells(sources, formData, grantedSpells) {
  const allowedSpells = new Set();

  sources.race.spells.forEach(spell => allowedSpells.add(spell));
  sources.race.cantrips.forEach(spell => allowedSpells.add(spell));
  sources.background.spells.forEach(spell => allowedSpells.add(spell));
  sources.background.cantrips.forEach(spell => allowedSpells.add(spell));
  sources.feats.grantedSpells.forEach(spell => allowedSpells.add(spell));
  sources.feats.grantedCantrips.forEach(spell => allowedSpells.add(spell));

  // Any explicitly granted spells (auto-assigned from subclass/race/subrace/feats)
  grantedSpells.forEach(spell => allowedSpells.add(spell));

  // Magic Initiate spells — granted by the feat
  (formData.magicInitiateInstances || []).forEach(inst => {
    if (inst.cantrips?.[0]) allowedSpells.add(inst.cantrips[0]);
    if (inst.cantrips?.[1]) allowedSpells.add(inst.cantrips[1]);
    if (inst.level1Spell) allowedSpells.add(inst.level1Spell);
  });

  // Fey Touched / Shadow Touched spells — granted by the feat
  if (formData.feyTouchedSpell) {
    allowedSpells.add(formData.feyTouchedSpell);
  }
  if (formData.shadowTouchedSpell) {
    allowedSpells.add(formData.shadowTouchedSpell);
  }

  return allowedSpells;
}

// Canonical lists a 2024 Bard may draw Magical Secrets from (classes.json lv10 feature).
export const MAGICAL_SECRETS_CLASS_LISTS = ['Bard', 'Cleric', 'Druid', 'Wizard'];

// 2024 Bard Magical Secrets is gained at level 10 and re-opens whenever the
// Prepared Spells number in the Bard Features table increases — so the four-list
// pool is available at every level from 10 onward (CLA-221), not only the level
// carrying the class_specific.magical_secrets key.
export function hasMagicalSecretsAccess(className, version, level) {
  return className === 'Bard' && version === '2024' && (parseInt(level, 10) || 0) >= 10;
}

// Is this spell allowed for the character by class, half/third-caster proxy,
// subclass spell list, or 2024 Bard Magical Secrets?
function isSpellAllowedByClass(spellData, spellClasses, ctx) {
  const { className, isMagicalSecretsBard } = ctx;
  const MONK_SUBCLASS_SPELLS = ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'];
  if (spellClasses.includes(className)) return true;
  if ((className === 'Fighter' || className === 'Rogue') && spellClasses.includes('Wizard')) return true;
  if (className === 'Monk' && MONK_SUBCLASS_SPELLS.includes(spellData.name)) return true;

  // 2024 Bard Magical Secrets: allow spells from Bard, Cleric, Druid, and Wizard lists
  if (isMagicalSecretsBard && MAGICAL_SECRETS_CLASS_LISTS.some(c => spellClasses.includes(c))) return true;

  return false;
}

export async function validateSpells(formData, selectedSpells, allSpells, version = '5e', grantedSpells = []) {
  const warnings = [];
  const selectedSpellNames = selectedSpells || [];

  if (selectedSpellNames.length === 0) {
    return { warnings, valid: true };
   }

  // Get all spell sources for this character
  const sources = await getSpellSources(formData, version);

  // Allowed spells from all granted (non-class) sources; class spell-list membership
  // is checked per spell below (we don't add all class spells to the set).
  const allowedSpells = buildAllowedSpells(sources, formData, grantedSpells);

  const className = sources.class.name;
  const isMagicalSecretsBard = hasMagicalSecretsAccess(className, version, formData.level);
  const classCheckCtx = { className, isMagicalSecretsBard };

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
    const _spellLevel = spellData.level !== undefined ? spellData.level : 0;
    void _spellLevel;

    // If not a class spell and not granted by another source and not a Magical Secrets spell, collect it
    if (!isSpellAllowedByClass(spellData, spellClasses, classCheckCtx) && !allowedSpells.has(spellName)) {
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