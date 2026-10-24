// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

// Mirrors Sidebar.jsx NAV_ITEMS + localhost-only Admin footer.
// Single table drives visibility, click, and active-highlight contracts.
const NAV_BUTTONS = [
  { label: 'Encounters', view: 'encounter', handler: 'onEncounterClick', localhostOnly: true },
  { label: 'Factions', view: 'factions', handler: 'onFactionsClick', localhostOnly: true },
  { label: 'Initiative', view: 'initiative', handler: 'onInitiativeClick' },
  { label: 'Inventory', view: 'partyInventory', handler: 'onInventoryClick' },
  { label: 'Log', view: 'campaignLog', handler: 'onLogClick' },
  { label: 'Maps', view: 'mapsManager', handler: 'onMapsClick', playerLabel: 'Map' },
  { label: 'Notes', view: 'notes', handler: 'onNotesClick' },
  { label: 'NPCs', view: 'npcs', handler: 'onNPCsClick', localhostOnly: true },
  { label: 'Quests', view: 'quests', handler: 'onQuestsClick', localhostOnly: true },
  { label: 'Sessions', view: 'sessions', handler: 'onSessionsClick', localhostOnly: true },
  { label: 'Settlements', view: 'settlements', handler: 'onSettlementsClick', localhostOnly: true },
  { label: 'Admin', view: 'campaignRepair', handler: 'onRepairClick', localhostOnly: true },
];
const GM_BUTTONS = NAV_BUTTONS.filter(b => b.localhostOnly);
const PLAYER_BUTTONS = NAV_BUTTONS.filter(b => !b.localhostOnly);

const RULES_URL = 'https://paulgilchrist.github.io/dnd-tools/rules/general';

function createProps(overrides = {}) {
  const handlers = {};
  for (const { handler } of NAV_BUTTONS) handlers[handler] = vi.fn();
  return {
    campaignName: 'Test Campaign',
    characters: [],
    activeCharacter: null,
    isLocalhost: true,
    onBackToCampaigns: vi.fn(),
    onAddCharacter: vi.fn(),
    onCharacterClick: vi.fn(),
    ...handlers,
    ...overrides,
  };
}

function renderSidebar(overrides = {}) {
  const props = createProps(overrides);
  return { props, ...render(<Sidebar {...props} />) };
}

describe('Sidebar', () => {
  describe('rendering', () => {
    it.each(['Test Campaign', 'My Adventure', ''])('displays the campaign name: %s', (name) => {
      const { container } = renderSidebar({ campaignName: name });
      expect(container.querySelector('.campaign-name')).toHaveTextContent(name);
    });

    it.each(NAV_BUTTONS)('renders %s on localhost', ({ label }) => {
      renderSidebar({ isLocalhost: true });
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    it.each(GM_BUTTONS)('does not render %s on non-localhost', ({ label }) => {
      renderSidebar({ isLocalhost: false });
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    });

    it.each(PLAYER_BUTTONS)('renders %s for players (as "%s")', ({ label, playerLabel }) => {
      renderSidebar({ isLocalhost: false });
      expect(screen.getByRole('button', { name: playerLabel || label })).toBeInTheDocument();
    });

    it('renders Campaigns for players but hides Add Character on non-localhost', () => {
      renderSidebar({ isLocalhost: false });
      expect(screen.getByRole('button', { name: 'Campaigns' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Character' })).not.toBeInTheDocument();
    });

    it('renders Add Character for the GM on localhost', () => {
      renderSidebar({ isLocalhost: true });
      expect(screen.getByRole('button', { name: 'Add Character' })).toBeInTheDocument();
    });

    it('renders one character button per character', () => {
      renderSidebar({ characters: [{ name: 'Aragorn' }, { name: 'Legolas' }] });
      expect(screen.getByText('Characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aragorn' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Legolas' })).toBeInTheDocument();
    });
  });

  describe('event handlers', () => {
    it.each(NAV_BUTTONS)('calls %s when the %s button is clicked on localhost', ({ label, handler }) => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props[handler]).toHaveBeenCalledTimes(1);
    });

    it('calls onBackToCampaigns when the Campaigns button is clicked (even for players)', async () => {
      const { props } = renderSidebar({ isLocalhost: false });
      fireEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
      await Promise.resolve();
      expect(props.onBackToCampaigns).toHaveBeenCalledTimes(1);
    });

    it('calls onAddCharacter when the GM clicks Add Character on localhost', async () => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: 'Add Character' }));
      await Promise.resolve();
      expect(props.onAddCharacter).toHaveBeenCalledTimes(1);
    });

    it('calls onMapsClick when players click Map', () => {
      const { props } = renderSidebar({ isLocalhost: false });
      fireEvent.click(screen.getByRole('button', { name: 'Map' }));
      expect(props.onMapsClick).toHaveBeenCalledTimes(1);
    });

    it('calls onCharacterClick with the clicked character object', () => {
      const { props } = renderSidebar({ characters: [{ name: 'Gandalf' }] });
      fireEvent.click(screen.getByRole('button', { name: 'Gandalf' }));
      expect(props.onCharacterClick).toHaveBeenCalledWith({ name: 'Gandalf' });
    });

    it('opens the rules URL in a new tab when the Rules button is clicked', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
      expect(openSpy).toHaveBeenCalledWith(RULES_URL, '_blank');
      openSpy.mockRestore();
    });
  });

  describe('active view highlighting', () => {
    it.each(NAV_BUTTONS)('highlights the %s button when activeView is %s', ({ label, view }) => {
      renderSidebar({ isLocalhost: true, activeView: view });
      expect(screen.getByRole('button', { name: label })).toHaveClass('active');
    });

    it('highlights the active character button when charSheet is active', () => {
      renderSidebar({
        characters: [{ name: 'Aragorn' }, { name: 'Legolas' }],
        activeCharacter: { name: 'Legolas' },
        activeView: 'charSheet',
      });
      expect(screen.getByRole('button', { name: 'Legolas' })).toHaveClass('active');
      expect(screen.getByRole('button', { name: 'Aragorn' })).not.toHaveClass('active');
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

    it('renders an empty indicator for unknown views and omits it when no view is active', () => {
      const { container: unknown } = renderSidebar({ activeView: 'unknown' });
      expect(unknown.querySelector('.sidebar-active-indicator').textContent.trim()).toBe('');

      const { container: none } = renderSidebar({ activeView: null });
      expect(none.querySelector('.sidebar-active-indicator')).not.toBeInTheDocument();
    });
  });

  describe('navigation order', () => {
    it('renders nav buttons in alphabetical order by label', () => {
      const { container } = renderSidebar({ isLocalhost: true });
      const labels = [...container.querySelectorAll('nav > button.sidebar-section-header')]
        .map(b => b.textContent.trim().toLowerCase());
      expect(labels).toEqual([...labels].sort());
    });
  });
});
