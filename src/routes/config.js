/**
 * Central configuration for all views, routing state, and transition rules.
 * This file is the single source of truth for view behavior in the app.
 */

/**
 * View definitions — the canonical list of every view in the application.
 */
export const VIEWS = {
  CAMPAIGN_SELECTION: {
    name: 'campaignSelection',
    stateVar: 'showCampaignSelection',
    type: 'boolean',
    component: 'CampaignSelection',
    clears: [],
    clearedBy: [],
    overlay: true,
    description: 'Full-screen gate before app access'
  },
  CHAR_SHEET: {
    name: 'charSheet',
    stateVar: 'activeCharacter',
    type: 'object',
    component: 'CharSheet',
    clears: ['mapsManager', 'map', 'encounter', 'notes', 'npcs', 'initiative'],
    clearedBy: ['mapsManager', 'map', 'initiative'],
    overlay: false,
    description: 'Main character sheet view'
  },
  INITIATIVE: {
    name: 'initiative',
    stateVar: 'showInitiative',
    type: 'boolean',
    component: 'Initiative',
    clears: ['charSheet', 'mapsManager', 'map', 'encounter', 'notes', 'npcs'],
    clearedBy: ['charSheet', 'mapsManager', 'map', 'encounter', 'notes', 'npcs'],
    overlay: false,
    description: 'Initiative tracker — shown only when selected from sidebar'
  },
  MAPS_MANAGER: {
    name: 'mapsManager',
    stateVar: 'mapsView',
    type: 'mapsManager',
    component: 'MapsManager',
    clears: ['charSheet', 'encounter', 'notes', 'npcs', 'initiative'],
    clearedBy: ['map', 'initiative'],
    overlay: false,
    description: 'GM map management screen'
  },
  MAP: {
    name: 'map',
    stateVar: 'mapsView',
    type: 'map',
    component: 'Map',
    clears: ['charSheet', 'encounter', 'notes', 'npcs', 'initiative'],
    clearedBy: ['mapsManager', 'initiative'],
    overlay: false,
    description: 'Active map view'
  },
  ENCOUNTER: {
    name: 'encounter',
    stateVar: 'showEncounter',
    type: 'boolean',
    component: 'EncounterBuilder',
    clears: ['charSheet', 'mapsManager', 'map', 'notes', 'npcs', 'initiative'],
    clearedBy: ['mapsManager', 'map', 'initiative'],
    overlay: false,
    description: 'Encounter builder'
  },
  NOTES: {
    name: 'notes',
    stateVar: 'showNotes',
    type: 'boolean',
    component: 'Notes',
    clears: ['charSheet', 'mapsManager', 'map', 'encounter', 'npcs', 'initiative'],
    clearedBy: ['mapsManager', 'map', 'initiative'],
    overlay: false,
    description: 'Campaign notes'
  },
  NPCS: {
    name: 'npcs',
    stateVar: 'showNPCs',
    type: 'boolean',
    component: 'NPCs',
    clears: ['charSheet', 'mapsManager', 'map', 'encounter', 'notes', 'initiative'],
    clearedBy: ['mapsManager', 'map', 'initiative'],
    overlay: false,
    description: 'NPC management'
  },
  CHARACTER_WIZARD: {
    name: 'characterWizard',
    stateVar: 'showCharacterWizard',
    type: 'boolean',
    component: 'CharacterCreationWizard',
    clears: [],
    clearedBy: [],
    overlay: true,
    needsActiveCharacter: false,
    description: 'New character creation wizard overlay'
  },
  EDIT_CHARACTER_WIZARD: {
    name: 'editCharacterWizard',
    stateVar: 'showEditCharacterWizard',
    type: 'boolean',
    component: 'CharacterCreationWizard',
    clears: [],
    clearedBy: [],
    overlay: true,
    needsActiveCharacter: true,
    description: 'Character editing wizard overlay'
  }
};

/**
 * Clear rules — when a view is activated, these other views are cleared.
 * Maps each view name to the list of view names it closes.
 */
export const CLEAR_RULES = {
  charSheet: ['mapsManager', 'map', 'encounter', 'notes', 'npcs', 'initiative'],
  mapsManager: ['charSheet', 'encounter', 'notes', 'npcs', 'initiative'],
  map: ['charSheet', 'encounter', 'notes', 'npcs', 'initiative'],
  encounter: ['charSheet', 'mapsManager', 'map', 'notes', 'npcs', 'initiative'],
  notes: ['charSheet', 'mapsManager', 'map', 'encounter', 'npcs', 'initiative'],
  npcs: ['charSheet', 'mapsManager', 'map', 'encounter', 'notes', 'initiative'],
  initiative: ['charSheet', 'mapsManager', 'map', 'encounter', 'notes', 'npcs']
};

/**
 * Sidebar button definitions.
 */
export const SIDEBAR_BUTTONS = [
  { label: 'Character', icon: 'fa-user', view: 'charSheet', action: 'setActiveCharacter' },
  { label: 'Initiative', icon: 'fa-gavel', view: 'initiative', action: 'toggleInitiative' },
  { label: 'Maps', icon: 'fa-map', view: 'mapsManager', action: 'handleMapsClick' },
  { label: 'Notes', icon: 'fa-sticky-note', view: 'notes', action: 'handleNotesClick' },
  { label: 'Encounter', icon: 'fa-skull-crossbones', view: 'encounter', action: 'handleEncounterClick' },
  { label: 'NPCs', icon: 'fa-users', view: 'npcs', action: 'handleNPCsClick' }
];

/**
 * Returns true if two views cannot be shown simultaneously.
 * Two views are mutually exclusive if either one clears the other.
 */
export function isMutuallyExclusive(viewA, viewB) {
  const clearsA = CLEAR_RULES[viewA] || [];
  const clearsB = CLEAR_RULES[viewB] || [];
  return clearsA.includes(viewB) || clearsB.includes(viewA);
}
