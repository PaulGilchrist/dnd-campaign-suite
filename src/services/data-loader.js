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
    'rules-validation': null
  },
  '2024': {
    classes: null,
    races: null,
    backgrounds: null,
    feats: null,
    'rules-validation': null
  }
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

  // Return cached data if available
  if (versionCache[cacheKey]) {
    return versionCache[cacheKey];
  }

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

    const data = await response.json();
    versionCache[cacheKey] = data;
    return data;
  } catch (error) {
    console.error(`Error loading ${version} ${dataType}.json:`, error);
    return [];
  }
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

/**
 * Clears the data cache (useful for testing or data refresh)
 */
export function clearDataCache() {
  dataCache['5e'] = {
    classes: null,
    races: null,
    backgrounds: null,
    feats: null,
    'rules-validation': null
  };
  dataCache['2024'] = {
    classes: null,
    races: null,
    backgrounds: null,
    feats: null,
    'rules-validation': null
  };
}

/**
 * Gets the current cache state (useful for debugging)
 * @returns {object} - The cache state
 */
export function getCacheState() {
  return JSON.parse(JSON.stringify(dataCache));
}