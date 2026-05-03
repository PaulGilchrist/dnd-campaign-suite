import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCharacterManagement from './use-character-management';

vi.mock('lodash/cloneDeep', () => ({ default: vi.fn(val => val) }));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../services/utils', () => ({ default: { getFirstName: vi.fn(n => n) } }));

const createMockSessionStorage = () => {
  const store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  };
};

beforeEach(() => {
  const mockStorage = createMockSessionStorage();
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCharacterManagement', () => {
  describe('initial state', () => {
    it('defaults to characters=[] and activeCharacter=null', () => {
      const { result } = renderHook(() => useCharacterManagement());
      expect(result.current.characters).toEqual([]);
      expect(result.current.activeCharacter).toBeNull();
    });
  });

  describe('preload from sessionStorage', () => {
    it('loads characters and sets first as active, then clears the key', () => {
      const stored = JSON.stringify([{ name: 'Frodo' }, { name: 'Sam' }]);
      window.sessionStorage.setItem('characters', stored);

      const { result } = renderHook(() => useCharacterManagement());

      expect(result.current.characters).toEqual([{ name: 'Frodo' }, { name: 'Sam' }]);
      expect(result.current.activeCharacter).toEqual({ name: 'Frodo' });
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('characters');
    });
  });

  describe('handleCharacterClick', () => {
    it('sets activeCharacter to the clicked character (cloned)', async () => {
      const cloneDeep = (await import('lodash/cloneDeep')).default;
      const chars = [{ name: 'Gandalf' }, { name: 'Aragorn' }];

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setCharacters(chars);
      });

      act(() => {
        result.current.handleCharacterClick(chars[1]);
      });

      expect(cloneDeep).toHaveBeenCalledWith(chars[1]);
      expect(result.current.activeCharacter).toEqual(chars[1]);
    });
  });

  describe('handleInitiativeClick', () => {
    it('sets activeCharacter to null', () => {
      const { result } = renderHook(() => useCharacterManagement());

      act(() => {
        result.current.handleInitiativeClick();
      });

      expect(result.current.activeCharacter).toBeNull();
    });
  });

  describe('handleSaveClick', () => {
    it('calls saveAs with correct filename and JSON blob', async () => {
      const { saveAs } = await import('file-saver');
      const { default: Utils } = await import('../services/utils');
      const char = { name: 'Dark Lord' };

      const { result } = renderHook(() => useCharacterManagement());
      act(() => {
        result.current.setActiveCharacter(char);
      });

      act(() => {
        result.current.handleSaveClick();
      });

      expect(Utils.getFirstName).toHaveBeenCalledWith(char.name);
      expect(saveAs).toHaveBeenCalledWith(
        expect.any(Blob),
        'dark lord.json'
      );
      const savedBlob = saveAs.mock.calls[0][0];
      expect(savedBlob.type).toBe('application/json');
    });
  });

  describe('handleUploadClick', () => {
    it('calls inputRef.current.click()', () => {
      const { result } = renderHook(() => useCharacterManagement());
      const mockClick = vi.fn();
      result.current.inputRef.current = { click: mockClick };

      result.current.handleUploadClick();

      expect(mockClick).toHaveBeenCalled();
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

    // Mock FileReader because production code references `reader` outside its
    // declaration scope (inner const reader vs outer reader.readAsText).
    // The mock constructor assigns itself to globalThis so the outer reference resolves.
    class MockFileReader {
      constructor() {
        this.onload = null;
        globalThis.reader = this;
       }
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
      delete globalThis.reader;
     });

    it('reads JSON files and merges into existing characters by name', async () => {
      const existing = [{ name: 'Merry' }, { name: 'Pippin' }];
      const uploaded = [{ name: 'Pippin', level: 5 }, { name: 'Legolas' }];
      const files = uploaded.map(c => createMockFile(`${c.name}.json`, JSON.stringify(c)));

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

    it('replaces existing character when uploaded char has same name', async () => {
      const existing = [{ name: 'Boromir' }];
      const uploaded = [{ name: 'Boromir', alive: false }];
      const files = uploaded.map(c => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement());
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
      const files = uploaded.map(c => createMockFile(`${c.name}.json`, JSON.stringify(c)));

      const { result } = renderHook(() => useCharacterManagement());

      await act(async () => {
        result.current.handleUploadChange(createMockEvent(files));
       });

      expect(result.current.activeCharacter).toEqual({ name: 'Eowyn' });
     });
  });
});
