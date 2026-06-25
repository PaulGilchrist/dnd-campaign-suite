// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './spellModifierHandler.js';
import * as popupResponse from '../../../shared/popupResponse.js';

function makeAction(overrides = {}) {
  return {
    name: 'Spell Modifier',
    automation: {
      type: 'spell_modifier',
    },
    ...overrides,
  };
}

describe('spellModifierHandler.handle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Metamagic early return', () => {
    it('should return null and not call automationInfoPopup when action.name is "Metamagic"', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
      const action = makeAction({ name: 'Metamagic' });

      const result = await handle(action);

      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return null for Metamagic regardless of other properties', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
      const action = { name: 'Metamagic', description: 'extra', automation: { type: 'spell_modifier' } };

      const result = await handle(action);

      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Non-Metamagic actions', () => {
    it('should delegate to automationInfoPopup and return its result for a valid action', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup').mockImplementation((action) => ({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: action.automation.type,
          description: action.description || '',
          automation: action.automation,
        },
      }));
      const action = makeAction();

      const result = await handle(action);

      expect(spy).toHaveBeenCalledWith(action);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Spell Modifier',
          automationType: 'spell_modifier',
          description: '',
          automation: { type: 'spell_modifier' },
        },
      });
    });

    it('should pass through the result when automationInfoPopup returns null', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup').mockReturnValue(null);
      const action = makeAction();

      const result = await handle(action);

      expect(spy).toHaveBeenCalledWith(action);
      expect(result).toBeNull();
    });

    it('should include automationType in the popup payload derived from action.automation.type', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup').mockImplementation((action) => ({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: action.automation.type,
          description: action.description || '',
          automation: action.automation,
        },
      }));
      const action = makeAction({ automation: { type: 'custom_spell_type', detail: 'x' } });

      const result = await handle(action);

      expect(spy).toHaveBeenCalledWith(action);
      expect(result.payload.automationType).toBe('custom_spell_type');
      expect(result.payload.automation).toEqual({ type: 'custom_spell_type', detail: 'x' });
    });

    it('should use empty string for description when action.description is missing', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup').mockImplementation((action) => ({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: action.automation.type,
          description: action.description || '',
          automation: action.automation,
        },
      }));
      const action = makeAction({ description: undefined });

      const result = await handle(action);

      expect(spy).toHaveBeenCalledWith(action);
      expect(result.payload.description).toBe('');
    });

    it('should preserve the action description when provided', async () => {
      const spy = vi.spyOn(popupResponse, 'automationInfoPopup').mockImplementation((action) => ({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          automationType: action.automation.type,
          description: action.description || '',
          automation: action.automation,
        },
      }));
      const action = makeAction({ description: 'Cast fireball' });

      const result = await handle(action);

      expect(spy).toHaveBeenCalledWith(action);
      expect(result.payload.description).toBe('Cast fireball');
    });
  });
});
