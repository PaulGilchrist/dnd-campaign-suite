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

// Weather rows carry ONLY the fields the app actually applies: moveCostMod
// (per-hex travel cost), budgetMod (daily hex budget) and encounterMod
// (event-roll odds, surfaced by the panel's effective-chance row) — plus the
// label/icon/description the TravelPanel prints (bug-weather-visibility-
// advertised-never-enforced: `visibility` had zero consumers — fog/mist/storm
// copy promised restricted line-of-sight or planning nothing rendered or
// gated, so the field and the claims are gone). If a future LOS/visibility
// lane is built, re-add the field WITH the consumer, never without.
const WEATHER_EFFECTS = {
  clear: {
    label: 'Clear',
    icon: 'sun',
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: 0,
    description: 'Clear skies — no effect on travel',
  },
  cloudy: {
    label: 'Cloudy',
    icon: 'cloud',
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: 0,
    description: 'Overcast — no effect on travel',
  },
  rain: {
    label: 'Rain',
    icon: 'cloud-rain',
    moveCostMod: 1.25,
    budgetMod: 1.0,
    encounterMod: 10,
    description: 'Heavy rain — terrain costs +25%',
  },
  storm: {
    label: 'Storm',
    icon: 'bolt',
    moveCostMod: 1.5,
    budgetMod: 0.75,
    encounterMod: 20,
    description: 'Thunderstorm — terrain costs +50%, daily budget -25%',
  },
  fog: {
    label: 'Fog',
    icon: 'smog',
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: -10,
    description: 'Thick fog — encounter chance -10%',
  },
  wind: {
    label: 'High Wind',
    icon: 'wind',
    moveCostMod: 1.0,
    budgetMod: 0.8,
    encounterMod: 5,
    description: 'Strong winds — daily budget -20%',
  },
  snow: {
    label: 'Snow',
    icon: 'snowflake',
    moveCostMod: 1.5,
    budgetMod: 1.0,
    encounterMod: 10,
    description: 'Snowfall — terrain costs +50%',
  },
  mist: {
    label: 'Mist',
    icon: 'smog',
    moveCostMod: 1.0,
    budgetMod: 1.0,
    encounterMod: -5,
    description: 'Heavy mist — encounter chance -5%',
  },
  extreme: {
    label: 'Extreme',
    icon: 'triangle-exclamation',
    moveCostMod: null,
    budgetMod: 0,
    encounterMod: 30,
    description: 'Blizzard or sandstorm — travel impossible, forced camp',
  },
};

function getBiome(terrainType) {
  return TERRAIN_BIOME[terrainType] || 'temperate';
}

function getWeatherTable(biome) {
  return WEATHER_TABLES[biome] || WEATHER_TABLES.temperate;
}

export function generateWeather(terrainType) {
  const biome = getBiome(terrainType);
  const table = getWeatherTable(biome);
  const condition = table[Math.floor(Math.random() * table.length)];
  return getWeatherEffects(condition);
}

function getWeatherEffects(condition) {
  return {
    condition,
    ...WEATHER_EFFECTS[condition] || WEATHER_EFFECTS.clear,
  };
}


