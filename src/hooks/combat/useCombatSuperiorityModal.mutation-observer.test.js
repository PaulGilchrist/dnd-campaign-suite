// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../config/ui-config.js', () => ({
  SHOW_DICE_ROLL_DELAY: 2000,
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeManeuver: vi.fn(),
  onCombatSuperioritySelected: vi.fn(),
}));

describe('useCombatSuperiorityModal - MutationObserver', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  let originalObserver;
  let observerCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    originalObserver = globalThis.MutationObserver;
    observerCallback = null;

    globalThis.MutationObserver = class {
      constructor(callback) {
        observerCallback = callback;
      }
      observe(target, options) {
        this.target = target;
        this.options = options;
      }
      disconnect() {}
      takeRecords() { return []; }
    };
  });

  afterEach(() => {
    globalThis.MutationObserver = originalObserver;
    observerCallback = null;
  });

  it('should observe .char-actions parent when it exists', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerCallback).toBeDefined();

    const observerInstance = new globalThis.MutationObserver(observerCallback);
    observerInstance.observe(container, { childList: true, subtree: true });

    expect(observerInstance.target).toBe(container);
    expect(observerInstance.options).toEqual({ childList: true, subtree: true });

    document.body.removeChild(container);
  });

  it('should not create observer when .char-actions parent does not exist', () => {
    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerCallback).toBeNull();
  });

  it('should not create observer when MutationObserver is undefined', () => {
    globalThis.MutationObserver = undefined;

    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerCallback).toBeNull();

    document.body.removeChild(container);
  });

  it('should update popupHtmlRef when a popup element is added to .char-actions', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerCallback).toBeDefined();

    const popupEl = document.createElement('div');
    popupEl.className = 'superiority-popup';
    container.appendChild(popupEl);

    const mutationRecord = {
      addedNodes: [popupEl],
      removedNodes: new Set(),
      childList: true,
      subtree: true,
    };

    observerCallback(mutationRecord, {});

    expect(result.current.combatSuperiorityModal).toBeNull();

    document.body.removeChild(container);
  });

  it('should update popupHtmlRef when a .popup element is added as fallback', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    const popupEl = document.createElement('div');
    popupEl.className = 'popup';
    container.appendChild(popupEl);

    const mutationRecord = {
      addedNodes: [popupEl],
      removedNodes: new Set(),
      childList: true,
      subtree: true,
    };

    observerCallback(mutationRecord, {});

    expect(result.current.combatSuperiorityModal).toBeNull();

    document.body.removeChild(container);
  });

  it('should disconnect observer on unmount', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    let disconnectCalled = false;
    const OriginalObserver = globalThis.MutationObserver;

    globalThis.MutationObserver = class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target, options) {
        this.target = target;
        this.options = options;
      }
      disconnect() {
        disconnectCalled = true;
      }
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(disconnectCalled).toBe(false);

    unmount();

    expect(disconnectCalled).toBe(true);

    globalThis.MutationObserver = OriginalObserver;
    document.body.removeChild(container);
  });
});
