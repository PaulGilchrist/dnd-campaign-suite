// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

describe('automationInfoPopup', () => {
  it('should return a popup with mapped fields', () => {
    const action = {
      name: 'Thunderwave',
      description: 'A wave of thunder.',
      automation: { type: 'save_roll', savingThrow: 'Constitution' },
    };

    const result = automationInfoPopup(action);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: action.automation.type,
        description: action.description,
        automation: action.automation,
      },
    });
  });

  it('should coerce falsy descriptions to empty string', () => {
    const base = { name: 'Action', automation: { type: 'misc' } };

    expect(automationInfoPopup({ ...base, description: undefined }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: null }).payload.description).toBe('');
  });
});
