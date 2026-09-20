/**
 * Shared data loader service for character creation wizard
 * Centralizes fetch/cache logic for JSON data files across all validation services
 * Supports both 5e and 2024 rulesets
 */

// Single shared cache for all data types across all rulesets
   const dataCache = {
       '5e': {
          classes: null,
       races: null,
          backgrounds: null,
        feats: null,
         'rules-validation': null,
        spells: null,
        maneuvers: null
        },
       '2024': {
          classes: null,
       races: null,
        backgrounds: null,
        feats: null,
         'rules-validation': null,
        spells: null,
        maneuvers: null
        }
    };

    // Per-key in-flight promise dedup (shared across concurrent callers)
    let dataPromises = {};

    // Shared cache for version-agnostic data (files in /data/ not /data/2024/)
     const sharedDataCache = {
       skills: null,
        abilityScores: null,

       equipment: null,
      monsters: null,
      magicItems: null,
      fightingStyles: null,
      wildMagicSurgeTable: null
      };

/**
 * Builds the correct file path for a given data type and version
 * @param {string} dataType - The type of data ('classes', 'races', 'backgrounds', 'feats', 'rules-validation')
 * @param {string} version - '5e' or '2024'
 * @returns {string} - The file path
 */
function getDataPath(dataType, version = '5e') {
  if (version === '2024') {
    return `/data/2024/${dataType}.json`;
  }
  return `/data/${dataType}.json`;
}

/**
 * Generic data loader with caching
 * @param {string} dataType - The type of data to load
 * @param {string} version - '5e' or '2024'
 * @param {boolean} optional - If true, returns empty array on 404 instead of error
 * @returns {Promise<object[]>} - Array of data objects
 */
async function loadData(dataType, version = '5e', optional = false) {
  const cacheKey = dataType;
  const versionCache = dataCache[version];

  // Guard against invalid/missing version (e.g., undefined during wizard step 1)
  if (!versionCache) {
    return loadData(dataType, '5e', optional);
  }

  // Return cached data if available
  if (versionCache[cacheKey]) {
    return versionCache[cacheKey];
  }

  const promiseKey = `${version}:${dataType}`;
  if (dataPromises[promiseKey]) {
    return dataPromises[promiseKey];
  }

  dataPromises[promiseKey] = (async () => {
    try {
      const path = getDataPath(dataType, version);
      const response = await fetch(path);

      if (!response.ok) {
            if (optional && response.status === 404) {
                // Optional data not found - cache empty array to avoid re-fetching
              versionCache[cacheKey] = [];
              return [];
              }
            throw new Error(`Failed to load ${version} ${dataType}.json from ${path}`);
            }

          // Check if response is actually JSON (Vite dev server may return HTML for missing files)
          const contentType = response.headers?.get?.('content-type') ?? response.headers?.['content-type'];
          if (!contentType || !contentType.includes('application/json')) {
            if (optional) {
              versionCache[cacheKey] = [];
              return [];
              }
            throw new Error(`Expected JSON but got ${contentType} for ${version} ${dataType}.json`);
            }

          const data = await response.json();
          versionCache[cacheKey] = data;
          return data;
    } catch (error) {
      console.error(`Error loading ${version} ${dataType}.json:`, error);
      return [];
    }
  })();
  const result = dataPromises[promiseKey];
  dataPromises[promiseKey] = null;
  return result;
}

/**
 * Fetches class data from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of class data
 */
export async function loadClassData(version = '5e') {
  return loadData('classes', version);
}

/**
 * Fetches race data from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of race data
 */
export async function loadRaceData(version = '5e') {
  return loadData('races', version);
}

/**
 * Fetches background data from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of background data
 */
export async function loadBackgroundData(version = '5e') {
  // Backgrounds may not exist for 5e, so mark as optional
  return loadData('backgrounds', version, true);
}

/**
 * Synchronous getter for already-cached background data.
 * Returns null if the data has not been loaded yet.
 * @param {string} version - '5e' or '2024'
 * @returns {object[]|null} - Array of background data, or null if not cached
 */
export function getCachedBackgroundData(version = '5e') {
  const versionCache = dataCache[version];
  if (!versionCache) return null;
  return versionCache.backgrounds || null;
}

/**
 * Fetches feat data from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of feat data
 */
export async function loadFeatData(version = '5e') {
  return loadData('feats', version);
}

/**
 * Fetches validation rules from JSON files (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object>} - Validation rules object
 */
