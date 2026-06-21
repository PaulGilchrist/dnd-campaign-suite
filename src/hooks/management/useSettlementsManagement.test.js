// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import useSettlementsManagement from './useSettlementsManagement.js';

const mockLoadSettlements = vi.fn();
const mockSaveSettlements = vi.fn();
const mockSaveSettlement = vi.fn();
const mockDeleteSettlement = vi.fn();

vi.mock('../../services/campaign/settlementsService.js', () => ({
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
    it('returns settlements as empty array and loading as false', () => {
      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      expect(result.current.settlements).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('loadSettlementsList', () => {
    it('loads settlements from service and sets state', async () => {
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

    it('skips loading when campaignName is falsy', async () => {
      const { result } = renderHook(() =>
        useSettlementsManagement('')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(mockLoadSettlements).not.toHaveBeenCalled();
      expect(result.current.settlements).toEqual([]);
    });

    it('defaults to empty array when response settlements is null', async () => {
      mockLoadSettlements.mockResolvedValue({ settlements: null });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

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

    it('logs error and preserves existing settlements on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const existingSettlements = [{ name: 'Waterdeep', type: 'City' }];
      mockLoadSettlements.mockResolvedValueOnce({ settlements: existingSettlements });
      mockLoadSettlements.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(result.current.settlements).toEqual(existingSettlements);

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load settlements list:',
        expect.any(Error)
      );
      expect(result.current.settlements).toEqual(existingSettlements);

      consoleSpy.mockRestore();
    });
  });

  describe('saveSettlementsList', () => {
    it('saves settlements and reloads the list on success', async () => {
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

    it('logs error and re-throws when save fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSaveSettlements.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await expect(
        act(async () => {
          await result.current.saveSettlementsList([{ name: 'Waterdeep' }]);
        })
      ).rejects.toThrow('Save failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save settlements:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('saveSettlementAction', () => {
    it('replaces an existing settlement when oldName matches', async () => {
      const existingSettlements = [
        { name: 'Waterdeep', type: 'City' },
        { name: 'Mithral Hall', type: 'Mine' },
      ];

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
        await result.current.saveSettlementAction(updatedSettlement, 'Waterdeep');
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

    it('renames a settlement when oldName differs from result settlement name', async () => {
      const existingSettlements = [
        { name: 'OldName', type: 'City' },
      ];

      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });

      const renamedSettlement = { name: 'NewName', type: 'City' };
      mockSaveSettlement.mockResolvedValueOnce({
        settlement: renamedSettlement,
      });

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      await act(async () => {
        await result.current.saveSettlementAction(renamedSettlement, 'OldName');
      });

      expect(result.current.settlements).toEqual([
        { name: 'NewName', type: 'City' },
      ]);
    });

    it('appends a new settlement when oldName is undefined', async () => {
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

    it('appends when oldName does not match any existing settlement', async () => {
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
        await result.current.saveSettlementAction(newSettlement, 'GhostTown');
      });

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
        await result.current.saveSettlementAction({ name: 'Mithral Hall' }, undefined);
      });

      expect(result.current.settlements).toEqual(existingSettlements);
    });

    it('returns the result from the service', async () => {
      const existingSettlements = [{ name: 'Waterdeep', type: 'City' }];
      const expectedResult = { settlement: { name: 'Waterdeep', type: 'City' } };

      mockLoadSettlements.mockResolvedValueOnce({
        settlements: existingSettlements,
      });
      mockSaveSettlement.mockResolvedValueOnce(expectedResult);

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await act(async () => {
        await result.current.loadSettlementsList();
      });

      let returnedValue;
      await act(async () => {
        returnedValue = await result.current.saveSettlementAction(
          { name: 'Waterdeep', type: 'City' },
          'Waterdeep'
        );
      });

      expect(returnedValue).toEqual(expectedResult);
    });

    it('logs error and re-throws when save fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save settlement:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('deleteSettlementAction', () => {
    it('deletes a settlement and reloads the list on success', async () => {
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
      expect(result.current.settlements).toEqual([]);
    });

    it('logs error and re-throws when delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteSettlement.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() =>
        useSettlementsManagement('test-campaign')
      );

      await expect(
        act(async () => {
          await result.current.deleteSettlementAction('Waterdeep');
        })
      ).rejects.toThrow('Delete failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete settlement:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
