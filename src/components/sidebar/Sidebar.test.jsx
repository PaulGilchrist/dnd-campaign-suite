// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

const LOCALHOST_ONLY_BUTTONS = ['Encounters', 'Factions', 'NPCs', 'Quests', 'Sessions', 'Settlements', 'Admin'];
const ALWAYS_VISIBLE_BUTTONS = ['Campaigns', 'Add Character', 'Initiative', 'Log', 'Notes', 'Rules'];

const RULES_URL = 'https://paulgilchrist.github.io/dnd-tools/rules/general';

function createProps(overrides = {}) {
  return {
    campaignName: 'Test Campaign',
    characters: [],
    activeCharacter: null,
    isLocalhost: true,
    onBackToCampaigns: vi.fn(),
    onAddCharacter: vi.fn(),
    onCharacterClick: vi.fn(),
    onInitiativeClick: vi.fn(),
    onEncounterClick: vi.fn(),
    onFactionsClick: vi.fn(),
    onMapsClick: vi.fn(),
    onNotesClick: vi.fn(),
    onQuestsClick: vi.fn(),
    onNPCsClick: vi.fn(),
    onSessionsClick: vi.fn(),
    onSettlementsClick: vi.fn(),
    onLogClick: vi.fn(),
    onRepairClick: vi.fn(),
    ...overrides,
  };
}

function renderSidebar(overrides = {}) {
  const props = createProps(overrides);
  return { props, ...render(<Sidebar {...props} />) };
}

