/**
 * Central configuration for all views in the application.
 * This file is the single source of truth for view behavior.
 *
 * All sidebar views use a single activeView state variable.
 * Setting activeView to a view name automatically hides any other view.
 * Wizards are overlays and do not affect activeView.
 */
import { VIEW_LABELS, NAV_ITEMS } from '../services/ui/sidebarNav.js';

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
  QUEST_BOARD: {
    name: 'questBoard',
    stateVar: 'activeView',
    type: 'string',
    component: 'QuestBoard',
    description: 'Player quest board — read-only quest progress theatre + faction standings'
  },
    NPCS: {
      name: 'npcs',
      stateVar: 'activeView',
      type: 'string',
      component: 'NPCs',
      description: 'NPC management'
    },
    SETTLEMENTS: {
      name: 'settlements',
      stateVar: 'activeView',
      type: 'string',
      component: 'Settlements',
      description: 'Settlement management'
    },
  SESSIONS: {
    name: 'sessions',
    stateVar: 'activeView',
    type: 'string',
    component: 'Sessions',
    description: 'GM session planner — link maps, encounters, NPCs, quests and notes for the next session'
  },
  PARTY_INVENTORY: {
    name: 'partyInventory',
    stateVar: 'activeView',
    type: 'string',
    component: 'PartyInventory',
    description: 'Shared party inventory — unclaimed loot and currency tracked collectively'
  },
  CAMPAIGN_LOG: {
    name: 'campaignLog',
    stateVar: 'activeView',
    type: 'string',
    component: 'Log',
    description: 'Campaign dice roll and activity log'
   },
  CHRONICLE: {
    name: 'chronicle',
    stateVar: 'activeView',
    type: 'string',
    component: 'Chronicle',
    description: 'Read-only campaign story composed from the log, grouped by session, with Markdown export'
  },
  GM_SCREEN: {
    name: 'gmScreen',
    stateVar: 'activeView',
    type: 'string',
    component: 'GMScreen',
    description: 'GM screen — party AC/saves/skills/passives lookup, in-play summary, conditions/actions quick reference'
  },
  MUSIC: {
    name: 'music',
    stateVar: 'activeView',
    type: 'string',
    component: 'MusicPlayer',
    description: 'Ambience player — mood playback, transport, volume, and track editor (delegable to players)'
  },
  CAMPAIGN_BUILDER: {
    name: 'campaignBuilder',
    stateVar: 'activeView',
    type: 'string',
    component: 'CampaignBuilder',
    description: 'GM draft-review hub — approve or reject AI-authored content before players can see it'
  },
  CAMPAIGN_REPAIR: {
    name: 'campaignRepair',
    stateVar: 'activeView',
    type: 'string',
    component: 'CampaignAdmin',
    description: 'GM-only admin tools'
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
 * Sidebar button definitions — DELETED (Item 7, F13): this list drifted from
 * the live nav (it said "Encounter" while the sidebar said "Encounters",
 * and "Log" while the Log header said "Campaign Log"). The canonical label
 * source is VIEW_LABELS in src/services/ui/sidebarNav.js, which the sidebar
 * itself renders; getDocumentTitle below derives from it directly.
 */

/**
 * All sidebar views — mutually exclusive via single activeView variable.
 */
export const SIDEBAR_VIEWS = ['charSheet', 'initiative', 'mapsManager', 'encounter', 'factions', 'notes', 'quests', 'questBoard', 'npcs', 'sessions', 'settlements', 'partyInventory', 'campaignBuilder', 'campaignLog', 'chronicle', 'gmScreen', 'music', 'campaignRepair'];

/**
 * Neutral app name — matches index.html's static <title> so the
 * campaign-select screen and a fresh load agree.
 */
export const APP_TITLE = 'CharSheets';

// View-name → sidebar label, derived from VIEW_LABELS in sidebarNav.js — the
// single source of truth for how each view is named (Item 7 F13; the old
// duplicated SIDEBAR_BUTTONS list drifted and was deleted).
const VIEW_TITLE_LABELS = Object.fromEntries(
  Object.entries(VIEW_LABELS).map(([view, { label }]) => [view, label])
);

// Visitor-side naming law: NAV_ITEMS playerLabel renames a view for network
// clients (visitor "Map" vs GM "Maps"); the tab title follows the nav the
// user actually sees (F13).
const PLAYER_TITLE_LABELS = NAV_ITEMS.reduce((labels, { view, playerLabel }) => {
  if (view && playerLabel) labels[view] = playerLabel;
  return labels;
}, {});

/**
 * Browser tab title derivation (backlog KKK 2026-11-21): while a campaign is
 * mounted the title is "<campaign> — <view>" so every tab answers "which
 * campaign is this?" on multi-campaign QA setups and table TVs. The sheet
 * view names the open character as its section ("<campaign> — Aragorn");
 * any other view uses its sidebar label. The campaign-select screen (no
 * campaign, or the selection overlay showing after "Campaigns" — where
 * activeView may still hold a stale view) gets the neutral app name, never
 * a stale campaign.
 */
export function getDocumentTitle({ campaignName, showCampaignSelection, activeView, characterName, isLocalhost = true }) {
  if (!campaignName || showCampaignSelection) return APP_TITLE;
  if (activeView === VIEWS.CHAR_SHEET.name && characterName) {
    return `${campaignName} — ${characterName}`;
  }
  const label = (!isLocalhost && PLAYER_TITLE_LABELS[activeView]) || VIEW_TITLE_LABELS[activeView];
  return label ? `${campaignName} — ${label}` : campaignName;
}
