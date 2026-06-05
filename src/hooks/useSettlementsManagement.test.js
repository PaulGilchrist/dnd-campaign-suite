import { renderHook, act } from '@testing-library/react';
import useSettlementsManagement from './useSettlementsManagement.js';

const mockLoadSettlements = vi.fn();
const mockSaveSettlements = vi.fn();
const mockSaveSettlement = vi.fn();
const mockDeleteSettlement = vi.fn();

vi.mock('../services/settlementsService.js', () => ({
  loadSettlements: (...args) => mockLoadSettlements(...args),
  saveSettlements: (...args) => mockSaveSettlements(...args),
  saveSettlement: (...args) => mockSaveSettlement(...args),
  deleteSettlement: (...args) => mockDeleteSettlement(...args),
}));

describe('useSettlementsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('sets settlements to empty array and loading to false', () => {
      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      expect(result.current.settlements).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('returns all expected properties', () => {
      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      expect(result.current).toHaveProperty('settlements');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('loadSettlementsList');
      expect(result.current).toHaveProperty('saveSettlementsList');
      expect(result.current).toHaveProperty('saveSettlementAction');
      expect(result.current).toHaveProperty('deleteSettlementAction');
    });
  });

  describe('loadSettlementsList', () => {
    it('loads and sets settlements from service', async () => {
      const settlementsData = [
        { name: 'Waterdeep', type: 'City' },
        { name: 'Mithral Hall', type: 'Mine' },
      ];
      mockLoadSettlements.mockResolvedValue({ settlements: settlementsData });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(mockLoadSettlements).toHaveBeenCalledWith('test-campaign');
      expect(result.current.settlements).toEqual(settlementsData);
    });

    it('does nothing when campaignName is empty', async () => {
      const { result } = renderHook(() =>
        useSettlementsManagement('')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(mockLoadSettlements).not.toHaveBeenCalled();
      expect(result.current.settlements).toEqual([]);
    });

    it('does nothing when campaignName is undefined', async () => {
      const { result } = renderHook(() =>
        useSettlementsManagement(undefined)
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(mockLoadSettlements).not.toHaveBeenCalled();
      expect(result.current.settlements).toEqual([]);
    });

    it('defaults to empty array when response has no settlements field', async () => {
      mockLoadSettlements.mockResolvedValue({});

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(result.current.settlements).toEqual([]);
    });

    it('defaults to empty array when response setlements is null', async () => {
      mockLoadSettlements.mockResolvedValue({ settlements: null });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(result.current.settlements).toEqual([]);
    });

    it('handles error by logging and keeping previous state', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadSettlements.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load settlements list:',
        expect.any(Error)
      );
      expect(result.current.settlements).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('saveSettlementsList', () => {
    it('saves settlements and reloads the list', async () => {
      const settlementsToSave = [
        { name: 'Waterdeep', type: 'City' },
      ];
      mockSaveSettlements.mockResolvedValue({ success: true });
      mockLoadSettlements.mockResolvedValue({ settlements: settlementsToSave });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.saveSettlementsList(settlementsToSave);
      });

      expect(mockSaveSettlements).toHaveBeenCalledWith(
        'test-campaign',
        settlementsToSave
      );
      expect(mockLoadSettlements).toHaveBeenCalled();
      expect(result.current.settlements).toEqual(settlementsToSave);
    });

    it('throws error when save fails', async () => {
      mockSaveSettlements.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await expect(
        act(async () => {
          await result.current.saveSettlementsList([{ name: 'Waterdeep' }]);
        })
      ).rejects.toThrow('Save failed');
    });
  });

  describe('saveSettlementAction', () => {
    it('updates an existing settlement when oldName matches', async () => {
      const existingSettlements = [
        { name: 'Waterdeep', type: 'City' },
        { name: 'Mithral Hall', type: 'Mine' },
      ];

      // Seed settlements state by loading first
      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });

      const updatedSettlement = { name: 'Waterdeep', type: 'Metropolis' };
      mockSaveSettlement.mockResolvedValueOnce({
        settlement: updatedSettlement,
      });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      await act(async () => {
        const res = await result.current.saveSettlementAction(
          updatedSettlement,
          'Waterdeep'
        );
        expect(res).toEqual({ settlement: updatedSettlement });
      });

      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test-campaign',
        updatedSettlement,
        'Waterdeep'
      );
      expect(result.current.settlements).toEqual([
        { name: 'Waterdeep', type: 'Metropolis' },
        { name: 'Mithral Hall', type: 'Mine' },
      ]);
    });

    it('adds a new settlement when oldName does not match any existing', async () => {
      const existingSettlements = [{ name: 'Waterdeep', type: 'City' }];

      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });

      const newSettlement = { name: 'Mithral Hall', type: 'Mine' };
      mockSaveSettlement.mockResolvedValueOnce({
        settlement: newSettlement,
      });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      await act(async () => {
        const res = await result.current.saveSettlementAction(
          newSettlement,
          'NonExistent'
        );
        expect(res).toEqual({ settlement: newSettlement });
      });

      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test-campaign',
        newSettlement,
        'NonExistent'
      );
      expect(result.current.settlements).toEqual([
        { name: 'Waterdeep', type: 'City' },
        { name: 'Mithral Hall', type: 'Mine' },
      ]);
    });

    it('adds a new settlement when oldName is not provided', async () => {
      const existingSettlements = [{ name: 'Waterdeep', type: 'City' }];

      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });

      const newSettlement = { name: 'Mithral Hall', type: 'Mine' };
      mockSaveSettlement.mockResolvedValueOnce({
        settlement: newSettlement,
      });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      await act(async () => {
        await result.current.saveSettlementAction(newSettlement, undefined);
      });

      expect(mockSaveSettlement).toHaveBeenCalledWith(
        'test-campaign',
        newSettlement,
        undefined
      );
      expect(result.current.settlements).toEqual([
        { name: 'Waterdeep', type: 'City' },
        { name: 'Mithral Hall', type: 'Mine' },
      ]);
    });

    it('does not update state when result has no settlement field', async () => {
      const existingSettlements = [{ name: 'Waterdeep', type: 'City' }];

      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });

      mockSaveSettlement.mockResolvedValueOnce({});

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      await act(async () => {
        const res = await result.current.saveSettlementAction(
          { name: 'Mithral Hall' },
          undefined
        );
        expect(res).toEqual({});
      });

      expect(result.current.settlements).toEqual(existingSettlements);
    });

    it('throws error when save fails', async () => {
      mockSaveSettlement.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await expect(
        act(async () => {
          await result.current.saveSettlementAction(
            { name: 'Waterdeep' },
            undefined
          );
        })
      ).rejects.toThrow('Save failed');
    });
  });

  describe('deleteSettlementAction', () => {
    it('deletes a settlement and reloads the list', async () => {
      mockDeleteSettlement.mockResolvedValue({ success: true });
      mockLoadSettlements.mockResolvedValue({ settlements: [] });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.deleteSettlementAction('Waterdeep');
      });

      expect(mockDeleteSettlement).toHaveBeenCalledWith(
        'test-campaign',
        'Waterdeep'
      );
      expect(mockLoadSettlements).toHaveBeenCalled();
    });

    it('throws error when delete fails', async () => {
      mockDeleteSettlement.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await expect(
        act(async () => {
          await result.current.deleteSettlementAction('Waterdeep');
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