export async function loadValidationRules(version = '5e') {
  const data = await loadData('rules-validation', version);
  if (data && data[version]) {
    return data[version];
  }
  return data;
}

/**
 * Synchronous access to cached validation rules costs.
 * Returns null if the data hasn't been loaded yet (first async call pending).
 * @param {string} version - '5e' or '2024'
 * @returns {object|null} - Point buy costs object or null
 */
export function getCachedPointBuyCosts(version = '5e') {
  const versionCache = dataCache[version];
  if (!versionCache) return null;
  const cached = versionCache['rules-validation'];
  if (!cached) return null;
  return cached.point_buy?.costs || null;
}

/**
 * Finds a specific class by name from the JSON data
 * @param {string} className - The name of the class (e.g., 'Wizard', 'Bard')
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The class data or null if not found
 */
export async function fetchClassData(className, version = '5e') {
  if (!className) return null;
  const classes = await loadClassData(version);
  return classes.find(c => c.name === className || c.index === className.toLowerCase()) || null;
}

/**
 * Finds a specific race by name from the JSON data
 * @param {string} raceName - The name of the race (e.g., 'Human', 'Elf')
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The race data or null if not found
 */
export async function fetchRaceData(raceName, version = '5e') {
  if (!raceName) return null;
  const races = await loadRaceData(version);
  return races.find(r => r.name === raceName || r.index === raceName.toLowerCase()) || null;
}

/**
 * Finds a specific subrace by name from the JSON data
 * @param {string} subraceName - The name of the subrace
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The subrace data or null if not found
 */
export async function fetchSubraceData(subraceName, version = '5e') {
  if (!subraceName) return null;
  const races = await loadRaceData(version);

  // For 2024, subraces are nested under the parent race
  if (version === '2024') {
    for (const race of races) {
      if (race.subraces) {
        const subrace = race.subraces.find(s => s.name === subraceName);
        if (subrace) return subrace;
      }
    }
    return null;
  }

  // For 5e, subraces are top-level entries
  return races.find(r => r.name === subraceName || r.index === subraceName.toLowerCase()) || null;
}

/**
 * Finds a specific background by name from the JSON data
 * @param {string} backgroundName - The name of the background
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The background data or null if not found
 */
export async function fetchBackgroundData(backgroundName, version = '5e') {
  if (!backgroundName) return null;
  const backgrounds = await loadBackgroundData(version);
  return backgrounds.find(b => b.name === backgroundName || b.index === backgroundName.toLowerCase()) || null;
}

/**
 * Finds a specific feat by name from the JSON data
 * @param {string} featName - The name of the feat
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object|null>} - The feat data or null if not found
 */
export async function fetchFeatData(featName, version = '5e') {
  if (!featName) return null;
  const feats = await loadFeatData(version);
  return feats.find(f => f.name === featName || f.index === featName.toLowerCase()) || null;
}

let abilityScoresPromise = null;

/**
  * Fetches ability scores data (with caching) - version agnostic
  * @returns {Promise<object[]>} - Raw abilities array from /data/ability-scores.json
  */
export async function loadAbilityScores() {
    if (sharedDataCache.abilityScores) {
        return sharedDataCache.abilityScores;
     }
    if (abilityScoresPromise) {
        return abilityScoresPromise;
    }
    abilityScoresPromise = (async () => {
        try {
            const response = await fetch('/data/ability-scores.json');
            if (response.ok) {
                const data = await response.json();
                sharedDataCache.abilityScores = data;
                return data;
             }
        } catch (error) {
            console.error('Error loading ability scores:', error);
         }
         return [
             { full_name: 'Strength', skills: ['Athletics'] },
             { full_name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
             { full_name: 'Constitution', skills: [] },
             { full_name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] },
             { full_name: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
             { full_name: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] }
          ];
     })();
     try {
         const result = await abilityScoresPromise;
         return result;
     } finally {
         abilityScoresPromise = null;
     }
   }

let equipmentPromise = null;

/**
  * Fetches equipment data (with caching) - version agnostic
  * @returns {Promise<object[]>} - Array of equipment data from /data/equipment.json
  */
export async function loadEquipment() {
    if (sharedDataCache.equipment) {
        return sharedDataCache.equipment;
    }
    if (equipmentPromise) {
        return equipmentPromise;
    }
    equipmentPromise = (async () => {
        try {
            const response = await fetch('/data/equipment.json');
            if (response.ok) {
                const data = await response.json();
                sharedDataCache.equipment = data;
                return data;
            }
        } catch (error) {
            console.error('Error loading equipment:', error);
        }
        return [];
    })();
    try {
        const result = await equipmentPromise;
        return result;
    } finally {
        equipmentPromise = null;
    }
}

