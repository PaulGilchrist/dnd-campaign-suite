// @maintained-by-ai: 2026-10-24
/* Lane: dice-tray result popup auto-hide (backlog 2026-10-24 — the
 * .dice-tray-popup-overlay stayed up indefinitely and intercepted every
 * page click). Timer lives in Sidebar (owner of diceResult state), hides
 * the popup ~4s after it appears, restarts on re-roll, and is cleared on
 * early close (× / Escape / backdrop) and unmount. Display-only: never game
 * state. */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

// Stub logService so Sidebar.addEntry stays off the network.
const { mockAddEntry } = vi.hoisted(() => ({
  mockAddEntry: vi.fn().mockResolvedValue({ id: 'r1' }),
}));
vi.mock('../../services/ui/logService.js', () => ({
  getLog: vi.fn().mockResolvedValue([]),
  addEntry: mockAddEntry,
}));

// MusicPlayer owns its own timers/SSE — stub it so this lane's fake-timer
// advancement only drives the dice popup countdown.
vi.mock('./MusicPlayer.jsx', () => ({ default: () => null }));

const AUTO_HIDE_MS = 4000;

function popup() {
  return document.querySelector('.dice-tray-popup-overlay');
}

function popupText(selector) {
  return popup().querySelector(selector).textContent;
}

function renderSidebar(overrides = {}) {
  return render(
    <Sidebar
      campaignName="test-campaign"
      characters={[]}
      activeCharacter={null}
      isLocalhost
      activeView="charSheet"
      onEncounterClick={vi.fn()}
      onFactionsClick={vi.fn()}
      onInitiativeClick={vi.fn()}
      onInventoryClick={vi.fn()}
      onLogClick={vi.fn()}
      onMapsClick={vi.fn()}
      onNotesClick={vi.fn()}
      onNPCsClick={vi.fn()}
      onQuestsClick={vi.fn()}
      onSessionsClick={vi.fn()}
      onSettlementsClick={vi.fn()}
      onRepairClick={vi.fn()}
      onBackToCampaigns={vi.fn()}
      onAddCharacter={vi.fn()}
      onCharacterClick={vi.fn()}
      {...overrides}
    />
  );
}

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockAddEntry.mockClear();
  // Distinct values per die so re-roll swaps are observable.
  vi.spyOn(diceRoller, 'rollDie').mockImplementation((sides) => sides);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Sidebar dice popup auto-hide', () => {
  it('auto-closes the popup ~4s after a roll, leaving the log entry intact', () => {
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    expect(popup()).toBeInTheDocument();
    expect(popupText('.dice-tray-result-value')).toBe('20');

    advance(AUTO_HIDE_MS - 1);
    expect(popup()).toBeInTheDocument();
    advance(1);
    expect(popup()).not.toBeInTheDocument();

    // Roll flow unchanged: exactly one log entry per roll (criterion 5).
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
  });

  it('restarts the countdown on a re-roll, showing the new result', () => {
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    advance(3000);
    expect(popup()).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Roll d6'));
    expect(popupText('.dice-tray-result-value')).toBe('6');
    expect(popupText('.dice-tray-result-label')).toBe('d6');

    // 3s after the SECOND roll it is still up; it dies ~1s later.
    advance(3000);
    expect(popup()).toBeInTheDocument();
    advance(1000);
    expect(popup()).not.toBeInTheDocument();
    expect(mockAddEntry).toHaveBeenCalledTimes(2);
  });

  it('restores page interactivity once the popup has auto-hidden', () => {
    const onEncounterClick = vi.fn();
    renderSidebar({ onEncounterClick });
    fireEvent.click(screen.getByTitle('Roll d20'));
    advance(AUTO_HIDE_MS);
    expect(popup()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Encounters' }));
    expect(onEncounterClick).toHaveBeenCalledTimes(1);
  });

  it('closes immediately via the × button and clears the pending timer', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(popup()).not.toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalled();

    advance(AUTO_HIDE_MS + 1000);
    expect(popup()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes immediately on Escape and clears the pending timer', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    advance(1000);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(popup()).not.toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalled();

    advance(AUTO_HIDE_MS + 1000);
    expect(popup()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes immediately on a backdrop click and clears the pending timer', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    advance(1000);

    // Backdrop lane matches × / Escape: pure dismissal, timer cleaned up,
    // still exactly one log entry (the roll itself — no extra dismissal row).
    fireEvent.click(popup());
    expect(popup()).not.toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalled();

    advance(AUTO_HIDE_MS + 1000);
    expect(popup()).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
  });

  it('does not close early when a click lands inside the modal', () => {
    renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));

    fireEvent.click(document.querySelector('.dice-tray-popup-modal'));
    expect(popup()).toBeInTheDocument();

    advance(AUTO_HIDE_MS);
    expect(popup()).not.toBeInTheDocument();
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
  });

  it('clears the timer on unmount — no state update after unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderSidebar();
    fireEvent.click(screen.getByTitle('Roll d20'));
    expect(popup()).toBeInTheDocument();

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    // Advancing past the old deadline with the tree gone must not throw.
    advance(AUTO_HIDE_MS + 1000);
    expect(popup()).not.toBeInTheDocument();
  });
});
