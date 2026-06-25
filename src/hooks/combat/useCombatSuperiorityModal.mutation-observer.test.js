import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof globalThis.MutationObserver === 'undefined') {
      globalThis.MutationObserver = class {
        observe = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      };
    }
  });

  it('should create a MutationObserver when char-actions parent exists', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    const observerSpy = vi.spyOn(globalThis, 'MutationObserver');
    observerSpy.mockImplementation(function () {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.takeRecords = vi.fn(() => []);
      return this;
    });

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerSpy).toHaveBeenCalled();

    document.body.removeChild(container);
    observerSpy.mockRestore();
  });

  it('should not create MutationObserver when char-actions parent does not exist', () => {
    const observerSpy = vi.spyOn(globalThis, 'MutationObserver');
    observerSpy.mockImplementation(function () {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.takeRecords = vi.fn(() => []);
      return this;
    });

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(observerSpy).not.toHaveBeenCalled();

    observerSpy.mockRestore();
  });

  it('should not create MutationObserver when MutationObserver is undefined', () => {
    const originalObserver = globalThis.MutationObserver;
    globalThis.MutationObserver = undefined;

    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    document.body.removeChild(container);
    globalThis.MutationObserver = originalObserver;
  });

  it('should query for popup elements when mutations occur', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    const MockObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    globalThis.MutationObserver = MockObserver;

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    document.body.removeChild(container);
    globalThis.MutationObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    };
  });

  it('should query for elements with class containing "popup"', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    const MockObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    globalThis.MutationObserver = MockObserver;

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    const popupEl = document.createElement('div');
    popupEl.className = 'superiority-popup';
    container.appendChild(popupEl);

    document.body.removeChild(container);
    globalThis.MutationObserver = class {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    };
  });

  it('should query for .popup class as fallback', () => {
    const container = document.createElement('div');
    container.className = 'char-actions';
    document.body.appendChild(container);

    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    const popupEl = document.createElement('div');
    popupEl.className = 'popup';
    container.appendChild(popupEl);

    document.body.removeChild(container);
  });
});
