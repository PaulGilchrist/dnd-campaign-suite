// @maintained-by-ai 2026-11-27
/**
 * Contract tests for src/test/mockComponents.jsx.
 *
 * The 21 App.*.test.jsx suites replace real components with these mocks via
 * vi.mock(), then drive the app by clicking mock testids and reading
 * rendered text. These tests pin that contract at the mock level so a mock
 * edit fails HERE — locally and with a clear name — instead of surfacing as
 * a confusing navigation failure inside an app suite:
 *   - every root testid a consuming suite queries is rendered, even when
 *     App omits every prop
 *   - every element testid/label a consuming suite actually queries is
 *     rendered with the right payload (echo testids no consumer reads are
 *     NOT pinned — the consumers are the real tests of those)
 *   - every callback fires with the exact payload consumers depend on, and
 *     fires ONLY its own callback (wiring isolation), exactly once
 *
 * These tests describe the MOCKS, not production components — green here
 * makes no claim about real component behaviour. Subscriber event feeders
 * and SavePromptModal triggers are deliberately NOT hosted here: each lane
 * mocks Subscriber inline.
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
  MockMusicPlayer,
  MockCampaignAdmin,
  musicPlayerLifecycle,
} from './mockComponents';
import { mockState } from './appTestState.js';

// Root testids each App.* suite queries to prove which view is mounted.
// Also proves no mock crashes when App renders it with zero props. The
// plain view outlets (Notes…Factions) render nothing else any consumer
// queries, so this table is their entire contract.
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
  ['MockMusicPlayer', MockMusicPlayer, 'music-player'],
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

  // No testid — App.campaign-switch-wizards clicks it by visible label, so
  // the label text is part of the contract.
  it('Edit button fires onEditCharacter exactly once', () => {
    const cb = vi.fn();
    render(<MockCharSheet onEditCharacter={cb} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// App.map-activate and App.map-deactivated-advisory read init-map-name to
// prove the active map name reaches the Initiative view.
describe('MockInitiative', () => {
  it('renders the mapName seam, empty when App omits it', () => {
    const { rerender } = render(<MockInitiative campaignName="t" characters={[]} />);
    expect(screen.getByTestId('init-map-name')).toBeEmptyDOMElement();
    rerender(<MockInitiative campaignName="t" characters={[]} mapName="dungeon-1" />);
    expect(screen.getByTestId('init-map-name')).toHaveTextContent('dungeon-1');
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

  // Mixed matrix pins that each seam reads its OWN prop (a swap of
  // characterData/isEditing would otherwise pass single-prop tests).
  it.each([
    ['both set', { name: 'EditMe' }, true, 'EditMe', true],
    ['neither set', undefined, undefined, null, false],
    ['only characterData', { name: 'EditMe' }, false, 'EditMe', false],
    ['only isEditing', null, true, null, true],
  ])(
    'editing-character and editing-mode render independently (%s)',
    (_label, characterData, isEditing, expectedName, expectedMode) => {
      render(<MockWizard characterData={characterData} isEditing={isEditing} />);
      if (expectedName) {
        expect(screen.getByTestId('editing-character')).toHaveTextContent(expectedName);
      } else {
        expect(screen.queryByTestId('editing-character')).toBeNull();
      }
      if (expectedMode) {
        expect(screen.getByTestId('editing-mode')).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId('editing-mode')).toBeNull();
      }
    },
  );
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
  ['log-btn', 'onLogClick'],
  ['music-btn', 'onMusicClick'],
];

function allSidebarHandlers() {
  const handlers = {};
  SIDEBAR_NAV_BUTTONS.forEach(([, prop]) => {
    handlers[prop] = vi.fn();
  });
  return handlers;
}

describe('MockSidebar', () => {
  it('renders the campaign name App.state-transitions asserts', () => {
    render(<MockSidebar campaignName="my-campaign" />);
    expect(screen.getByTestId('sidebar-campaign')).toHaveTextContent('my-campaign');
  });

  // Mirrors MOCK_VIEW_LABELS in mockComponents.jsx. App.state-transitions
  // and App.map-navigation assert these exact strings via
  // sidebar-active-indicator. '' rows assert the indicator renders EMPTY
  // (toHaveTextContent('') would pass trivially).
  const ACTIVE_VIEW_CASES = [
    ['encounter', 'Encounters', {}],
    ['factions', 'Factions', {}],
    ['initiative', 'Initiative', {}],
    ['mapsManager', 'Maps', {}],
    ['notes', 'Notes', {}],
    ['quests', 'Quests', {}],
    ['npcs', 'NPCs', {}],
    ['settlements', 'Settlements', {}],
    ['campaignLog', 'Log', {}],
    ['music', 'Music', {}],
    ['unknownView', '', {}], // unknown views get an empty label, not a crash
    ['charSheet', 'Hero', { activeCharacter: { name: 'Hero' } }],
    ['charSheet', 'Character', {}], // no active character → generic label
  ];

  it.each(ACTIVE_VIEW_CASES)(
    'active indicator for the %s view shows "%s"',
    (activeView, expected, extraProps) => {
      render(<MockSidebar campaignName="test" activeView={activeView} {...extraProps} />);
      const indicator = screen.getByTestId('sidebar-active-indicator');
      if (expected === '') {
        expect(indicator).toBeEmptyDOMElement();
      } else {
        expect(indicator).toHaveTextContent(expected);
      }
    },
  );

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
  it('echoes the campaign and fires onOpenMap with the fixed "dungeon-1" id + row display name exactly once', () => {
    const onOpenMap = vi.fn();
    render(<MockMapsManager campaignName="my-campaign" onOpenMap={onOpenMap} />);
    expect(screen.getByTestId('mm-campaign')).toHaveTextContent('my-campaign');
    fireEvent.click(screen.getByTestId('open-map-btn'));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
    expect(onOpenMap).toHaveBeenCalledWith('dungeon-1', 'Dungeon 1');
  });

  // App.map-activate and App.state-transitions click delete-map-btn; the
  // handler is optional, so the button must never crash without it.
  it.each([
    ['provided', () => {
      const onMapDeleted = vi.fn();
      render(<MockMapsManager campaignName="t" onOpenMap={vi.fn()} onMapDeleted={onMapDeleted} />);
      fireEvent.click(screen.getByTestId('delete-map-btn'));
      expect(onMapDeleted).toHaveBeenCalledWith('dungeon-1');
    }],
    ['omitted', () => {
      render(<MockMapsManager campaignName="t" onOpenMap={vi.fn()} />);
      expect(() => fireEvent.click(screen.getByTestId('delete-map-btn'))).not.toThrow();
    }],
  ])('delete-map-btn is correct when onMapDeleted is %s', (_label, run) => run());
});

describe('MockMap', () => {
  it('echoes the map name and display name App.map-navigation asserts', () => {
    render(<MockMap mapName="dungeon-1" mapDisplayName="Dungeon 1" campaignName="t" onBack={vi.fn()} />);
    expect(screen.getByTestId('map-name')).toHaveTextContent('dungeon-1');
    expect(screen.getByTestId('map-display-name')).toHaveTextContent('Dungeon 1');
  });

  // App.map-navigation drives the dynamic Back label through this seam:
  // displayName preferred, then mapName, then empty with no target.
  it('map-back-target prefers displayName, falls back to mapName, empty without a target', () => {
    const { rerender } = render(
      <MockMap mapName="m" campaignName="t" onBack={vi.fn()} />,
    );
    expect(screen.getByTestId('map-back-target')).toBeEmptyDOMElement();
    rerender(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} backMapTarget={{ mapName: 'base' }} />);
    expect(screen.getByTestId('map-back-target')).toHaveTextContent('base');
    rerender(
      <MockMap
        mapName="m"
        campaignName="t"
        onBack={vi.fn()}
        backMapTarget={{ mapName: 'base', mapDisplayName: 'Base Camp' }}
      />,
    );
    expect(screen.getByTestId('map-back-target')).toHaveTextContent('Base Camp');
  });

  // App.map-deactivated-advisory branches on this echoed flag.
  it('map-is-active echoes the prop, defaulting to "true"', () => {
    const { rerender } = render(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} />);
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('true');
    rerender(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} mapIsActive={false} />);
    expect(screen.getByTestId('map-is-active')).toHaveTextContent('false');
  });

  // The advisory's jump button exists only while App passes the handler.
  it('map-view-new-btn renders iff onViewNewMap is provided, firing it exactly once', () => {
    const onViewNewMap = vi.fn();
    const { rerender } = render(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} />);
    expect(screen.queryByTestId('map-view-new-btn')).toBeNull();
    rerender(<MockMap mapName="m" campaignName="t" onBack={vi.fn()} onViewNewMap={onViewNewMap} />);
    fireEvent.click(screen.getByTestId('map-view-new-btn'));
    expect(onViewNewMap).toHaveBeenCalledTimes(1);
  });

  it('back button fires onBack exactly once', () => {
    const onBack = vi.fn();
    render(<MockMap mapName="m" campaignName="t" onBack={onBack} />);
    fireEvent.click(screen.getByTestId('map-back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // App.map-navigation drives the POI stack through this fixed id; the
  // handler is optional, so the button must never crash without it.
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

// App.state-transitions asserts the player stays mounted (mounts===1) while
// visible flips across navigation. Counters are module state — assert
// DELTAS so test order inside this file cannot matter.
describe('MockMusicPlayer', () => {
  it('echoes campaign and mirrors visible as a data attribute', () => {
    render(<MockMusicPlayer campaignName="my-campaign" visible={false} />);
    expect(screen.getByTestId('music-player')).toHaveAttribute('data-visible', 'false');
    expect(screen.getByTestId('music-campaign')).toHaveTextContent('my-campaign');
  });

  it('mounts and unmounts exactly once per lifecycle', () => {
    const before = { ...musicPlayerLifecycle };
    const view = render(<MockMusicPlayer visible />);
    expect(musicPlayerLifecycle.mounts - before.mounts).toBe(1);
    expect(musicPlayerLifecycle.unmounts - before.unmounts).toBe(0);
    view.unmount();
    expect(musicPlayerLifecycle.unmounts - before.unmounts).toBe(1);
  });

  it('does not remount when visible flips', () => {
    const before = { ...musicPlayerLifecycle };
    const { rerender } = render(<MockMusicPlayer visible={false} />);
    rerender(<MockMusicPlayer visible />);
    expect(musicPlayerLifecycle.mounts - before.mounts).toBe(1);
    expect(musicPlayerLifecycle.unmounts - before.unmounts).toBe(0);
    expect(screen.getByTestId('music-player')).toHaveAttribute('data-visible', 'true');
  });
});

describe('MockCampaignAdmin', () => {
  // App.state-transitions asserts the theme cycle through admin-theme.
  it('echoes campaign name and theme', () => {
    render(<MockCampaignAdmin campaignName="my-campaign" theme="dark" />);
    expect(screen.getByTestId('admin-campaign')).toHaveTextContent('my-campaign');
    expect(screen.getByTestId('admin-theme')).toHaveTextContent('dark');
  });

  const ADMIN_BUTTONS = [
    ['admin-toggle-theme-btn', 'toggleTheme'],
    ['admin-rename-btn', 'onRenameCampaign'],
    ['admin-delete-btn', 'onDeleteCampaign'],
  ];

  it.each(ADMIN_BUTTONS)(
    'clicking %s fires %s and no other admin callback',
    (testid, prop) => {
      const handlers = {
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
