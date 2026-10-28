// @maintained-by-ai
// Roster-link-lingers-after-failed-delete improve: a failed character DELETE
// (e.g. route-mocked 404) never broadcasts SSE, so nothing else heals the
// view. The hook must remember the failed name (deleteErrorName) for the
// sidebar's inline error, RE-THROW so the App.jsx wrapper keeps owning the
// alert, clear on dismiss, and clear on a later successful delete.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCharacterManagement from './useCharacterManagement.js';

vi.mock('lodash/cloneDeep', () => {
  const cloneDeep = vi.fn((val) => JSON.parse(JSON.stringify(val)));
  return { default: cloneDeep };
});

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n) },
}));

vi.mock('../../services/campaign/campaignService.js', () => ({
  deleteCharacter: vi.fn(),
}));

async function deleteCharacterImpl() {
  return (await import('../../services/campaign/campaignService.js')).deleteCharacter;
}

function seedRoster(result, names) {
  act(() => {
    result.current.setCharacters(names.map((name) => ({ name })));
  });
}

describe('useCharacterManagement failed-delete inline error state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the failed name and re-throws without touching the roster', async () => {
    const deleteCharacter = await deleteCharacterImpl();
    deleteCharacter.mockRejectedValue(new Error('Failed to delete character: Not Found'));
    const { result } = renderHook(() => useCharacterManagement('test-campaign'));
    seedRoster(result, ['AasimarTest']);

    // Rejection caught INSIDE act (expect().rejects around act swallows the
    // state flush before the assertion below runs).
    let thrown;
    await act(async () => {
      try {
        await result.current.handleDeleteCharacter('AasimarTest');
      } catch (err) {
        thrown = err;
      }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe('Failed to delete character: Not Found');

    // Inline error armed AND the link stays — the char was NOT deleted.
    expect(result.current.deleteErrorName).toBe('AasimarTest');
    expect(result.current.characters.map((c) => c.name)).toEqual(['AasimarTest']);
  });

  it('dismiss clears the error while the roster link remains', async () => {
    const deleteCharacter = await deleteCharacterImpl();
    deleteCharacter.mockRejectedValue(new Error('Failed to delete character: Not Found'));
    const { result } = renderHook(() => useCharacterManagement('test-campaign'));
    seedRoster(result, ['AasimarTest']);

    await act(async () => {
      await result.current.handleDeleteCharacter('AasimarTest').catch(() => {});
    });
    expect(result.current.deleteErrorName).toBe('AasimarTest');

    act(() => {
      result.current.dismissDeleteError();
    });
    expect(result.current.deleteErrorName).toBeNull();
    expect(result.current.characters.map((c) => c.name)).toEqual(['AasimarTest']);
  });

  it('a later successful delete clears the error and removes that link', async () => {
    const deleteCharacter = await deleteCharacterImpl();
    deleteCharacter.mockRejectedValue(new Error('Failed to delete character: Not Found'));
    const { result } = renderHook(() => useCharacterManagement('test-campaign'));
    seedRoster(result, ['AasimarTest', 'QA Delete Probe']);

    await act(async () => {
      await result.current.handleDeleteCharacter('AasimarTest').catch(() => {});
    });
    expect(result.current.deleteErrorName).toBe('AasimarTest');

    // Success leg: error cleared, no stale line, the deleted char is gone.
    deleteCharacter.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.handleDeleteCharacter('QA Delete Probe');
    });
    expect(result.current.deleteErrorName).toBeNull();
    expect(result.current.characters.map((c) => c.name)).toEqual(['AasimarTest']);
  });

  it('starts with no error', () => {
    const { result } = renderHook(() => useCharacterManagement('test-campaign'));
    expect(result.current.deleteErrorName).toBeNull();
  });
});
