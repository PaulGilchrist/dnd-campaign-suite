// @maintained-by-ai 2026-11-26
// Base Sidebar chrome/navigation lane: nav-item visibility per origin
// (localhostOnly gate), handler wiring, active-view highlighting and the
// active-view indicator, nav ordering, and the unified button header tier
// with the roster toggle. Toolbelt gating lives in Sidebar.toolbelt.test.jsx,
// the popup-block Rules lane in Sidebar.rules-popup.test.jsx, the small-screen
// drawer in Sidebar.nav-drawer.test.jsx, arena campaign-type in
// Sidebar.campaign-type.test.jsx.
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

// Mirrors Sidebar.jsx NAV_ITEMS + localhost-only Admin footer.
// Single table drives visibility, click, and active-highlight contracts.
const NAV_BUTTONS = [
  { label: 'Encounters', view: 'encounter', handler: 'onEncounterClick', localhostOnly: true },
  { label: 'Factions', view: 'factions', handler: 'onFactionsClick', localhostOnly: true },
  { label: 'GM Screen', view: 'gmScreen', handler: 'onGMScreenClick', localhostOnly: true },
  { label: 'Initiative', view: 'initiative', handler: 'onInitiativeClick' },
  { label: 'Inventory', view: 'partyInventory', handler: 'onInventoryClick' },
  { label: 'Log', view: 'campaignLog', handler: 'onLogClick' },
  { label: 'Chronicle', view: 'chronicle', handler: 'onChronicleClick' },
  { label: 'Maps', view: 'mapsManager', handler: 'onMapsClick', playerLabel: 'Map' },
  { label: 'Music', view: 'music', handler: 'onMusicClick' },
  { label: 'Notes', view: 'notes', handler: 'onNotesClick', localhostOnly: true },
  { label: 'NPCs', view: 'npcs', handler: 'onNPCsClick', localhostOnly: true },
  { label: 'Quest Board', view: 'questBoard', handler: 'onQuestBoardClick' },
  { label: 'Quests', view: 'quests', handler: 'onQuestsClick', localhostOnly: true },
  { label: 'Sessions', view: 'sessions', handler: 'onSessionsClick', localhostOnly: true },
  { label: 'Settlements', view: 'settlements', handler: 'onSettlementsClick', localhostOnly: true },
  { label: 'Admin', view: 'campaignRepair', handler: 'onRepairClick', localhostOnly: true },
];
const GM_BUTTONS = NAV_BUTTONS.filter(b => b.localhostOnly);
const PLAYER_BUTTONS = NAV_BUTTONS.filter(b => !b.localhostOnly);

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

    it('shows Add Character only to the GM and fires onAddCharacter when clicked', () => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: 'Add Character' }));
      expect(props.onAddCharacter).toHaveBeenCalledTimes(1);

      cleanup();
      renderSidebar({ isLocalhost: false });
      expect(screen.queryByRole('button', { name: 'Add Character' })).not.toBeInTheDocument();
    });

    it('keeps the Campaigns escape hatch and the Map button for players', () => {
      const { props } = renderSidebar({ isLocalhost: false });
      fireEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
      expect(props.onBackToCampaigns).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Map' }));
      expect(props.onMapsClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handlers', () => {
    it.each(NAV_BUTTONS)('calls %s when the %s button is clicked on localhost', ({ label, handler }) => {
      const { props } = renderSidebar({ isLocalhost: true });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props[handler]).toHaveBeenCalledTimes(1);
    });

    it('calls onCharacterClick with the clicked character object', () => {
      const { props } = renderSidebar({ characters: [{ name: 'Gandalf' }] });
      fireEvent.click(screen.getByRole('button', { name: 'Gandalf' }));
      expect(props.onCharacterClick).toHaveBeenCalledWith({ name: 'Gandalf' });
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

  // MA 2026-11-18 backlog: view headers used to split across a button face and
  // a headless div face (`div.sidebar-section-header-static` for Characters).
  // Pinning the BUTTON face also guarantees click/Enter/Space activation —
  // native platform behavior, so keyboard-parity tests are intentionally not
  // duplicated here.
  describe('unified sidebar header tier', () => {
    const rosterProps = { characters: [{ name: 'Aragorn' }, { name: 'Legolas' }] };

    it('renders every view header as a button — zero div.sidebar-section-header faces', () => {
      const { container } = renderSidebar({ ...rosterProps, isLocalhost: true });
      expect(container.querySelectorAll('div.sidebar-section-header')).toHaveLength(0);
      const charactersHeader = screen.getByRole('button', { name: 'Characters' });
      expect(charactersHeader.tagName).toBe('BUTTON');
      expect(charactersHeader).toHaveClass('sidebar-section-header');
    });

    it('defaults to an expanded roster with one button per character', () => {
      const { container } = renderSidebar(rosterProps);
      expect(container.querySelector('.sidebar-submenu')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Characters' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aragorn' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Legolas' })).toBeInTheDocument();
    });

    it('clicking the Characters header toggles the roster closed and open again', () => {
      const { container } = renderSidebar(rosterProps);
      const header = screen.getByRole('button', { name: 'Characters' });
      fireEvent.click(header);
      expect(container.querySelector('.sidebar-submenu')).not.toBeInTheDocument();
      fireEvent.click(header);
      expect(container.querySelector('.sidebar-submenu')).toBeInTheDocument();
    });
  });
});
