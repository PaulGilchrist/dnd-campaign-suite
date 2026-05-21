// Hex map rendering constants
export const HEX_SIZE = 24; // radius of each hex in SVG pixels
export const DEFAULT_GRID_SIZE = 30; // default grid is 30x30 hexes

// Terrain types with distinct colors
export const TERRAIN_TYPES = [
  { id: 'plains',     name: 'Plains',     fill: '#A8D870', stroke: '#7CB342', label: 'Plains' },
  { id: 'hills',      name: 'Hills',      fill: '#7CB342', stroke: '#558B2F', label: 'Hills' },
  { id: 'forest',     name: 'Forest',     fill: '#2E7D32', stroke: '#1B5E20', label: 'Forest' },
  { id: 'mountains',  name: 'Mountains',  fill: '#9E9E9E', stroke: '#616161', label: 'Mts' },
  { id: 'desert',     name: 'Desert',     fill: '#F9E076', stroke: '#C4A265', label: 'Desert' },
  { id: 'swamp',      name: 'Swamp',      fill: '#5D8A6D', stroke: '#3D5D4B', label: 'Swamp' },
  { id: 'tundra',     name: 'Tundra',     fill: '#D4E8F0', stroke: '#9DB8C4', label: 'Tundra' },
  { id: 'water',      name: 'Water',      fill: '#4A90D9', stroke: '#2B6CB0', label: 'Water' },
];

// Default terrain (used when a hex has no assigned terrain)
export const DEFAULT_TERRAIN = 'plains';

// POI types
export const POI_TYPES = [
  { id: 'settlement',    name: 'Settlement',    label: 'Settlement',    svgId: 'poi-settlement',    description: 'Village, town, keep' },
  { id: 'dungeon',       name: 'Dungeon',       label: 'Dungeon',       svgId: 'poi-dungeon',       description: 'Ruins, cave, crypt' },
  { id: 'camp',          name: 'Camp',          label: 'Camp',          svgId: 'poi-camp',          description: 'Campsite, waystation' },
  { id: 'tower',         name: 'Tower',         label: 'Tower',         svgId: 'poi-tower',         description: 'Watchtower, mage tower' },
  { id: 'loreSite',      name: 'Lore Site',     label: 'Lore Site',     svgId: 'poi-lore-site',     description: 'Shrine, standing stones' },
  { id: 'hazard',        name: 'Hazard',        label: 'Hazard',        svgId: 'poi-hazard',        description: 'Quicksand, toxic swamp' },
  { id: 'naturalWonder', name: 'Natural Wonder', label: 'Natural Wonder', svgId: 'poi-natural-wonder', description: 'Waterfall, crystal formation' },
  { id: 'landmark',      name: 'Landmark',      label: 'Landmark',      svgId: 'poi-landmark',      description: 'Cliffs, monolith, lone tree' },
];

// Tool mode constants
export const TOOL_NONE = 'none';
export const TOOL_PAINT = 'paint';
export const TOOL_ERASE = 'erase';
export const TOOL_POI = 'poi';
export const TOOL_PAN = 'pan';

// Zoom limits
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
