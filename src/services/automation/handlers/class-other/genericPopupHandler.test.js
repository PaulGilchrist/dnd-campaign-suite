// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './genericPopupHandler.js';
import * as popupResponse from '../../../shared/popupResponse.js';

function makeAction(overrides = {}) {
  return {
    name: 'Generic Action',
    automation: {
      type: 'generic_popup',
    },
    ...overrides,
  };
}

describe('genericPopupHandler.handle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should delegate to automationInfoPopup with the action and return its result', async () => {
    const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
    const action = makeAction();

    const result = await handle(action);

    expect(spy).toHaveBeenCalledWith(action);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Generic Action',
        automationType: 'generic_popup',
        description: '',
        automation: { type: 'generic_popup' },
      },
    });
  });

  it('should return the full popup object produced by automationInfoPopup', async () => {
    const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
    spy.mockImplementation((action) => ({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: action.automation.type,
        description: action.description || '',
        automation: action.automation,
      },
    }));
    const action = makeAction({ description: 'Test description' });

    const result = await handle(action);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Generic Action');
    expect(result.payload.automationType).toBe('generic_popup');
    expect(result.payload.description).toBe('Test description');
    expect(result.payload.automation).toEqual({ type: 'generic_popup' });
  });

  it('should pass through null when automationInfoPopup returns null', async () => {
    vi.spyOn(popupResponse, 'automationInfoPopup').mockReturnValue(null);
    const action = makeAction();

    const result = await handle(action);

    expect(result).toBeNull();
  });

  it('should handle actions with minimal properties', async () => {
    const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
    spy.mockImplementation((action) => ({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: action.automation.type,
        description: action.description || '',
        automation: action.automation,
      },
    }));
    const action = makeAction({ name: undefined, description: undefined });

    const result = await handle(action);

    expect(spy).toHaveBeenCalledWith(action);
    expect(result.payload.name).toBeUndefined();
    expect(result.payload.description).toBe('');
  });

  it('should handle actions with extra properties', async () => {
    const spy = vi.spyOn(popupResponse, 'automationInfoPopup');
    spy.mockImplementation((action) => ({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        automationType: action.automation.type,
        description: action.description || '',
        automation: action.automation,
        extra: action.extra,
      },
    }));
    const action = makeAction({ extra: 'custom data', automation: { type: 'generic_popup', detail: 'value' } });

    const result = await handle(action);

    expect(spy).toHaveBeenCalledWith(action);
    expect(result.payload.extra).toBe('custom data');
    expect(result.payload.automation.detail).toBe('value');
  });
});