/**
  * Fetches monsters data (with caching)
  * @returns {Promise<object[]>} - Array of monster data from /data/monsters.json
  */
let monstersPromise = null;

export async function loadMonsters() {
    if (sharedDataCache.monsters) {
        return sharedDataCache.monsters;
    }
    if (monstersPromise) {
        return monstersPromise;
    }
    monstersPromise = (async () => {
        try {
            const response = await fetch('/data/monsters.json');
            if (response.ok) {
                const data = await response.json();
                sharedDataCache.monsters = data;
                return data;
            }
        } catch (error) {
            console.error('[dataLoader] Error loading monsters:', error);
        }
        return [];
    })();
    try {
        const result = await monstersPromise;
        return result;
    } finally {
        monstersPromise = null;
    }
}

let magicItemsPromise = null;

/**
    * Fetches magic items data (with caching) - version agnostic
    * @returns {Promise<object[]>} - Array of magic items data
    */
    export async function loadMagicItems() {
        if (sharedDataCache.magicItems) {
          return sharedDataCache.magicItems;
        }
        if (magicItemsPromise) {
          return magicItemsPromise;
        }
        magicItemsPromise = (async () => {
            try {
                const response = await fetch('/data/magic-items.json');
                 if (response.ok) {
                    const data = await response.json();
                 sharedDataCache.magicItems = data;
                    return data;
                     }
                } catch (error) {
                   console.error('Error loading magic items:', error);
                    }
              return [];
         })();
         try {
            const result = await magicItemsPromise;
            return result;
         } finally {
            magicItemsPromise = null;
         }
       }

let fightingStylesPromise = null;

/**
    * Fetches fighting styles data (with caching) - version agnostic
    * @returns {Promise<object[]>} - Array of fighting styles data
    */
    export async function loadFightingStyles() {
        if (sharedDataCache.fightingStyles) {
          return sharedDataCache.fightingStyles;
        }
        if (fightingStylesPromise) {
          return fightingStylesPromise;
        }
        fightingStylesPromise = (async () => {
            try {
                const response = await fetch('/data/fighting-styles.json');
                 if (response.ok) {
                    const data = await response.json();
                 sharedDataCache.fightingStyles = data;
                    return data;
                     }
                } catch (error) {
                   console.error('Error loading fighting styles:', error);
                    }
              return [];
         })();
         try {
            const result = await fightingStylesPromise;
            return result;
         } finally {
            fightingStylesPromise = null;
         }
       }

/**
  * Loads spell data for a given spell list key and player stats.
   * Delegates to loadSpells() using the player's ruleset version.
   * @param {object} playerStats - The character stats object (used for rules version)
   * @returns {Promise<object[]>} - Array of spells data
   */
 export async function loadSpellData(playerStats) {
    const version = playerStats?.rules || '5e';
    return loadSpells(version);
}

let maneuversPromise = null;

/**
 * Fetches maneuvers data (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of maneuver data
 */
export async function loadManeuvers(version = '5e') {
    const cacheKey = 'maneuvers';
    const versionCache = dataCache[version];

    if (versionCache[cacheKey]) {
        return versionCache[cacheKey];
    }

    if (maneuversPromise && maneuversPromise.version === version) {
        return maneuversPromise.promise;
    }

    maneuversPromise = { version, promise: (async () => {
        try {
            const path = getDataPath('maneuvers', version);
            const response = await fetch(path);
            if (response.ok) {
                const data = await response.json();
                versionCache[cacheKey] = data;
                return data;
            }
        } catch (error) {
            console.error(`Error loading ${version} maneuvers.json:`, error);
        }
        return [];
    })() };
    try {
        const result = await maneuversPromise.promise;
        return result;
    } finally {
        maneuversPromise = null;
    }
}

let spellsPromise = null;

/**
 * Fetches spells data (with caching)
 * @param {string} version - '5e' or '2024'
 * @returns {Promise<object[]>} - Array of spells data
 */
