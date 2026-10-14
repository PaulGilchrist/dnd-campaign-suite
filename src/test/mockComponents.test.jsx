
import { describe, it, expect, vi } from 'vitest';
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
  MockNPCs,
  MockLog,
  MockCampaignAdmin,
} from './mockComponents';
import { mockState } from './appTestState.js';

describe('mockComponents', () => {
  describe('MockCharSheet', () => {
    it('renders character name from playerSummary or "no character" when missing', () => {
      render(<MockCharSheet playerSummary={{ name: 'TestChar' }} />);
      expect(screen.getByTestId('character-name')).toHaveTextContent('TestChar');
    });

    it.each([
      ['missing', undefined],
      ['has no name', {}],
    ])('renders "no character" when playerSummary is %s', (_label, playerSummary) => {
      render(<MockCharSheet playerSummary={playerSummary} />);
      expect(screen.getByTestId('character-name')).toHaveTextContent('no character');
    });

    it.each([
      ['with character', { name: 'TestChar' }, 'TestChar'],
      ['without character', {}, undefined],
    ])('calls onDeleteCharacter with %s when delete is clicked', (_label, playerSummary, expectedArg) => {
      const onDelete = vi.fn();
      render(<MockCharSheet playerSummary={playerSummary} onDeleteCharacter={onDelete} />);
      fireEvent.click(screen.getByTitle('Delete Character'));
      expect(onDelete).toHaveBeenCalledWith(expectedArg);
    });

    it.each([
      ['Upload', 'onUploadClick'],
      ['Download', 'onSaveClick'],
      ['Edit', 'onEditCharacter'],
    ])('invokes the %s callback when the %s button is clicked', (key, propName) => {
      const cb = vi.fn();
      render(<MockCharSheet {...{ [propName]: cb }} />);
      fireEvent.click(screen.getByText(key));
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('MockInitiative', () => {
    it('renders the character count and campaign name', () => {
      render(<MockInitiative characters={['a', 'b', 'c']} campaignName="my-campaign" />);
      expect(screen.getByTestId('init-char-count')).toHaveTextContent('3');
      expect(screen.getByTestId('init-campaign')).toHaveTextContent('my-campaign');
    });

    it.each([
      ['undefined', undefined, '0'],
      ['empty array', [], '0'],
    ])('renders %s character count when characters is %s', (_label, characters, expected) => {
      render(<MockInitiative characters={characters} campaignName="test" />);
      expect(screen.getByTestId('init-char-count')).toHaveTextContent(expected);
    });
  });

  describe('MockCampaignSelection', () => {
    it.each([
      ['with characters', 'test-campaign', ['char1', 'char2']],
      ['without characters', 'empty-campaign', []],
    ])('calls onCampaignSelect with %s when selected', (_label, campaignName, characters) => {
      mockState.campaignName = campaignName;
      mockState.characters = characters;
      const onSelect = vi.fn();
      render(<MockCampaignSelection onCampaignSelect={onSelect} />);
      fireEvent.click(screen.getByTestId('select-campaign-btn'));
      expect(onSelect).toHaveBeenCalledWith(campaignName, characters);
    });
  });

  describe('MockWizard', () => {
    it('calls onComplete with default data when complete is clicked', () => {
      const onComplete = vi.fn();
      render(<MockWizard onComplete={onComplete} onCancel={vi.fn()} />);
      fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      expect(onComplete).toHaveBeenCalledWith({ name: 'New Character', level: 1 });
    });

    it('calls onCancel when cancel is clicked', () => {
      const onCancel = vi.fn();
      render(<MockWizard onComplete={vi.fn()} onCancel={onCancel} />);
      fireEvent.click(screen.getByTestId('wizard-cancel-btn'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['renders editing character name', { name: 'EditMe' }, 'EditMe'],
      ['does not render editing character', null, null],
      ['does not render editing character', undefined, null],
    ])('when characterData is %s, editing indicator shows %s', (_label, characterData, expected) => {
      render(<MockWizard characterData={characterData} />);
      if (expected) {
        expect(screen.getByTestId('editing-character')).toHaveTextContent(expected);
      } else {
        expect(screen.queryByTestId('editing-character')).toBeNull();
      }
    });

    it.each([
      ['true', 'Editing Mode'],
      ['false', null],
    ])('editing mode indicator %s when isEditing is %s', (_label, expected) => {
      render(<MockWizard isEditing={expected === 'Editing Mode'} />);
      if (expected) {
        expect(screen.getByTestId('editing-mode')).toHaveTextContent(expected);
      } else {
        expect(screen.queryByTestId('editing-mode')).toBeNull();
      }
    });

    it('renders both editing character and mode when both props are provided', () => {
      render(<MockWizard characterData={{ name: 'EditMe' }} isEditing={true} />);
      expect(screen.getByTestId('editing-character')).toHaveTextContent('EditMe');
      expect(screen.getByTestId('editing-mode')).toHaveTextContent('Editing Mode');
    });

    it('calls onComplete with default data even when editing an existing character', () => {
      const onComplete = vi.fn();
      render(<MockWizard onComplete={onComplete} characterData={{ name: 'EditMe' }} />);
      fireEvent.click(screen.getByTestId('wizard-complete-btn'));
      expect(onComplete).toHaveBeenCalledWith({ name: 'New Character', level: 1 });
    });
  });

  describe('MockSidebar', () => {
    it('renders the campaign name', () => {
      render(<MockSidebar campaignName="my-campaign" />);
      expect(screen.getByTestId('sidebar-campaign')).toHaveTextContent('my-campaign');
    });

    it.each([
      ['true', 'true'],
      ['false', 'false'],
    ])('renders the isLocalhost prop value as string when it is %s', (expected, isLocalhost) => {
      render(<MockSidebar campaignName="test" isLocalhost={isLocalhost} />);
      expect(screen.getByTestId('sidebar-localhost')).toHaveTextContent(expected);
    });

    it('renders an active indicator when activeView is provided', () => {
      render(<MockSidebar activeView="charSheet" campaignName="test" />);
      expect(screen.getByTestId('sidebar-active-indicator')).toBeInTheDocument();
    });

    it.each([
      ['Hero', 'charSheet', { name: 'Hero' }],
      ['Encounters', 'encounter', undefined],
      ['Factions', 'factions', undefined],
      ['Initiative', 'initiative', undefined],
      ['Maps', 'mapsManager', undefined],
      ['Notes', 'notes', undefined],
      ['Quests', 'quests', undefined],
      ['NPCs', 'npcs', undefined],
      ['Settlements', 'settlements', undefined],
      ['Log', 'campaignLog', undefined],
      ['', 'unknownView', undefined],
    ])('shows "%s" in the active indicator for the %s view', (expected, activeView, activeCharacter) => {
      const props = { campaignName: 'test', activeView };
      if (activeCharacter) props.activeCharacter = activeCharacter;
      render(<MockSidebar {...props} />);
      expect(screen.getByTestId('sidebar-active-indicator')).toHaveTextContent(expected);
    });

    it('does not render an active indicator when activeView is not provided', () => {
      render(<MockSidebar campaignName="test" />);
      expect(screen.queryByTestId('sidebar-active-indicator')).toBeNull();
    });

    it.each([
      ['back', 'back-to-campaigns-btn', 'onBackToCampaigns'],
      ['add character', 'add-character-btn', 'onAddCharacter'],
      ['initiative', 'initiative-btn', 'onInitiativeClick'],
    ])('calls %s when the %s button is clicked', (_label, testid, _cbName) => {
      const cb = vi.fn();
      render(<MockSidebar campaignName="test" onBackToCampaigns={cb} onAddCharacter={cb} onInitiativeClick={cb} />);
      fireEvent.click(screen.getByTestId(testid));
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('renders character buttons and invokes onCharacterClick with the character', () => {
      const onClick = vi.fn();
      render(<MockSidebar campaignName="test" characters={[{ name: 'Char1' }, { name: 'Char2' }]} onCharacterClick={onClick} />);
      expect(screen.getByTestId('char-btn-Char1')).toHaveTextContent('Char1');
      expect(screen.getByTestId('char-btn-Char2')).toHaveTextContent('Char2');
      fireEvent.click(screen.getByTestId('char-btn-Char1'));
      expect(onClick).toHaveBeenCalledWith({ name: 'Char1' });
    });

    it('applies active class to the active character button but not inactive ones', () => {
      render(<MockSidebar campaignName="test" characters={[{ name: 'ActiveChar' }, { name: 'InactiveChar' }]} activeView="charSheet" activeCharacter={{ name: 'ActiveChar' }} onCharacterClick={vi.fn()} />);
      expect(screen.getByTestId('char-btn-ActiveChar')).toHaveClass('active');
      expect(screen.getByTestId('char-btn-InactiveChar')).not.toHaveClass('active');
    });

    it('does not render character buttons when characters is undefined', () => {
      render(<MockSidebar campaignName="test" onCharacterClick={vi.fn()} />);
      expect(screen.queryByTestId('char-btn-Char1')).toBeNull();
    });

    it.each([
      ['Maps', true],
      ['Map', false],
    ])('renders the maps button as "%s" on %s-localhost', (label, isLocalhost) => {
      render(<MockSidebar campaignName="test" isLocalhost={isLocalhost} onMapsClick={vi.fn()} />);
      expect(screen.getByTestId('maps-btn')).toHaveTextContent(label);
    });

    it('renders all navigation buttons', () => {
      render(<MockSidebar campaignName="test" isLocalhost={true}
        onNotesClick={vi.fn()} onEncounterClick={vi.fn()} onFactionsClick={vi.fn()}
        onNPCsClick={vi.fn()} onQuestsClick={vi.fn()} onSettlementsClick={vi.fn()} onLogClick={vi.fn()}
      />);
      expect(screen.getByTestId('notes-btn')).toBeInTheDocument();
      expect(screen.getByTestId('encounter-btn')).toBeInTheDocument();
      expect(screen.getByTestId('factions-btn')).toBeInTheDocument();
      expect(screen.getByTestId('npcs-btn')).toBeInTheDocument();
      expect(screen.getByTestId('quests-btn')).toBeInTheDocument();
      expect(screen.getByTestId('settlements-btn')).toBeInTheDocument();
      expect(screen.getByTestId('log-btn')).toBeInTheDocument();
    });

    it.each([
      ['renders admin button', true],
      ['does not render admin button', false],
    ])('admin button %s on localhost', (_label, isLocalhost) => {
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

    it('invokes all navigation callbacks when their buttons are clicked', () => {
      const callbacks = {
        onNotesClick: vi.fn(),
        onEncounterClick: vi.fn(),
        onFactionsClick: vi.fn(),
        onNPCsClick: vi.fn(),
        onQuestsClick: vi.fn(),
        onSettlementsClick: vi.fn(),
        onLogClick: vi.fn(),
      };
      render(<MockSidebar campaignName="test" isLocalhost={true} {...callbacks} />);
      fireEvent.click(screen.getByTestId('notes-btn'));
      fireEvent.click(screen.getByTestId('encounter-btn'));
      fireEvent.click(screen.getByTestId('factions-btn'));
      fireEvent.click(screen.getByTestId('npcs-btn'));
      fireEvent.click(screen.getByTestId('quests-btn'));
      fireEvent.click(screen.getByTestId('settlements-btn'));
      fireEvent.click(screen.getByTestId('log-btn'));
      Object.values(callbacks).forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('MockMapsManager', () => {
    it('renders the campaign name', () => {
      render(<MockMapsManager campaignName="my-campaign" onOpenMap={vi.fn()} onBack={vi.fn()} />);
      expect(screen.getByTestId('mm-campaign')).toHaveTextContent('my-campaign');
    });

    it('calls onOpenMap with "dungeon-1" when open map button is clicked', () => {
      const onOpenMap = vi.fn();
      render(<MockMapsManager campaignName="test" onOpenMap={onOpenMap} onBack={vi.fn()} />);
      fireEvent.click(screen.getByTestId('open-map-btn'));
      expect(onOpenMap).toHaveBeenCalledWith('dungeon-1');
    });
  });

  describe('MockMap', () => {
    it.each([
      ['map name', 'map-name', 'dungeon-1'],
      ['campaign name', 'map-campaign', 'my-campaign'],
    ])('renders the %s', (_label, testid, expected) => {
      const props = _label === 'map name' ? { mapName: expected, campaignName: 'test' } : { mapName: 'm', campaignName: expected };
      render(<MockMap {...props} onBack={vi.fn()} />);
      expect(screen.getByTestId(testid)).toHaveTextContent(expected);
    });

    it.each([
      ['characters', 'map-char-count', ['a', 'b'], '2'],
      ['characters empty', 'map-char-count', [], '0'],
      ['characters undefined', 'map-char-count', undefined, '0'],
      ['npcs', 'map-npc-count', ['n1', 'n2'], '2'],
      ['npcs empty', 'map-npc-count', [], '0'],
      ['npcs undefined', 'map-npc-count', undefined, '0'],
    ])('renders the %s count correctly', (_label, testid, data, expected) => {
      const props = { mapName: 'm', campaignName: 't', onBack: vi.fn() };
      if (_label.startsWith('characters')) props.characters = data;
      else props.npcs = data;
      render(<MockMap {...props} />);
      expect(screen.getByTestId(testid)).toHaveTextContent(expected);
    });

    it.each([
      ['true', 'true'],
      ['false', 'false'],
    ])('renders the isLocalhost prop value as string when it is %s', (expected, isLocalhost) => {
      render(<MockMap mapName="m" campaignName="t" isLocalhost={isLocalhost} onBack={vi.fn()} />);
      expect(screen.getByTestId('map-localhost')).toHaveTextContent(expected);
    });

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn();
      render(<MockMap mapName="m" campaignName="t" onBack={onBack} />);
      fireEvent.click(screen.getByTestId('map-back-btn'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('MockEncounterBuilder', () => {
    it.each([
      ['characters', 'eb-char-count', ['c1', 'c2', 'c3'], '3'],
      ['characters empty', 'eb-char-count', [], '0'],
      ['characters undefined', 'eb-char-count', undefined, '0'],
      ['campaign name', 'eb-campaign', 'my-campaign', 'my-campaign'],
    ])('renders the %s correctly', (_label, testid, data, expected) => {
      const props = { campaignName: 'test' };
      if (_label.includes('characters')) {
        props.characters = data;
      } else {
        props.campaignName = expected;
      }
      render(<MockEncounterBuilder {...props} />);
      expect(screen.getByTestId(testid)).toHaveTextContent(expected);
    });
  });

  describe('MockNPCs', () => {
    it('renders the campaign name', () => {
      render(<MockNPCs campaignName="my-campaign" onBack={vi.fn()} />);
      expect(screen.getByTestId('npcs-campaign')).toHaveTextContent('my-campaign');
    });

    it.each([
      ['characters', 'npcs-char-count', ['c1', 'c2'], '2'],
      ['characters empty', 'npcs-char-count', [], '0'],
      ['characters undefined', 'npcs-char-count', undefined, '0'],
    ])('renders the %s count correctly', (_label, testid, data, expected) => {
      render(<MockNPCs campaignName="test" characters={data} onBack={vi.fn()} />);
      expect(screen.getByTestId(testid)).toHaveTextContent(expected);
    });
  });

  describe('MockLog', () => {
    it('renders the campaign name', () => {
      render(<MockLog campaignName="my-campaign" characters={[]} />);
      expect(screen.getByTestId('log-campaign')).toHaveTextContent('my-campaign');
    });

    it.each([
      ['characters', 'log-char-count', ['c1', 'c2', 'c3'], '3'],
      ['characters empty', 'log-char-count', [], '0'],
      ['characters undefined', 'log-char-count', undefined, '0'],
    ])('renders the %s count correctly', (_label, testid, data, expected) => {
      render(<MockLog campaignName="test" characters={data} />);
      expect(screen.getByTestId(testid)).toHaveTextContent(expected);
    });
  });

  describe('MockCampaignAdmin', () => {
    it('renders the campaign name and theme', () => {
      render(<MockCampaignAdmin campaignName="my-campaign" theme="light" onBack={vi.fn()} />);
      expect(screen.getByTestId('admin-campaign')).toHaveTextContent('my-campaign');
      expect(screen.getByTestId('admin-theme')).toHaveTextContent('light');
    });

    it.each(['dark', 'light'])('renders the theme value "%s"', (theme) => {
      render(<MockCampaignAdmin campaignName="test" theme={theme} onBack={vi.fn()} />);
      expect(screen.getByTestId('admin-theme')).toHaveTextContent(theme);
    });

    it.each([
      ['back', 'admin-back-btn', 'onBack'],
      ['toggle theme', 'admin-toggle-theme-btn', 'toggleTheme'],
      ['rename', 'admin-rename-btn', 'onRenameCampaign'],
      ['delete', 'admin-delete-btn', 'onDeleteCampaign'],
    ])('calls the %s callback when the %s button is clicked', (_label, testid, cbName) => {
      const cb = vi.fn();
      const props = { onBack: vi.fn(), toggleTheme: vi.fn(), onRenameCampaign: vi.fn(), onDeleteCampaign: vi.fn() };
      props[cbName] = cb;
      render(<MockCampaignAdmin campaignName="test" theme="light" {...props} />);
      fireEvent.click(screen.getByTestId(testid));
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
