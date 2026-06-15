import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────
vi.mock('../../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────
import { handle } from './genericPopupHandler.js';
import * as popupResponse from '../../../shared/popupResponse.js';

// ── Helpers ────────────────────────────────────────────────────
function makeAction(overrides = {}) {
  return {
    name: 'Generic Action',
    automation: {
      type: 'generic_popup',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────
describe('genericPopupHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call automationInfoPopup with the provided action and return its result', async () => {
    const action = makeAction();
    const expectedResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        description: 'Generic info message',
      },
    };

    popupResponse.automationInfoPopup.mockReturnValue(expectedResult);

    const result = await handle(action);

    expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
    expect(result).toEqual(expectedResult);
  });

  it('should return the result even if action properties are missing', async () => {
    const action = {}; // Minimal/invalid action object
    const expectedResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: undefined,
        description: 'Missing info',
      },
    };

    popupResponse.automationInfoPopup.mockReturnValue(expectedResult);

    const result = await handle(action);

    expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
    expect(result).toEqual(expectedResult);
  });

  it('should return null if automationInfoPopup returns null', async () => {
    const action = makeAction();
    popupResponse.automationInfoPopup.mockReturnValue(null);

    const result = await handle(action);

    expect(result).toBeNull();
  });

  it('should handle asynchronous resolution of automationInfoPopup', async () => {
    const action = makeAction();
    const expectedResult = { type: 'popup', payload: {} };
    
    popupResponse.automationInfoPopup.mockImplementation(async () => expectedResult);

    const result = await handle(action);

    expect(result).toEqual(expectedResult);
  });
});
