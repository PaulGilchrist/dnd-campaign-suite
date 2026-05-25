/**
 * Central configuration for all views in the application.
 * This file is the single source of truth for view behavior.
 *
 * All sidebar views use a single activeView state variable.
 * Setting activeView to a view name automatically hides any other view.
 * Wizards are overlays and do not affect activeView.
 */

/**
 * View definitions — the canonical list of every view in the application.
 * All sidebar views share the same state variable: activeView.
 */
export const VIEWS = {
  CHAR_SHEET: {
    name: 'charSheet',
    stateVar: 'activeView',
    type: 'string',
    component: 'CharSheet',
    description: 'Main character sheet view — shown when a character is selected'
  },
  INITIATIVE: {
    name: 'initiative',
    stateVar: 'activeView',
    type: 'string',
    component: 'Initiative',
    description: 'Initiative tracker — shown only when selected from sidebar'
  },
  MAPS_MANAGER: {
    name: 'mapsManager',
    stateVar: 'activeView',
    type: 'string',
    component: 'MapsManager',
    description: 'GM map management screen'
  },
  MAP: {
    name: 'map',
    stateVar: 'activeView',
    type: 'string',
    component: 'Map',
    description: 'Active map view — shown when a map is opened from MapsManager'
  },
  ENCOUNTER: {
    name: 'encounter',
    stateVar: 'activeView',
    type: 'string',
    component: 'EncounterBuilder',
    description: 'Encounter builder'
  },
  FACTIONS: {
    name: 'factions',
    stateVar: 'activeView',
    type: 'string',
    component: 'Factions',
    description: 'Faction management'
  },
  NOTES: {
    name: 'notes',
    stateVar: 'activeView',
    type: 'string',
    component: 'Notes',
    description: 'Campaign notes'
  },
  QUESTS: {
    name: 'quests',
    stateVar: 'activeView',
    type: 'string',
    component: 'Quests',
    description: 'Quest tracking'
  },
  NPCS: {
    name: 'npcs',
    stateVar: 'activeView',
    type: 'string',
    component: 'NPCs',
    description: 'NPC management'
   },
  CAMPAIGN_LOG: {
    name: 'campaignLog',
    stateVar: 'activeView',
    type: 'string',
    component: 'Log',
    description: 'Campaign dice roll and activity log'
   },
  CAMPAIGN_SELECTION: {
    name: 'campaignSelection',
    stateVar: 'showCampaignSelection',
    type: 'boolean',
    component: 'CampaignSelection',
    overlay: true,
    description: 'Full-screen gate before app access'
  },
  CHARACTER_WIZARD: {
    name: 'characterWizard',
    stateVar: 'showCharacterWizard',
    type: 'boolean',
    component: 'CharacterCreationWizard',
    overlay: true,
    needsActiveCharacter: false,
    description: 'New character creation wizard overlay'
  },
  EDIT_CHARACTER_WIZARD: {
    name: 'editCharacterWizard',
    stateVar: 'showEditCharacterWizard',
    type: 'boolean',
    component: 'CharacterCreationWizard',
    overlay: true,
    needsActiveCharacter: true,
    description: 'Character editing wizard overlay'
  }
};

/**
 * Sidebar button definitions.
 */
export const SIDEBAR_BUTTONS = [
  { label: 'Character', icon: 'fa-user', view: 'charSheet' },
  { label: 'Encounter', icon: 'fa-skull-crossbones', view: 'encounter' },
  { label: 'Factions', icon: 'fa-handshake', view: 'factions' },
  { label: 'Initiative', icon: 'fa-gavel', view: 'initiative' },
  { label: 'Maps', icon: 'fa-map', view: 'mapsManager' },
  { label: 'Notes', icon: 'fa-sticky-note', view: 'notes' },
{ label: 'Quests', icon: 'fa-scroll', view: 'quests' },
    { label: 'NPCs', icon: 'fa-users', view: 'npcs' },
    { label: 'Log', icon: 'fa-book-journal-whills', view: 'campaignLog' }
];

/**
 * All sidebar views — mutually exclusive via single activeView variable.
 */
export const SIDEBAR_VIEWS = ['charSheet', 'initiative', 'mapsManager', 'encounter', 'factions', 'notes', 'quests', 'npcs', 'campaignLog'];