export async function loadSpells(version = '5e') {
    const cacheKey = 'spells';
    const versionCache = dataCache[version];

    if (versionCache[cacheKey]) {
        return versionCache[cacheKey];
    }

    if (spellsPromise && spellsPromise.version === version) {
        return spellsPromise.promise;
    }

    spellsPromise = { version, promise: (async () => {
        try {
            const path = getDataPath('spells', version);
            const response = await fetch(path);
            if (response.ok) {
                const data = await response.json();
                versionCache[cacheKey] = data;
                return data;
            }
        } catch (error) {
            console.error(`Error loading ${version} spells.json:`, error);
        }
        return [];
    })() };
    try {
        const result = await spellsPromise.promise;
        return result;
    } finally {
        spellsPromise = null;
    }
}

/**
  * Fetches skills derived from ability scores (with caching) - version agnostic
  * @returns {Promise<object[]>} - Array of { name, ability } objects
  */
export async function loadSkills() {
    if (sharedDataCache.skills) {
        return sharedDataCache.skills;
     }
    try {
        const abilities = await loadAbilityScores();
        const skills = [];
        abilities.forEach(ability => {
            ability.skills.forEach(skillName => {
                skills.push({ name: skillName, ability: ability.full_name });
             });
            });
        sharedDataCache.skills = skills;
        return skills;
     } catch (error) {
        console.error('Error loading skills:', error);
     }
     // Fallback
    return [
         { name: 'Acrobatics', ability: 'Dexterity' },
         { name: 'Animal Handling', ability: 'Wisdom' },
         { name: 'Arcana', ability: 'Intelligence' },
         { name: 'Athletics', ability: 'Strength' },
         { name: 'Deception', ability: 'Charisma' },
         { name: 'History', ability: 'Intelligence' },
         { name: 'Insight', ability: 'Wisdom' },
         { name: 'Intimidation', ability: 'Charisma' },
         { name: 'Investigation', ability: 'Intelligence' },
         { name: 'Medicine', ability: 'Wisdom' },
         { name: 'Nature', ability: 'Intelligence' },
         { name: 'Perception', ability: 'Wisdom' },
         { name: 'Performance', ability: 'Charisma' },
         { name: 'Persuasion', ability: 'Charisma' },
         { name: 'Religion', ability: 'Intelligence' },
         { name: 'Sleight of Hand', ability: 'Dexterity' },
         { name: 'Stealth', ability: 'Dexterity' },
         { name: 'Survival', ability: 'Wisdom' }
     ];
 }

let wildMagicSurgePromise = null;

/**
    * Fetches wild magic surge table data (with caching) - version agnostic
    * @returns {Promise<object[]>} - Array of surge entries with min/max/effect
    */
export async function loadWildMagicSurgeTable() {
    if (sharedDataCache.wildMagicSurgeTable) {
        return sharedDataCache.wildMagicSurgeTable;
    }
    if (wildMagicSurgePromise) {
        return wildMagicSurgePromise;
    }
    wildMagicSurgePromise = (async () => {
        try {
            const response = await fetch('/data/wild-magic-surge.json');
            if (response.ok) {
                const data = await response.json();
                const parsed = data.map(entry => {
                    const [min, max] = entry.range.split('-').map(Number);
                    return { min, max, effect: entry.effect };
                });
                sharedDataCache.wildMagicSurgeTable = parsed;
                return parsed;
            }
        } catch (error) {
            console.error('Error loading wild magic surge table:', error);
        }
        return [];
    })();
    try {
        const result = await wildMagicSurgePromise;
        return result;
    } finally {
        wildMagicSurgePromise = null;
    }
}

/**
   * Clears the data cache (useful for testing or data refresh)
   */
export function clearDataCache() {
    dataCache['5e'] = {
      classes: null,
        races: null,
       backgrounds: null,
          feats: null,
          'rules-validation': null,
          spells: null,
          maneuvers: null
        };
      dataCache['2024'] = {
         classes: null,
           races: null,
            backgrounds: null,
          feats: null,
         'rules-validation': null,
         spells: null,
         maneuvers: null
        };
    dataPromises = {};
    sharedDataCache.skills = null;
      sharedDataCache.abilityScores = null;
     sharedDataCache.equipment = null;
   sharedDataCache.monsters = null;
 sharedDataCache.magicItems = null;
sharedDataCache.fightingStyles = null;
    sharedDataCache.wildMagicSurgeTable = null;
  }


/**
 * Gets the current cache state (useful for debugging)
 * @returns {object} - The cache state
 */
export function getCacheState() {
  return JSON.parse(JSON.stringify(dataCache));
}