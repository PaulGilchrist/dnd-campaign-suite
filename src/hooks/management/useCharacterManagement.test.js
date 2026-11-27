// @maintained-by-ai 2026-11-26
// Deterministic unit contract for useCharacterManagement (file upload/download,
// active-character selection). Stable leaf hook — see note in useCharacterManagement.js:
// intentionally NOT refactored onto useEntityManagement, so these tests ride along with
// the hook's own handler signatures. App-level deletion/wizard flows are covered
// separately in src/App.runtime-events.test.jsx.
// Delete-lane splits (do not re-add here): the create===delete filename recipe is
// pinned for every name shape in useCharacterManagement.delete-filename.test.js
// (incl. "no campaign → throw, API untouched") and the failed-delete error state
// (deleteErrorName arm/re-throw/roster-untouched/dismiss/clear-on-success) in
// useCharacterManagement.delete-error.test.js — both stronger than earlier lanes here.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCharacterManagement from './useCharacterManagement.js';

vi.mock('lodash/cloneDeep', () => {
  const cloneDeep = vi.fn((val) => JSON.parse(JSON.stringify(val)));
  return { default: cloneDeep };
});

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('../../services/ui/utils.js', () => {
  const getName = vi.fn((n) => (typeof n === 'string' ? n : 'Unknown'));
  return { default: { getName } };
});

vi.mock('../../services/campaign/campaignService.js', () => ({
  deleteCharacter: vi.fn().mockResolvedValue(undefined),
}));

describe('useCharacterManagement', () => {
  describe('initial state', () => {
    it('defaults to characters=[], activeCharacter=null, unattached inputRef', () => {
      const { result } = renderHook(() => useCharacterManagement(undefined));
      expect(result.current.characters).toEqual([]);
      expect(result.current.activeCharacter).toBeNull();
      expect(result.current.inputRef.current).toBeNull();
    });
  });

  describe('handleCharacterClick', () => {
    it('sets activeCharacter to a deep clone of the clicked character', () => {
      const original = { name: 'Gandalf', class: { name: 'Wizard', level: 5 } };
      const { result } = renderHook(() => useCharacterManagement());

      act(() => {
        result.current.handleCharacterClick(original);
      });

      expect(result.current.activeCharacter).toEqual(original);
      expect(result.current.activeCharacter).not.toBe(original);

      // Mutating the source afterward must not leak into the selection.
      original.class.level = 99;
      expect(result.current.activeCharacter.class.level).toBe(5);
    });
  });

  describe('handleInitiativeClick', () => {
    it('clears the active character', () => {
      const { result } = renderHook(() => useCharacterManagement());

      act(() => {
        result.current.handleCharacterClick({ name: 'Gandalf' });
      });
      expect(result.current.activeCharacter).toEqual({ name: 'Gandalf' });

      act(() => {
        result.current.handleInitiativeClick();
      });

      expect(result.current.activeCharacter).toBeNull();
    });
  });

  describe('handleSaveClick', () => {
    it('saves the active character as a lowercased "<name>.json" JSON blob', async () => {
      const { saveAs } = await import('file-saver');
      const { default: Utils } = await import('../../services/ui/utils.js');
      const char = { name: 'Dark Lord', level: 3 };

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setActiveCharacter(char);
      });

      act(() => {
        result.current.handleSaveClick();
      });

      expect(Utils.getName).toHaveBeenCalledWith('Dark Lord');
      expect(saveAs).toHaveBeenCalledTimes(1);
      expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'dark lord.json');

      // The download payload is the whole character, pretty-printed at 4 spaces.
      const savedBlob = saveAs.mock.calls[0][0];
      expect(savedBlob.type).toBe('application/json');
      await expect(savedBlob.text()).resolves.toBe(JSON.stringify(char, null, 4));
    });
  });

  describe('handleUploadClick', () => {
    it('triggers the hidden file input via inputRef', () => {
      const { result } = renderHook(() => useCharacterManagement());
      const click = vi.fn();

      act(() => {
        result.current.inputRef.current = { click };
      });
      result.current.handleUploadClick();

      expect(click).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleUploadChange', () => {
    function createMockFile(name, content) {
      return new File([content], name, { type: 'application/json' });
    }

    function createMockEvent(files) {
      return { target: { files } };
    }

    class MockFileReader {
      onload = null;

      readAsText(file) {
        file.text().then((content) => {
          if (this.onload) {
            this.onload({ target: { result: content } });
          }
        });
      }
    }

    beforeEach(() => {
      vi.stubGlobal('FileReader', MockFileReader);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('merges uploaded JSON into the roster by name and selects the first upload when none is active', async () => {
      const existing = [{ name: 'Merry' }, { name: 'Pippin' }];
      const uploaded = [{ name: 'Pippin', level: 5 }, { name: 'Legolas' }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setCharacters(existing);
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      // Merge-by-name in place, new names appended, order preserved.
      expect(result.current.characters).toEqual([
        { name: 'Merry' },
        { name: 'Pippin', level: 5 },
        { name: 'Legolas' },
      ]);
      // No prior selection → first uploaded character becomes active (as a clone).
      expect(result.current.activeCharacter).toEqual({ name: 'Pippin', level: 5 });
    });

    it('updates activeCharacter when uploaded file matches the active character by name', async () => {
      const existing = [{ name: 'Gandalf', level: 1 }];
      const uploaded = [{ name: 'Gandalf', level: 10 }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setCharacters(existing);
        result.current.setActiveCharacter({ name: 'Gandalf', level: 1 });
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Gandalf', level: 10 });
      expect(result.current.characters).toEqual([{ name: 'Gandalf', level: 10 }]);
    });

    it('leaves characters and active selection untouched when no files are provided', async () => {
      const existing = [{ name: 'Merry' }];

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setCharacters(existing);
        result.current.setActiveCharacter({ name: 'Merry' });
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent([]));
      });

      expect(result.current.characters).toEqual([{ name: 'Merry' }]);
      expect(result.current.activeCharacter).toEqual({ name: 'Merry' });
    });
  });

  describe('handleDeleteCharacter', () => {
    beforeEach(() => {
      // A REJECTING dialog stub: nothing here (or at the leaf CharSummary,
      // fix#36 queue) may consult it, and a cancel must never block dispatch
      // at this layer — asserting not-called + dispatched in one shot proves
      // the retired hook-level guard stays retired. Cancel protection lives
      // at the confirming leaf (CharSummary-Display.test.jsx:157,
      // CharSummary-DeleteConfirm.test.jsx).
      window.confirm = vi.fn(() => false);
    });

    afterEach(() => {
      delete window.confirm;
    });

    it('dispatches without consulting confirm and removes the roster entry', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(window.confirm).not.toHaveBeenCalled();
      expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', 'Frodo.json');
      expect(result.current.characters).toEqual([{ name: 'Sam' }]);
    });

    it('switches activeCharacter to next character when deleting active', async () => {
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
        result.current.setActiveCharacter(chars[0]);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Sam' });
      // The reassigned selection must be an independent clone, not the roster entry.
      expect(result.current.activeCharacter).not.toBe(chars[1]);
      expect(result.current.characters).toEqual([{ name: 'Sam' }]);
    });

    it('clears activeCharacter when deleting the last character', async () => {
      const chars = [{ name: 'Frodo' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
        result.current.setActiveCharacter(chars[0]);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(result.current.activeCharacter).toBeNull();
      expect(result.current.characters).toEqual([]);
    });
  });
});
