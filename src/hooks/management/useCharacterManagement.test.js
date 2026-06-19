/* @improved-by-ai */
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
      const original = { name: 'Gandalf', class: 'Wizard' };
      const { result } = renderHook(() => useCharacterManagement(undefined));

      act(() => {
        result.current.handleCharacterClick(original);
      });

      expect(result.current.activeCharacter).toEqual(original);
      expect(result.current.activeCharacter).not.toBe(original);
    });

    it('does not mutate the original character when activeCharacter is modified afterward', () => {
      const original = { name: 'Aragorn', hp: 10 };
      const { result } = renderHook(() => useCharacterManagement(undefined));

      act(() => {
        result.current.handleCharacterClick(original);
      });

      act(() => {
        result.current.setActiveCharacter({ ...result.current.activeCharacter, hp: 20 });
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Aragorn', hp: 20 });
      expect(original).toEqual({ name: 'Aragorn', hp: 10 });
    });
  });

  describe('handleInitiativeClick', () => {
    it('sets activeCharacter to null', () => {
      const { result } = renderHook(() =>
        useCharacterManagement(undefined, { activeCharacter: { name: 'Gandalf' } })
      );

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

      const { result } = renderHook(() => useCharacterManagement(undefined));
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

    it('throws when activeCharacter is null', async () => {
      const { saveAs } = await import('file-saver');
      saveAs.mockClear();

      const { result } = renderHook(() => useCharacterManagement(undefined));

      await expect(
        act(async () => {
          await result.current.handleSaveClick();
        })
      ).rejects.toThrow();

      expect(saveAs).not.toHaveBeenCalled();
    });
  });

  describe('handleUploadClick', () => {
    it('calls inputRef.current.click()', () => {
      const { result } = renderHook(() => useCharacterManagement(undefined));
      const mockClick = vi.fn();
      result.current.inputRef.current = { click: mockClick };

      result.current.handleUploadClick();

      expect(mockClick).toHaveBeenCalled();
    });

    it('throws when inputRef is null', () => {
      const { result } = renderHook(() => useCharacterManagement(undefined));
      expect(result.current.inputRef.current).toBeNull();

      expect(() => {
        result.current.handleUploadClick();
      }).toThrow('click');
    });
  });

  describe('handleUploadChange', () => {
    function createMockFile(name, content) {
      const file = new File([content], name, { type: 'application/json' });
      Object.defineProperty(file, 'name', { value: name });
      return file;
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

      const { result } = renderHook(() => useCharacterManagement(undefined));
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

    it('replaces existing character when uploaded char has same name', async () => {
      const existing = [{ name: 'Boromir' }];
      const uploaded = [{ name: 'Boromir', alive: false }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement(undefined));
      act(() => {
        result.current.setCharacters(existing);
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      expect(result.current.characters).toEqual([{ name: 'Boromir', alive: false }]);
    });

    it('sets activeCharacter to first uploaded when no active character', async () => {
      const uploaded = [{ name: 'Eowyn' }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement(undefined));

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Eowyn' });
    });

    it('updates activeCharacter when uploaded file matches the active character by name', async () => {
      const existing = [{ name: 'Gandalf', level: 1 }];
      const uploaded = [{ name: 'Gandalf', level: 10 }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement(undefined));
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

    it('does not change activeCharacter when no matching uploaded file exists', async () => {
      const existing = [{ name: 'Gandalf' }];
      const uploaded = [{ name: 'Aragorn' }];
      const files = uploaded.map((c) => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement(undefined));
      act(() => {
        result.current.setCharacters(existing);
        result.current.setActiveCharacter({ name: 'Gandalf' });
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      expect(result.current.activeCharacter).toEqual({ name: 'Gandalf' });
      expect(result.current.characters).toEqual([
        { name: 'Gandalf' },
        { name: 'Aragorn' },
      ]);
    });

    it('throws when uploaded JSON is invalid', async () => {
      const files = [createMockFile('bad.json', 'not valid json')];

      const { result } = renderHook(() => useCharacterManagement(undefined));

      let unhandledError = null;
      const handler = (e) => {
        unhandledError = e?.reason || e;
      };
      process.on('unhandledRejection', handler);

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
      });

      process.off('unhandledRejection', handler);

      expect(unhandledError).toBeInstanceOf(SyntaxError);
    });

    it('does nothing when no files are provided', async () => {
      const existing = [{ name: 'Merry' }];

      const { result } = renderHook(() => useCharacterManagement(undefined));
      act(() => {
        result.current.setCharacters(existing);
      });

      await act(async () => {
        result.current.handleUploadChange(createMockEvent([]));
      });

      expect(result.current.characters).toEqual([{ name: 'Merry' }]);
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

    it('deletes character and removes from state when confirmed', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters(chars);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(window.confirm).toHaveBeenCalledWith(
        "Are you sure you want to delete 'Frodo'? This cannot be undone."
      );
      expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', 'frodo.json');
      expect(result.current.characters).toEqual([{ name: 'Sam' }]);
    });

    it('does not delete when user cancels confirmation', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      window.confirm = vi.fn(() => false);
      const chars = [{ name: 'Frodo' }, { name: 'Sam' }];

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setCharacters(chars);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Frodo');
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(deleteCharacter).not.toHaveBeenCalled();
      expect(result.current.characters).toEqual(chars);
    });

    it('throws when confirm throws an error', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
      window.confirm = vi.fn(() => {
        throw new Error('Confirm blocked');
      });

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters([{ name: 'Frodo' }]);
      });

      await expect(result.current.handleDeleteCharacter('Frodo')).rejects.toThrow(
        'Confirm blocked'
      );
      expect(deleteCharacter).not.toHaveBeenCalled();
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

      const { default: cloneDeep } = await import('lodash/cloneDeep');
      expect(cloneDeep).toHaveBeenCalledWith({ name: 'Sam' });
      expect(result.current.activeCharacter).toEqual({ name: 'Sam' });
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

    it('builds filename with hyphens for spaces', async () => {
      const { deleteCharacter } = await import('../../services/campaign/campaignService.js');

      const { result } = renderHook(() => useCharacterManagement('test-campaign'));
      act(() => {
        result.current.setCharacters([{ name: 'Dark Lord' }]);
      });

      await act(async () => {
        result.current.handleDeleteCharacter('Dark Lord');
      });

      expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', 'dark-lord.json');
    });

    it('remains in state when server delete fails after confirm', async () => {
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
