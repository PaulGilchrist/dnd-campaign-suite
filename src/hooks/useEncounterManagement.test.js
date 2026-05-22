import { renderHook, act } from '@testing-library/react';
import useEncounterManagement from './useEncounterManagement.js';

const mockLoadEncounters = vi.fn();
const mockSaveEncounter = vi.fn();
const mockLoadEncounter = vi.fn();
const mockUpdateEncounter = vi.fn();
const mockDeleteEncounter = vi.fn();
const mockRenameEncounter = vi.fn();

vi.mock('../services/encountersService.js', () => ({
  loadEncounters: (...args) => mockLoadEncounters(...args),
  saveEncounter: (...args) => mockSaveEncounter(...args),
  loadEncounter: (...args) => mockLoadEncounter(...args),
  updateEncounter: (...args) => mockUpdateEncounter(...args),
  deleteEncounter: (...args) => mockDeleteEncounter(...args),
  renameEncounter: (...args) => mockRenameEncounter(...args),
}));

describe('useEncounterManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets initial state correctly', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      expect(result.current.encounters).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
    });
  });

  describe('loadEncounterList', () => {
    it('loads and sets encounters from service', async () => {
      const encountersData = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
        { name: 'Dragon Lair', monsters: ['young-red-dragon'] },
      ];
      mockLoadEncounters.mockResolvedValue({ encounters: encountersData });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
      expect(result.current.encounters).toEqual(encountersData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() => useEncounterManagement(''));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(mockLoadEncounters).not.toHaveBeenCalled();
      expect(result.current.encounters).toEqual([]);
    });

    it('defaults to empty array when response has no encounters field', async () => {
      mockLoadEncounters.mockResolvedValue({});

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(result.current.encounters).toEqual([]);
    });

    it('handles error by logging and keeping previous state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadEncounters.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.loadEncounterList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load encounter list:',
        expect.any(Error)
      );
      expect(result.current.encounters).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('modal state', () => {
    it('openSaveModal sets mode to save and opens modal', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      act(() => {
        result.current.openSaveModal();
      });

      expect(result.current.modalMode).toBe('save');
      expect(result.current.modalOpen).toBe(true);
    });

    it('openLoadModal loads encounters, sets mode to load, and opens modal', async () => {
      const encountersData = [
        { name: 'Goblin Ambush', monsters: ['goblin'] },
      ];
      mockLoadEncounters.mockResolvedValue({ encounters: encountersData });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.openLoadModal();
      });

      expect(mockLoadEncounters).toHaveBeenCalledWith('test-campaign');
      expect(result.current.encounters).toEqual(encountersData);
      expect(result.current.modalMode).toBe('load');
      expect(result.current.modalOpen).toBe(true);
    });

    it('closeModal closes modal and resets mode', () => {
      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      act(() => {
        result.current.openSaveModal();
      });
      expect(result.current.modalOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
    });
  });

  describe('saveEncounter', () => {
    it('saves encounter and reloads the list', async () => {
      const encounterName = 'goblin-ambush';
      const encounterData = { monsters: ['goblin'] };
      const updatedEncounters = [{ name: 'Goblin Ambush', monsters: ['goblin'] }];

      mockSaveEncounter.mockResolvedValue({ success: true });
      mockLoadEncounters.mockResolvedValue({ encounters: updatedEncounters });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.saveEncounter(encounterName, encounterData);
      });

      expect(mockSaveEncounter).toHaveBeenCalledWith(
        'test-campaign',
        encounterName,
        encounterData
      );
      expect(mockLoadEncounters).toHaveBeenCalled();
      expect(result.current.encounters).toEqual(updatedEncounters);
    });

    it('throws error when save fails', async () => {
      mockSaveEncounter.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.saveEncounter('test', {});
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Save failed');
    });
  });

  describe('loadEncounterData', () => {
    it('loads a single encounter, closes modal, and resets loading', async () => {
      const encounterData = { name: 'goblin-ambush', monsters: ['goblin'] };
      mockLoadEncounter.mockResolvedValue(encounterData);

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let data;
      await act(async () => {
        data = await result.current.loadEncounterData('goblin-ambush');
      });

      expect(mockLoadEncounter).toHaveBeenCalledWith('test-campaign', 'goblin-ambush');
      expect(data).toEqual(encounterData);
      expect(result.current.modalOpen).toBe(false);
      expect(result.current.modalMode).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('sets loading to false even when load fails', async () => {
      mockLoadEncounter.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.loadEncounterData('test');
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Load failed');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('deleteEncounterAction', () => {
    it('deletes an encounter and reloads the list', async () => {
      const updatedEncounters = [];

      mockDeleteEncounter.mockResolvedValue({ success: true });
      mockLoadEncounters.mockResolvedValue({ encounters: updatedEncounters });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.deleteEncounterAction('goblin-ambush');
      });

      expect(mockDeleteEncounter).toHaveBeenCalledWith('test-campaign', 'goblin-ambush');
      expect(mockLoadEncounters).toHaveBeenCalled();
      expect(result.current.encounters).toEqual([]);
    });

    it('throws error when delete fails', async () => {
      mockDeleteEncounter.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.deleteEncounterAction('test');
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Delete failed');
    });
  });

  describe('renameEncounterAction', () => {
    it('renames an encounter and reloads the list', async () => {
      const updatedEncounters = [
        { name: 'Goblin Ambush v2', monsters: ['goblin'] },
      ];

      mockRenameEncounter.mockResolvedValue({ success: true });
      mockLoadEncounters.mockResolvedValue({ encounters: updatedEncounters });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.renameEncounterAction('goblin-ambush', 'goblin-ambush-v2');
      });

      expect(mockRenameEncounter).toHaveBeenCalledWith(
        'test-campaign',
        'goblin-ambush',
        'goblin-ambush-v2'
      );
      expect(mockLoadEncounters).toHaveBeenCalled();
      expect(result.current.encounters).toEqual(updatedEncounters);
    });

    it('throws error when rename fails', async () => {
      mockRenameEncounter.mockRejectedValue(new Error('Rename failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.renameEncounterAction('old', 'new');
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Rename failed');
    });
  });

  describe('updateExistingEncounter', () => {
    it('updates an encounter without reloading the list', async () => {
      const updateData = { monsters: ['hobgoblin'], difficulty: 'medium' };
      mockUpdateEncounter.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      await act(async () => {
        await result.current.updateEncounter('goblin-ambush', updateData);
      });

      expect(mockUpdateEncounter).toHaveBeenCalledWith(
        'test-campaign',
        'goblin-ambush',
        updateData
      );
      // updateExistingEncounter does NOT reload the list
      expect(mockLoadEncounters).not.toHaveBeenCalled();
    });

    it('throws error when update fails', async () => {
      mockUpdateEncounter.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useEncounterManagement('test-campaign'));

      let caughtError;
      await act(async () => {
        try {
          await result.current.updateEncounter('test', {});
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Update failed');
    });
  });
});