describe('Sidebar', () => {
  describe('rendering', () => {
    it.each(['Test Campaign', 'My Adventure'])('displays the campaign name: %s', (name) => {
      renderSidebar({ campaignName: name });
      expect(screen.getByText(name)).toBeInTheDocument();
    });

    it('renders an empty campaign name when provided', () => {
      const { container } = renderSidebar({ campaignName: '' });
      expect(container.querySelector('.campaign-name').textContent).toBe('');
    });

    it('renders Maps on localhost and Map on non-localhost', () => {
      const { rerender } = renderSidebar({ isLocalhost: true });
      expect(screen.getByRole('button', { name: 'Maps' })).toBeInTheDocument();

      rerender(<Sidebar {...createProps({ isLocalhost: false })} />);
      expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
    });

    it.each(LOCALHOST_ONLY_BUTTONS)('renders the %s button on localhost', (label) => {
      renderSidebar({ isLocalhost: true });
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    it.each(LOCALHOST_ONLY_BUTTONS)('does not render the %s button on non-localhost', (label) => {
      renderSidebar({ isLocalhost: false });
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    });

    it.each(ALWAYS_VISIBLE_BUTTONS)('renders the %s button regardless of localhost', (label) => {
      renderSidebar({ isLocalhost: false });
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    it('renders a character button for each character', () => {
      renderSidebar({ characters: [{ name: 'Aragorn' }, { name: 'Legolas' }] });
      expect(screen.getByRole('button', { name: 'Aragorn' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Legolas' })).toBeInTheDocument();
    });

    it('renders the characters header but no character buttons when the list is empty', () => {
      renderSidebar({ characters: [] });
      expect(screen.getByText('Characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Character' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aragorn' })).not.toBeInTheDocument();
    });
  });

  describe('event handlers', () => {
    it.each([
      ['onBackToCampaigns', 'Campaigns'],
      ['onAddCharacter', 'Add Character'],
      ['onInitiativeClick', 'Initiative'],
      ['onLogClick', 'Log'],
      ['onNotesClick', 'Notes'],
    ])('calls %s when the %s button is clicked', (handler, label) => {
      const { props } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props[handler]).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['onEncounterClick', 'Encounters'],
      ['onFactionsClick', 'Factions'],
      ['onNPCsClick', 'NPCs'],
      ['onQuestsClick', 'Quests'],
      ['onSessionsClick', 'Sessions'],
      ['onSettlementsClick', 'Settlements'],
    ])('calls %s when the %s button is clicked on localhost', (handler, label) => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props[handler]).toHaveBeenCalledTimes(1);
    });

    it('calls onRepairClick when the Admin button is clicked on localhost', () => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
      expect(props.onRepairClick).toHaveBeenCalledTimes(1);
    });

    it('calls onMapsClick when Map/Maps is clicked', () => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: 'Maps' }));
      expect(props.onMapsClick).toHaveBeenCalledTimes(1);

      const { props: props2 } = renderSidebar({ isLocalhost: false });
      fireEvent.click(screen.getByRole('button', { name: 'Map' }));
      expect(props2.onMapsClick).toHaveBeenCalledTimes(1);
    });

    it('opens the rules URL in a new tab when the Rules button is clicked', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
      expect(openSpy).toHaveBeenCalledWith(RULES_URL, '_blank');
    });
  });

  describe('active view highlighting', () => {
    it('highlights the active character when charSheet is active', () => {
      renderSidebar({
        characters: [{ name: 'Aragorn' }, { name: 'Legolas' }],
        activeCharacter: { name: 'Legolas' },
        activeView: 'charSheet',
      });
      expect(screen.getByRole('button', { name: 'Legolas' })).toHaveClass('active');
      expect(screen.getByRole('button', { name: 'Aragorn' })).not.toHaveClass('active');
    });

    it.each([
      ['Encounters', 'encounter'],
      ['Factions', 'factions'],
      ['Initiative', 'initiative'],
      ['Log', 'campaignLog'],
      ['Maps', 'mapsManager'],
      ['NPCs', 'npcs'],
      ['Notes', 'notes'],
      ['Quests', 'quests'],
      ['Sessions', 'sessions'],
      ['Settlements', 'settlements'],
      ['Admin', 'campaignRepair'],
    ])('highlights the %s button when activeView is %s', (label, activeView) => {
      renderSidebar({ isLocalhost: true, activeView });
      expect(screen.getByRole('button', { name: label })).toHaveClass('active');
    });
  });

  describe('active view indicator', () => {
    it.each([
      ['Initiative', 'initiative'],
      ['Character', 'charSheet'],
      ['Frodo', { view: 'charSheet', character: { name: 'Frodo' } }],
    ])('shows "%s" in the indicator when activeView is %s', (expected, input) => {
      const { container } = renderSidebar(
        typeof input === 'object'
          ? { activeView: input.view, activeCharacter: input.character }
          : { activeView: input }
      );
      expect(container.querySelector('.sidebar-active-indicator')).toHaveTextContent(expected);
    });

    it('renders an empty indicator for an unknown active view', () => {
      const { container } = renderSidebar({ activeView: 'unknown' });
      const indicator = container.querySelector('.sidebar-active-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.textContent.trim()).toBe('');
    });

    it('does not render the indicator when activeView is null', () => {
      const { container } = renderSidebar({ activeView: null });
      expect(container.querySelector('.sidebar-active-indicator')).not.toBeInTheDocument();
    });
  });

  describe('characters section', () => {
    it('calls onCharacterClick with the clicked character object', () => {
      const { props } = renderSidebar({
        characters: [{ name: 'Gandalf' }, { name: 'Saruman' }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Saruman' }));
      expect(props.onCharacterClick).toHaveBeenCalledTimes(1);
      expect(props.onCharacterClick).toHaveBeenCalledWith({ name: 'Saruman' });
    });
  });

  describe('navigation order', () => {
    it('renders nav buttons in alphabetical order by label', () => {
      const { container } = renderSidebar({ isLocalhost: true });
      const navButtons = [...container.querySelectorAll('nav > button.sidebar-section-header')];
      const labels = navButtons.map(b => b.textContent.trim().replace(/\s+/g, ' '));
      expect(labels).toEqual([
        'Campaigns',
        'Encounters', 'Factions', 'Initiative', 'Inventory', 'Log', 'Maps', 'Notes',
        'NPCs', 'Quests', 'Rules', 'Sessions', 'Settlements',
      ]);
    });
  });
});
