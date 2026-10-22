// @maintained-by-ai
// Deterministic unit contract for useCharacterManagement (file upload/download,
// active-character selection). Stable leaf hook — see note in useCharacterManagement.js:
// intentionally NOT refactored onto useEntityManagement, so these tests ride along with
// the hook's own handler signatures. App-level deletion/wizard flows are covered
// separately in src/App.runtime-events.test.jsx.
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
    it('defaults to characters=[] and activeCharacter=null', () => {
      const { result } = renderHook(() => useCharacterManagement(undefined));
      expect(result.current.characters).toEqual([]);
      expect(result.current.activeCharacter).toBeNull();
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
    it('calls saveAs with correct filename and JSON blob when activeCharacter exists', async () => {
      const { saveAs } = await import('file-saver');
      const { default: Utils } = await import('../../services/ui/utils.js');
      const char = { name: 'Dark Lord' };

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setActiveCharacter(char);
      });

      act(() => {
        result.current.handleSaveClick();
      });

      expect(Utils.getName).toHaveBeenCalledWith('Dark Lord');
      expect(saveAs).toHaveBeenCalledWith(
        expect.any(Blob),
        'dark lord.json'
      );
      const savedBlob = saveAs.mock.calls[0][0];
      expect(savedBlob.type).toBe('application/json');
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

    it('reads JSON files and merges into existing characters by name', async () => {
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

      expect(result.current.characters).toEqual([
        { name: 'Merry' },
        { name: 'Pippin', level: 5 },
        { name: 'Legolas' },
      ]);
    });

    it('sets activeCharacter to first uploaded when no active character', async () => {
      const uploaded = [{ name: 'Eowyn' }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement());

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Eowyn' });
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
      vi.clearAllMocks();
      window.confirm = vi.fn(() => true);
    });

    afterEach(() => {
      delete window.confirm;
    });

    it('dispatches WITHOUT confirming — leaf CharSummary owns the prompt (fix#36 queue)', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      // Retired-guard pin: the old hook-level dialog
      // ("Are you sure you want to delete 'Frodo'? This cannot be undone.")
      // is gone — confirming here stacked two dialogs per click. This hook
      // is now a straight dispatcher.
      expect(window.confirm).not.toHaveBeenCalled();
      expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', 'frodo.json');
      expect(result.current.characters).toEqual([{ name: 'Sam' }]);
    });

    it('is no longer gated on window.confirm — cancel protection lives at the leaf', async () => {
      // Honest passthrough of the former "does not delete when user cancels"
      // pin: ownership moved. At this layer a rejected dialog must NOT stop
      // dispatch (proving the guard is gone); the cancel-never-dispatches
      // contract is pinned at the confirming leaf in
      // CharSummary-Display.test.jsx:157 and end-to-end in
      // CharSummary-DeleteConfirm.test.jsx.
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      window.confirm = vi.fn(() => false);
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(window.confirm).not.toHaveBeenCalled();
      expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', 'frodo.json');
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

    it('throws error when no campaign is selected', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');

      const { result } = renderHook(() => useCharacterManagement());

      await expect(result.current.handleDeleteCharacter('Frodo')).rejects.toThrow(
        'No campaign selected'
      );
      expect(deleteCharacter).not.toHaveBeenCalled();
    });

    it('throws error when server delete fails', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      deleteCharacter.mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters([{ name: 'Frodo' }]);
      });

      await expect(result.current.handleDeleteCharacter('Frodo')).rejects.toThrow(
        'Server error'
      );
      expect(result.current.characters).toEqual([{ name: 'Frodo' }]);
    });
  });
});
