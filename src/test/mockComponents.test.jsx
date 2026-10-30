// @maintained-by-ai
// @improved-by-ai
/**
 * Contract tests for src/test/mockComponents.jsx.
 *
 * The App.*.test.jsx suites replace real components with these mocks via
 * vi.mock(), then drive the app by clicking mock testids and reading
 * rendered text. These tests pin that contract at the mock level so a mock
 * edit fails HERE — locally and with a clear name — instead of surfacing as
 * a confusing navigation failure inside one of six app suites:
 *   - every root/element testid a consuming suite queries is rendered
 *   - every callback fires with the exact payload consumers depend on,
 *     and fires ONLY its own callback (wiring isolation)
 *   - mocks never crash when App omits optional props
 *
 * These tests describe the MOCKS, not production components — green here
 * makes no claim about real component behaviour.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MockCharSheet,
  MockInitiative,
  MockCampaignSelection,
  MockWizard,
  MockSidebar,
  MockMapsManager,
  MockMap,
  MockEncounterBuilder,
  MockNotes,
  MockQuests,
  MockNPCs,
  MockSettlements,
  MockLog,
  MockFactions,
  MockCampaignAdmin,
} from './mockComponents';
import { mockState } from './appTestState.js';

// Root testids each App.* suite queries to prove which view is mounted.
// Consuming suites: App.map-navigation, App.map-unavailable,
// App.map-activate, App.state-transitions, App.runtime-events,
// App.post-restore.
const ROOT_TESTIDS = [
  ['MockCharSheet', MockCharSheet, 'char-sheet'],
  ['MockInitiative', MockInitiative, 'initiative'],
  ['MockCampaignSelection', MockCampaignSelection, 'campaign-selection'],
  ['MockWizard', MockWizard, 'character-wizard'],
  ['MockSidebar', MockSidebar, 'sidebar'],
  ['MockMapsManager', MockMapsManager, 'maps-manager'],
  ['MockMap', MockMap, 'map-view'],
  ['MockEncounterBuilder', MockEncounterBuilder, 'encounter-builder'],
  ['MockNotes', MockNotes, 'notes-view'],
  ['MockQuests', MockQuests, 'quests-view'],
  ['MockNPCs', MockNPCs, 'npcs-view'],
  ['MockSettlements', MockSettlements, 'settlements-view'],
  ['MockLog', MockLog, 'campaign-log-view'],
  ['MockFactions', MockFactions, 'factions-view'],
  ['MockCampaignAdmin', MockCampaignAdmin, 'campaign-admin'],
];

describe('all mocks: mount contract', () => {
  it.each(ROOT_TESTIDS)(
    '%s renders its root testid without crashing when App omits every prop',
    (_name, Component, rootTestid) => {
      render(<Component />);
      expect(screen.getByTestId(rootTestid)).toBeInTheDocument();
    },
  );
});

describe('MockCharSheet', () => {
  it.each([
    ['summary with a name', { name: 'TestChar' }, 'TestChar'],
    ['summary without a name', {}, 'no character'],
    ['no summary at all', undefined, 'no character'],
  ])('renders the character name from %s', (_label, playerSummary, expected) => {
    render(<MockCharSheet playerSummary={playerSummary} />);
    expect(screen.getByTestId('character-name')).toHaveTextContent(expected);
  });

  // App passes the character name (not the whole summary) to the delete flow.
  it.each([
    ['a summary', { name: 'TestChar' }, 'TestChar'],
    ['no summary', undefined, undefined],
  ])('fires onDeleteCharacter with the character name for %s', (_label, playerSummary, expectedArg) => {
    const onDelete = vi.fn();
    render(<MockCharSheet playerSummary={playerSummary} onDeleteCharacter={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete Character'));
    expect(onDelete).toHaveBeenCalledWith(expectedArg);
  });

  it('delete button is click-safe when onDeleteCharacter is omitted', () => {
    render(<MockCharSheet />);
    expect(() => fireEvent.click(screen.getByTitle('Delete Character'))).not.toThrow();
  });

  // No testids on these — consuming suites locate them by label, so the
  // visible label text is part of the contract.
  it.each([
    ['Upload', 'onUploadClick'],
    ['Download', 'onSaveClick'],
    ['Edit', 'onEditCharacter'],
  ])('%s button fires %s exactly once', (label, propName) => {
    const cb = vi.fn();
    render(<MockCharSheet {...{ [propName]: cb }} />);
    fireEvent.click(screen.getByText(label));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('MockInitiative', () => {
  it.each([
    ['three characters', ['a', 'b', 'c'], '3'],
    ['an empty list', [], '0'],
    ['no characters prop', undefined, '0'],
  ])('%s renders the count alongside the campaign name', (_label, characters, expectedCount) => {
    render(<MockInitiative characters={characters} campaignName="my-campaign" />);
    expect(screen.getByTestId('init-char-count')).toHaveTextContent(expectedCount);
    expect(screen.getByTestId('init-campaign')).toHaveTextContent('my-campaign');
  });
});

describe('MockCampaignSelection', () => {
  // mockState is shared mutable state that consuming suites mutate freely;
  // never leak edits past this file's suites.
  const saved = { campaignName: mockState.campaignName, characters: mockState.characters };
  afterEach(() => {
    mockState.campaignName = saved.campaignName;
    mockState.characters = saved.characters;
  });

  it('fires onCampaignSelect with the current mockState', () => {
    mockState.campaignName = 'test-campaign';
    mockState.characters = ['char1', 'char2'];
    const onSelect = vi.fn();
    render(<MockCampaignSelection onCampaignSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
    expect(onSelect).toHaveBeenCalledWith('test-campaign', ['char1', 'char2']);
  });

  // The mock reads mockState at CLICK time, not render time. Consuming
  // suites set mockState after render and before clicking — if the mock
  // ever snapshots at render, every suite breaks at once.
  it('reports mockState mutated AFTER render (live read, not snapshot)', () => {
    const onSelect = vi.fn();
    render(<MockCampaignSelection onCampaignSelect={onSelect} />);
    mockState.campaignName = 'late-campaign';
    mockState.characters = [{ name: 'Late' }];
    fireEvent.click(screen.getByTestId('select-campaign-btn'));
    expect(onSelect).toHaveBeenCalledWith('late-campaign', [{ name: 'Late' }]);
  });
});

describe('MockWizard', () => {
  // Consuming suites (App.runtime-events) create a character through this
  // fixed payload and then expect a "char-btn-New Character" to appear —
  // the exact shape is the contract, even while editing an existing char.
  const CREATED = { name: 'New Character', level: 1 };

  it.each([
    ['creating', undefined],
    ['editing an existing character', { name: 'EditMe' }],
  ])('complete fires onComplete with the fixed created-character payload when %s', (_label, characterData) => {
    const onComplete = vi.fn();
    render(<MockWizard onComplete={onComplete} characterData={characterData} />);
    fireEvent.click(screen.getByTestId('wizard-complete-btn'));
    expect(onComplete).toHaveBeenCalledWith(CREATED);
  });

  it('cancel fires onCancel exactly once', () => {
    const onCancel = vi.fn();
    render(<MockWizard onComplete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('editing-character shows the character name when characterData is provided', () => {
    render(<MockWizard characterData={{ name: 'EditMe' }} />);
    expect(screen.getByTestId('editing-character')).toHaveTextContent('EditMe');
  });

  it.each([null, undefined])('editing-character is absent when characterData is %s', (characterData) => {
    render(<MockWizard characterData={characterData} />);
    expect(screen.queryByTestId('editing-character')).toBeNull();
  });

  it.each([true, false])('editing-mode renders iff isEditing is %s', (isEditing) => {
    render(<MockWizard isEditing={isEditing} />);
    if (isEditing) {
      expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('editing-mode')).toBeNull();
    }
  });
});

// testid → the prop App.jsx wires to it. One shared callback would let a
// miswired handler pass, so each test asserts its own handler fired and
// every other nav handler stayed quiet.
const SIDEBAR_NAV_BUTTONS = [
  ['back-to-campaigns-btn', 'onBackToCampaigns'],
  ['add-character-btn', 'onAddCharacter'],
  ['initiative-btn', 'onInitiativeClick'],
  ['maps-btn', 'onMapsClick'],
  ['notes-btn', 'onNotesClick'],
  ['encounter-btn', 'onEncounterClick'],
  ['factions-btn', 'onFactionsClick'],
  ['npcs-btn', 'onNPCsClick'],
  ['quests-btn', 'onQuestsClick'],
  ['settlements-btn', 'onSettlementsClick'],
];

function allSidebarHandlers() {
  const handlers = {};
  SIDEBAR_NAV_BUTTONS.forEach(([, prop]) => {
    handlers[prop] = vi.fn();
  });
  return handlers;
}

describe('MockSidebar', () => {
  it('renders the campaign name and the localhost flag as a string', () => {
    render(<MockSidebar campaignName="my-campaign" isLocalhost={true} />);
    expect(screen.getByTestId('sidebar-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('sidebar-localhost')).toHaveTextContent('true');
  });

  // Mirrors MOCK_VIEW_LABELS in mockComponents.jsx. App.state-transitions
  // asserts these exact strings via sidebar-active-indicator.
  const ACTIVE_VIEW_LABELS = [
    ['encounter', 'Encounters'],
    ['factions', 'Factions'],
    ['initiative', 'Initiative'],
    ['mapsManager', 'Maps'],
    ['notes', 'Notes'],
    ['quests', 'Quests'],
    ['npcs', 'NPCs'],
    ['settlements', 'Settlements'],
    ['campaignLog', 'Log'],
    ['unknownView', ''], // unknown views get an empty label, not a crash
  ];

  it.each(ACTIVE_VIEW_LABELS)(
    'active indicator for the %s view shows "%s"',
    (activeView, expected) => {
      render(<MockSidebar campaignName="test" activeView={activeView} />);
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent(expected);
    },
  );

  it('charSheet view shows the active character name', () => {
    render(<MockSidebar campaignName="test" activeView="charSheet" activeCharacter={{ name: 'Hero' }} />);
    expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Hero');
  });

  it('charSheet view falls back to the generic label without an active character', () => {
    render(<MockSidebar campaignName="test" activeView="charSheet" />);
    expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent('Character');
  });

  it('omits the active indicator when no activeView is provided', () => {
    render(<MockSidebar campaignName="test" />);
    expect(screen.queryByTestId('sidebar-active-indicator')).toBeNull();
  });

  it.each([
    [true, 'Maps'],
    [false, 'Map'],
  ])('when isLocalhost is %s the maps button reads "%s" (GM vs player)', (isLocalhost, expected) => {
    render(<MockSidebar campaignName="test" isLocalhost={isLocalhost} onMapsClick={vi.fn()} />);
    expect(screen.getByTestId('maps-btn')).toHaveTextContent(expected);
  });

  it.each(SIDEBAR_NAV_BUTTONS)(
    'clicking %s fires %s and no other navigation callback',
    (testid, prop) => {
      const handlers = allSidebarHandlers();
      render(<MockSidebar campaignName="test" {...handlers} />);
      fireEvent.click(screen.getByTestId(testid));
      expect(handlers[prop]).toHaveBeenCalledTimes(1);
      Object.entries(handlers)
        .filter(([key]) => key !== prop)
        .forEach(([, otherCb]) => expect(otherCb).not.toHaveBeenCalled());
    },
  );

  // The whole character object (not just the name) reaches the handler —
  // App reads level and other fields from it.
  it('renders one button per character and fires onCharacterClick with the whole object', () => {
    const onClick = vi.fn();
    const characters = [{ name: 'Char1', level: 3 }, { name: 'Char2', level: 1 }];
    render(<MockSidebar campaignName="test" characters={characters} onCharacterClick={onClick} />);
    expect(screen.getByTestId('char-btn-Char1')).toHaveTextContent('Char1');
    expect(screen.getByTestId('char-btn-Char2')).toHaveTextContent('Char2');
    fireEvent.click(screen.getByTestId('char-btn-Char1'));
    expect(onClick).toHaveBeenCalledWith({ name: 'Char1', level: 3 });
  });

  it('marks only the active character button with the active class', () => {
    render(
      <MockSidebar
        campaignName="test"
        characters={[{ name: 'ActiveChar' }, { name: 'InactiveChar' }]}
        activeView="charSheet"
        activeCharacter={{ name: 'ActiveChar' }}
        onCharacterClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('char-btn-ActiveChar')).toHaveClass('active');
    expect(screen.getByTestId('char-btn-InactiveChar')).not.toHaveClass('active');
  });

  it.each([true, false])('admin button renders iff isLocalhost is %s, firing onRepairClick', (isLocalhost) => {
    const cb = vi.fn();
    render(<MockSidebar campaignName="test" isLocalhost={isLocalhost} onRepairClick={cb} />);
    if (isLocalhost) {
      expect(screen.getByTestId('admin-btn')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('admin-btn'));
      expect(cb).toHaveBeenCalledTimes(1);
    } else {
      expect(screen.queryByTestId('admin-btn')).toBeNull();
    }
  });
});

describe('MockMapsManager', () => {
  it('echoes the campaign and fires onOpenMap with the fixed "dungeon-1" id + row display name', () => {
    const onOpenMap = vi.fn();
    const onBack = vi.fn();
    render(<MockMapsManager campaignName="my-campaign" onOpenMap={onOpenMap} onBack={onBack} />);
    expect(screen.getByTestId('mm-campaign')).toHaveTextContent('my-campaign');
    fireEvent.click(screen.getByTestId('open-map-btn'));
    expect(onOpenMap).toHaveBeenCalledWith('dungeon-1', 'Dungeon 1');
    fireEvent.click(screen.getByTestId('mm-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MockMap', () => {
  it('echoes map name, campaign, counts, and localhost flag', () => {
    render(
      <MockMap
        mapName="dungeon-1"
        mapDisplayName="Dungeon 1"
        campaignName="my-campaign"
        characters={['c1', 'c2']}
        npcs={['n1']}
        isLocalhost={true}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId('map-name')).toHaveTextContent('dungeon-1');
    expect(screen.getByTestId('map-display-name')).toHaveTextContent('Dungeon 1');
    expect(screen.getByTestId('map-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('map-char-count')).toHaveTextContent('2');
    expect(screen.getByTestId('map-npc-count')).toHaveTextContent('1');
    expect(screen.getByTestId('map-localhost')).toHaveTextContent('true');
  });

  it('back button fires onBack exactly once', () => {
    const onBack = vi.fn();
    render(<MockMap mapName="m" campaignName="t" onBack={onBack} />);
    fireEvent.click(screen.getByTestId('map-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // App.map-navigation drives the POI stack through this fixed id:
  // clicking must open "inner-cave" via onPoiEntered.
  it('POI button fires onPoiEntered with "inner-cave"', () => {
    const onPoiEntered = vi.fn();
    render(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} onPoiEntered={onPoiEntered} />);
    fireEvent.click(screen.getByTestId('map-enter-poi-btn'));
    expect(onPoiEntered).toHaveBeenCalledWith('inner-cave');
  });

  it('POI button is click-safe when onPoiEntered is omitted', () => {
    render(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} />);
    expect(() => fireEvent.click(screen.getByTestId('map-enter-poi-btn'))).not.toThrow();
  });
});

describe('MockEncounterBuilder', () => {
  it.each([
    ['0', []],
    ['3', ['c1', 'c2', 'c3']],
  ])('renders character count %s and the campaign name', (expectedCount, characters) => {
    render(<MockEncounterBuilder characters={characters} campaignName="my-campaign" />);
    expect(screen.getByTestId('eb-char-count')).toHaveTextContent(expectedCount);
    expect(screen.getByTestId('eb-campaign')).toHaveTextContent('my-campaign');
  });
});

// Notes, Quests, and Factions share one mock shape; consuming suites query
// them by their prefixed testids.
describe.each([
  ['MockNotes', MockNotes, 'notes'],
  ['MockQuests', MockQuests, 'quests'],
  ['MockFactions', MockFactions, 'factions'],
])('%s', (_name, Component, prefix) => {
  it('echoes campaign and localhost, and back fires onBack', () => {
    const onBack = vi.fn();
    render(<Component campaignName="my-campaign" isLocalhost={true} onBack={onBack} />);
    expect(screen.getByTestId(`${prefix}-campaign`)).toHaveTextContent('my-campaign');
    expect(screen.getByTestId(`${prefix}-localhost`)).toHaveTextContent('true');
    fireEvent.click(screen.getByTestId(`${prefix}-back-btn`));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MockNPCs', () => {
  it('echoes campaign, char count, and back fires onBack', () => {
    const onBack = vi.fn();
    render(<MockNPCs campaignName="my-campaign" characters={['c1', 'c2']} onBack={onBack} />);
    expect(screen.getByTestId('npcs-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('npcs-char-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId('npcs-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MockSettlements', () => {
  it('echoes campaign and back fires onBack', () => {
    const onBack = vi.fn();
    render(<MockSettlements campaignName="my-campaign" onBack={onBack} />);
    expect(screen.getByTestId('settlements-campaign')).toHaveTextContent('my-campaign');
    fireEvent.click(screen.getByTestId('settlements-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('MockLog', () => {
  it.each([
    ['0', []],
    ['3', ['c1', 'c2', 'c3']],
  ])('renders the campaign name and character count %s', (expectedCount, characters) => {
    render(<MockLog campaignName="my-campaign" characters={characters} />);
    expect(screen.getByTestId('log-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('log-char-count')).toHaveTextContent(expectedCount);
  });
});

describe('MockCampaignAdmin', () => {
  it('echoes campaign name and theme', () => {
    render(<MockCampaignAdmin campaignName="my-campaign" theme="dark" onBack={vi.fn()} />);
    expect(screen.getByTestId('admin-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('admin-theme')).toHaveTextContent('dark');
  });

  const ADMIN_BUTTONS = [
    ['admin-back-btn', 'onBack'],
    ['admin-toggle-theme-btn', 'toggleTheme'],
    ['admin-rename-btn', 'onRenameCampaign'],
    ['admin-delete-btn', 'onDeleteCampaign'],
  ];

  it.each(ADMIN_BUTTONS)(
    'clicking %s fires %s and no other admin callback',
    (testid, prop) => {
      const handlers = {
        onBack: vi.fn(),
        toggleTheme: vi.fn(),
        onRenameCampaign: vi.fn(),
        onDeleteCampaign: vi.fn(),
      };
      render(<MockCampaignAdmin campaignName="test" theme="light" {...handlers} />);
      fireEvent.click(screen.getByTestId(testid));
      expect(handlers[prop]).toHaveBeenCalledTimes(1);
      Object.entries(handlers)
        .filter(([key]) => key !== prop)
        .forEach(([, otherCb]) => expect(otherCb).not.toHaveBeenCalled());
    },
  );
});
