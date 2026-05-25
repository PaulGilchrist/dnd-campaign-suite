// Hex map rendering constants
export const HEX_SIZE = 30; // radius of each hex in SVG pixels
export const DEFAULT_GRID_SIZE = 30; // default grid is 30x30 hexes

// Terrain types with distinct colors
export const TERRAIN_TYPES = [
  { id: 'plains',     name: 'Plains',     fill: '#C4D9A5', stroke: '#A8C088', label: 'Plains' },
  { id: 'hills',      name: 'Hills',      fill: '#8DB580', stroke: '#70986A', label: 'Hills' },
  { id: 'forest',     name: 'Forest',     fill: '#3D7A4A', stroke: '#2D5E37', label: 'Forest' },
  { id: 'mountains',  name: 'Mountains',  fill: '#8B8B7A', stroke: '#6F6F62', label: 'Mts' },
  { id: 'desert',     name: 'Desert',     fill: '#E8D5A3', stroke: '#C4B080', label: 'Desert' },
  { id: 'swamp',      name: 'Swamp',      fill: '#6B8E6E', stroke: '#4F6E52', label: 'Swamp' },
  { id: 'tundra',     name: 'Tundra',     fill: '#C8D8D8', stroke: '#A0B0B0', label: 'Tundra' },
  { id: 'water',      name: 'Water',      fill: '#4A7FB5', stroke: '#356090', label: 'Water' },
  { id: 'beach',      name: 'Beach',      fill: '#F0DCA0', stroke: '#D4C080', label: 'Beach' },
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
export const TOOL_RIVER = 'river';
export const TOOL_PAN = 'pan';
export const TOOL_TRAVEL = 'travel';

// Zoom limits
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
