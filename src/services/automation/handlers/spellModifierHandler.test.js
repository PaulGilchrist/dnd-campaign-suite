import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────
vi.mock('../../shared/popupResponse.js', () => ({
  automationInfoPopup: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────
import { handle } from './spellModifierHandler.js';
import * as popupResponse from '../../shared/popupResponse.js';

// ── Helpers ────────────────────────────────────────────────────
function makeAction(overrides = {}) {
  return {
    name: 'Spell Modifier',
    automation: {
      type: 'spell_modifier',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────
describe('spellModifierHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Metamagic early return', () => {
    it('should return null when action.name is "Metamagic"', async () => {
      const action = makeAction({ name: 'Metamagic' });

      const result = await handle(action);

      expect(result).toBeNull();
      expect(popupResponse.automationInfoPopup).not.toHaveBeenCalled();
    });

    it('should return null for Metamagic even with extra properties', async () => {
      const action = {
        name: 'Metamagic',
        automation: { type: 'spell_modifier' },
        description: 'Some description',
      };

      const result = await handle(action);

      expect(result).toBeNull();
      expect(popupResponse.automationInfoPopup).not.toHaveBeenCalled();
    });

    it('should return null for Metamagic with empty action object', async () => {
      const action = { name: 'Metamagic' };

      const result = await handle(action);

      expect(result).toBeNull();
    });
  });

  describe('Non-Metamagic actions', () => {
    it('should call automationInfoPopup with the provided action', async () => {
      const action = makeAction();
      const expectedResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: '',
        },
      };

      popupResponse.automationInfoPopup.mockReturnValue(expectedResult);

      const result = await handle(action);

      expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
      expect(result).toEqual(expectedResult);
    });

    it('should return the result from automationInfoPopup', async () => {
      const action = makeAction();
      const expectedResult = { type: 'popup', payload: {} };

      popupResponse.automationInfoPopup.mockReturnValue(expectedResult);

      const result = await handle(action);

      expect(result).toEqual(expectedResult);
    });

    it('should pass through null if automationInfoPopup returns null', async () => {
      const action = makeAction();
      popupResponse.automationInfoPopup.mockReturnValue(null);

      const result = await handle(action);

      expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
      expect(result).toBeNull();
    });

    it('should handle asynchronous resolution of automationInfoPopup', async () => {
      const action = makeAction();
      const expectedResult = { type: 'popup', payload: {} };

      popupResponse.automationInfoPopup.mockImplementation(async () => expectedResult);

      const result = await handle(action);

      expect(result).toEqual(expectedResult);
    });

    it('should handle action with missing properties', async () => {
      const action = {};
      const expectedResult = { type: 'popup', payload: {} };

      popupResponse.automationInfoPopup.mockReturnValue(expectedResult);

      const result = await handle(action);

      expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
      expect(result).toEqual(expectedResult);
    });

    it('should handle action with only a name that is not Metamagic', async () => {
      const action = { name: 'Other Spell' };

      popupResponse.automationInfoPopup.mockReturnValue({ type: 'popup', payload: {} });

      await handle(action);

      expect(popupResponse.automationInfoPopup).toHaveBeenCalledWith(action);
    });
  });
});
