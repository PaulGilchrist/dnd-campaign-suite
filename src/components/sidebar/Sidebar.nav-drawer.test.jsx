// @maintained-by-ai 2026-11-23
// Small-screen collapsible-sidebar behavior (backlog 2026-11-23): below the
// 768px breakpoint the sidebar docks off-canvas behind a keyboard-usable
// toggle; opening focuses the nav, Escape/backdrop dismiss, and choosing ANY
// destination (full GM set or reduced visitor set) fires the real handler AND
// closes the drawer. At desktop widths nothing of the drawer chrome renders.
// jsdom has no matchMedia, so the hook's innerWidth fallback + resize lane is
// the test seam; cleanup restores jsdom's 1024 default for sibling suites.
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function createProps(overrides = {}) {
  return {
    campaignName: 'Test Campaign',
    characters: [{ name: 'Aragorn' }],
    activeCharacter: null,
    isLocalhost: true,
    activeView: null,
    onBackToCampaigns: vi.fn(),
    onAddCharacter: vi.fn(),
    onCharacterClick: vi.fn(),
    onInitiativeClick: vi.fn(),
    onEncounterClick: vi.fn(),
    onMapsClick: vi.fn(),
    onLogClick: vi.fn(),
    onMusicClick: vi.fn(),
    onInventoryClick: vi.fn(),
    onQuestBoardClick: vi.fn(),
    onRepairClick: vi.fn(),
    onHelpClick: vi.fn(),
    ...overrides,
  };
}

function renderSidebar(overrides = {}) {
  const props = createProps(overrides);
  return { props, ...render(<Sidebar {...props} />) };
}

const navEl = (container) => container.querySelector('nav.sidebar');

afterEach(() => {
  cleanup();
  delete window.innerWidth;
});

describe('collapsible small-screen sidebar', () => {
  describe('desktop tier (1024px)', () => {
    it('renders no toggle, no backdrop, no drawer classes or inert attr', () => {
      const { container } = renderSidebar();
      expect(container.querySelector('.sidebar-nav-toggle')).not.toBeInTheDocument();
      expect(container.querySelector('.sidebar-nav-backdrop')).not.toBeInTheDocument();
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      expect(navEl(container)).not.toHaveAttribute('inert');
    });
  });

  describe('small tier (420px) — collapsed default', () => {
    it('renders a visible, labelled toggle and parks the nav inert/off-canvas', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      const toggle = screen.getByRole('button', { name: 'Open navigation' });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', 'sidebar-nav');
      expect(container.querySelector('.sidebar-nav-backdrop')).not.toBeInTheDocument();
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      // Off-canvas nav must not leak into the tab order.
      expect(navEl(container)).toHaveAttribute('inert');
    });

    it('the toggle is the first tab stop and opens on Enter', async () => {
      setViewportWidth(420);
      const user = userEvent.setup();
      const { container } = renderSidebar();
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));
      await user.keyboard('{Enter}');
      expect(navEl(container)).toHaveClass('sidebar--drawer-open');
    });
  });

  describe('small tier (420px) — open drawer', () => {
    it('opening marks the drawer open, drops inert, shows the backdrop, and focuses the nav', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      const toggle = screen.getByRole('button', { name: 'Close navigation' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const nav = navEl(container);
      expect(nav).toHaveClass('sidebar--drawer-open');
      expect(nav).not.toHaveAttribute('inert');
      expect(container.querySelector('.sidebar-nav-backdrop')).toBeInTheDocument();
      expect(document.activeElement).toBe(nav);
    });

    it('Escape closes and restores focus to the toggle', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));
    });

    it('a pure backdrop click closes the drawer', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      fireEvent.click(container.querySelector('.sidebar-nav-backdrop'));
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      expect(container.querySelector('.sidebar-nav-backdrop')).not.toBeInTheDocument();
    });

    it.each([
      ['Initiative', 'onInitiativeClick'],
      ['Encounters', 'onEncounterClick'],
      ['Log', 'onLogClick'],
      ['Admin', 'onRepairClick'],
    ])('choosing %s fires the real handler and closes the drawer (full GM set)', (label, handler) => {
      setViewportWidth(420);
      const { container, props } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(props[handler]).toHaveBeenCalledTimes(1);
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      expect(container.querySelector('.sidebar-nav-backdrop')).not.toBeInTheDocument();
    });

    it('choosing a roster character navigates and closes', () => {
      setViewportWidth(420);
      const { container, props } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      fireEvent.click(screen.getByRole('button', { name: 'Aragorn' }));
      expect(props.onCharacterClick).toHaveBeenCalledWith({ name: 'Aragorn' });
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
    });

    it('the visitor reduced set is reachable: Map navigates and closes, Admin stays absent', () => {
      setViewportWidth(420);
      const { container, props } = renderSidebar({ isLocalhost: false });
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      expect(screen.queryByRole('button', { name: 'Encounters' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Map' }));
      expect(props.onMapsClick).toHaveBeenCalledTimes(1);
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
    });

    it('the Characters disclosure header toggles the roster WITHOUT closing the drawer', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      fireEvent.click(screen.getByRole('button', { name: 'Characters' }));
      expect(container.querySelector('.sidebar-submenu')).not.toBeInTheDocument();
      expect(navEl(container)).toHaveClass('sidebar--drawer-open');
    });
  });

  describe('breakpoint crossing', () => {
    it('resizing small→desktop→small does not resurrect an open drawer', () => {
      setViewportWidth(420);
      const { container } = renderSidebar();
      fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
      expect(navEl(container)).toHaveClass('sidebar--drawer-open');

      act(() => {
        setViewportWidth(1280);
        window.dispatchEvent(new Event('resize'));
      });
      // Desktop tier: drawer chrome gone entirely.
      expect(container.querySelector('.sidebar-nav-toggle')).not.toBeInTheDocument();
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');

      act(() => {
        setViewportWidth(420);
        window.dispatchEvent(new Event('resize'));
      });
      // Back at small width the drawer starts collapsed again.
      expect(navEl(container)).not.toHaveClass('sidebar--drawer-open');
      expect(screen.getByRole('button', { name: 'Open navigation' }))
        .toHaveAttribute('aria-expanded', 'false');
    });
  });
});
