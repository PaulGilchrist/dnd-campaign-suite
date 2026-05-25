const WEATHER_TABLES = {
  temperate: ['clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm'],
  arid: ['clear', 'cloudy', 'cloudy', 'wind', 'wind', 'fog', 'fog', 'extreme'],
  cold: ['clear', 'cloudy', 'cloudy', 'snow', 'snow', 'storm', 'fog', 'extreme'],
  wet: ['cloudy', 'cloudy', 'rain', 'rain', 'rain', 'storm', 'fog', 'mist'],
  coastal: ['clear', 'cloudy', 'cloudy', 'rain', 'wind', 'wind', 'storm', 'fog'],
};

const TERRAIN_BIOME = {
  plains: 'temperate',
  forest: 'temperate',
  hills: 'temperate',
  mountains: 'cold',
  desert: 'arid',
  swamp: 'wet',
  tundra: 'cold',
  beach: 'coastal',
};

const WEATHER_EFFECTS = {
  clear: {
    label: 'Clear',
    icon: 'sun',
    visibility: null,
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: 0,
    description: 'Clear skies — no effect on travel',
  },
  cloudy: {
    label: 'Cloudy',
    icon: 'cloud',
    visibility: null,
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: 0,
    description: 'Overcast — no effect on travel',
  },
  rain: {
    label: 'Rain',
    icon: 'cloud-rain',
    visibility: null,
    moveCostMod: 1.25,
    budgetMod: 1.0,
    encounterMod: 10,
    description: 'Heavy rain — terrain costs +25%',
  },
  storm: {
    label: 'Storm',
    icon: 'bolt',
    visibility: 3,
    moveCostMod: 1.5,
    budgetMod: 0.75,
    encounterMod: 20,
    description: 'Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%',
  },
  fog: {
    label: 'Fog',
    icon: 'smog',
    visibility: 1,
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: -10,
    description: 'Thick fog — visibility limited to adjacent hexes',
  },
  wind: {
    label: 'High Wind',
    icon: 'wind',
    visibility: null,
    moveCostMod: 1.0,
    budgetMod: 0.8,
    encounterMod: 5,
    description: 'Strong winds — daily budget -20%',
  },
  snow: {
    label: 'Snow',
    icon: 'snowflake',
    visibility: null,
    moveCostMod: 1.5,
    budgetMod: 1.0,
    encounterMod: 10,
    description: 'Snowfall — terrain costs +50%',
  },
  mist: {
    label: 'Mist',
    icon: 'smog',
    visibility: 2,
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: -5,
    description: 'Heavy mist — visibility reduced',
  },
  extreme: {
    label: 'Extreme',
    icon: 'triangle-exclamation',
    visibility: 0,
    moveCostMod: null,
    budgetMod: 0,
    encounterMod: 30,
    description: 'Blizzard or sandstorm — travel impossible, forced camp',
  },
};

export function getBiome(terrainType) {
  return TERRAIN_BIOME[terrainType] || 'temperate';
}

export function getWeatherTable(biome) {
  return WEATHER_TABLES[biome] || WEATHER_TABLES.temperate;
}

export function generateWeather(terrainType) {
  const biome = getBiome(terrainType);
  const table = getWeatherTable(biome);
  const condition = table[Math.floor(Math.random() * table.length)];
  return getWeatherEffects(condition);
}

export function getWeatherEffects(condition) {
  return {
    condition,
    ...WEATHER_EFFECTS[condition] || WEATHER_EFFECTS.clear,
  };
}

export function getWeatherIcon(condition) {
  const effect = WEATHER_EFFECTS[condition];
  return effect ? effect.icon : 'sun';
}

export function getWeatherLabel(condition) {
  const effect = WEATHER_EFFECTS[condition];
  return effect ? effect.label : 'Unknown';
}

export function getWeatherDescription(condition) {
  const effect = WEATHER_EFFECTS[condition];
  return effect ? effect.description : '';
}
