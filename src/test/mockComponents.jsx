import { vi } from 'vitest';
import { mockState } from './appTestState.js';

export const MockCharSheet = vi.fn((props) => (
  <div data-testid="char-sheet">
    <span data-testid="character-name">{props.playerSummary?.name || 'no character'}</span>
    <button title="Delete Character" onClick={() => props.onDeleteCharacter?.(props.playerSummary?.name)}>Delete Char</button>
    <button onClick={props.onUploadClick}>Upload</button>
    <button onClick={props.onSaveClick}>Download</button>
    <button onClick={props.onEditCharacter}>Edit</button>
  </div>
));

export const MockInitiative = vi.fn(({ characters, campaignName }) => (
  <div data-testid="initiative">
    <span data-testid="init-char-count">{characters?.length || 0}</span>
    <span data-testid="init-campaign">{campaignName}</span>
  </div>
));

export const MockCampaignSelection = vi.fn(({ onCampaignSelect }) => (
  <div data-testid="campaign-selection">
    <button
      data-testid="select-campaign-btn"
      onClick={() => onCampaignSelect(mockState.campaignName, mockState.characters)}
    >
      Select Campaign
    </button>
  </div>
));

export const MockWizard = vi.fn(({ onComplete, onCancel, characterData, isEditing }) => (
  <div data-testid="character-wizard">
    <button data-testid="wizard-complete-btn" onClick={() => onComplete({ name: 'New Character', level: 1 })}>
      Complete
    </button>
    <button data-testid="wizard-cancel-btn" onClick={onCancel}>Cancel</button>
    {characterData && <div data-testid="editing-character">{characterData.name}</div>}
    {isEditing && <div data-testid="editing-mode">Editing Mode</div>}
  </div>
));

export const MockSidebar = vi.fn(({
  campaignName, characters, activeCharacter, onBackToCampaigns, onAddCharacter, onCharacterClick,
  onInitiativeClick, onEncounterClick, onFactionsClick, onMapsClick, onNotesClick, onQuestsClick,
  onNPCsClick, onRenameCampaign, onDeleteCampaign, theme, toggleTheme, isLocalhost,
}) => (
  <div data-testid="sidebar">
    <div data-testid="sidebar-campaign">{campaignName}</div>
    <button data-testid="back-to-campaigns-btn" onClick={onBackToCampaigns}>
      <i className="fa-solid fa-arrow-left"></i> Campaigns
    </button>
    <button data-testid="add-character-btn" onClick={onAddCharacter}>
      <i className="fa-solid fa-plus"></i> Add Character
    </button>
    <div data-testid="sidebar-characters">
      {characters?.map((char, i) => (
        <button
          key={`${char.name}-${i}`}
          data-testid={`char-btn-${char.name}`}
          className={activeCharacter?.name === char.name ? 'active' : ''}
          onClick={() => onCharacterClick(char)}
        >
          {char.name}
        </button>
      ))}
    </div>
    <button data-testid="initiative-btn" onClick={onInitiativeClick}>
      Initiative
    </button>
    <button data-testid="maps-btn" onClick={onMapsClick}>
      {isLocalhost ? 'Maps' : 'Map'}
    </button>
    <button data-testid="notes-btn" onClick={onNotesClick}>
      Notes
    </button>
    <button data-testid="encounter-btn" onClick={onEncounterClick}>
      Encounters
    </button>
    <button data-testid="factions-btn" onClick={onFactionsClick}>
      Factions
    </button>
    <button data-testid="npcs-btn" onClick={onNPCsClick}>
      NPCs
    </button>
    <button data-testid="quests-btn" onClick={onQuestsClick}>
      Quests
    </button>
    <button data-testid="rename-campaign-btn" onClick={onRenameCampaign} disabled={!isLocalhost}>
      Rename
    </button>
    <button data-testid="delete-campaign-btn" onClick={onDeleteCampaign} disabled={characters?.length > 0}>
      Delete Campaign
    </button>
    <button data-testid="theme-toggle-btn" onClick={toggleTheme}>
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
    <span data-testid="sidebar-theme">{theme}</span>
    <span data-testid="sidebar-localhost">{String(isLocalhost)}</span>
  </div>
));

export const MockMapsManager = vi.fn(({ campaignName, onOpenMap, onBack }) => (
  <div data-testid="maps-manager">
    <span data-testid="mm-campaign">{campaignName}</span>
    <button data-testid="open-map-btn" onClick={() => onOpenMap('dungeon-1')}>Open Map</button>
    <button data-testid="mm-back-btn" onClick={onBack}>Back</button>
  </div>
));

export const MockMap = vi.fn(({ mapName, campaignName, characters, npcs, isLocalhost, onBack }) => (
  <div data-testid="map-view">
    <span data-testid="map-name">{mapName}</span>
    <span data-testid="map-campaign">{campaignName}</span>
    <span data-testid="map-char-count">{characters?.length || 0}</span>
    <span data-testid="map-npc-count">{npcs?.length || 0}</span>
    <span data-testid="map-localhost">{String(isLocalhost)}</span>
    <button data-testid="map-back-btn" onClick={onBack}>Back from Map</button>
  </div>
));

export const MockEncounterBuilder = vi.fn(({ characters, campaignName }) => (
  <div data-testid="encounter-builder">
    <span data-testid="eb-char-count">{characters?.length || 0}</span>
    <span data-testid="eb-campaign">{campaignName}</span>
  </div>
));

export const MockNotes = vi.fn(({ campaignName, isLocalhost, onBack }) => (
  <div data-testid="notes-view">
    <span data-testid="notes-campaign">{campaignName}</span>
    <span data-testid="notes-localhost">{String(isLocalhost)}</span>
    <button data-testid="notes-back-btn" onClick={onBack}>Back from Notes</button>
  </div>
));

export const MockQuests = vi.fn(({ campaignName, isLocalhost, onBack }) => (
  <div data-testid="quests-view">
    <span data-testid="quests-campaign">{campaignName}</span>
    <span data-testid="quests-localhost">{String(isLocalhost)}</span>
    <button data-testid="quests-back-btn" onClick={onBack}>Back from Quests</button>
  </div>
));

export const MockNPCs = vi.fn(({ campaignName, characters, onBack }) => (
  <div data-testid="npcs-view">
    <span data-testid="npcs-campaign">{campaignName}</span>
    <span data-testid="npcs-char-count">{characters?.length || 0}</span>
    <button data-testid="npcs-back-btn" onClick={onBack}>Back from NPCs</button>
  </div>
));

export const MockFactions = vi.fn(({ campaignName, isLocalhost, onBack }) => (
  <div data-testid="factions-view">
    <span data-testid="factions-campaign">{campaignName}</span>
    <span data-testid="factions-localhost">{String(isLocalhost)}</span>
    <button data-testid="factions-back-btn" onClick={onBack}>Back from Factions</button>
  </div>
));
