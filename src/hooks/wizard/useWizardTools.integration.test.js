import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import useWizardTools from './useWizardTools.js';
import {
  fetchBackgroundData,
  fetchClassData,
  loadFeatData,
  loadEquipment,
} from '../../services/ui/dataLoader.js';

const createFormData2024 = (overrides = {}) => ({
  name: 'Test Character',
  rules: '2024',
  class: { name: 'Bard' },
  race: { name: 'Human' },
  background: 'Acolyte',
  feats: ['Skilled'],
  level: 1,
  toolProficiencies: [],
  ...overrides,
});

const createFormData5e = (overrides = {}) => ({
  name: 'Test Character',
  rules: '5e',
  class: { name: 'Fighter' },
  race: { name: 'Human' },
  background: 'Soldier',
  feats: [],
  level: 1,
  toolProficiencies: [],
  ...overrides,
});

describe('useWizardTools - integration', () => {
  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockClear();
    fetchBackgroundData.mockResolvedValue({ tool_proficiencies: "Calligrapher's Supplies" });
    fetchClassData.mockResolvedValue({ tool_proficiencies: 'Choose 3 Musical Instruments (see chapter 6)' });
    loadFeatData.mockResolvedValue([]);
    loadEquipment.mockResolvedValue([]);
  });

  function renderTools(formData = createFormData2024(), setFormDataFn = mockSetFormData) {
    return renderHook(() => useWizardTools(formData, setFormDataFn));
  }

  describe('2024 ruleset - tool proficiency flow', () => {
    it('pre-selects background tool proficiencies and calls setFormData with merged tools', async () => {
      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current.preSelectedTools).toContain("Calligrapher's Supplies");
      });

      expect(fetchBackgroundData).toHaveBeenCalledWith('Acolyte', '2024');
      expect(fetchClassData).toHaveBeenCalledWith('Bard', '2024');
      expect(loadFeatData).toHaveBeenCalledWith('2024');

      expect(mockSetFormData).toHaveBeenCalled();
      const mergeCall = mockSetFormData.mock.calls[0][0];
      expect(typeof mergeCall).toBe('function');
      const mergedResult = mergeCall({ toolProficiencies: [] });
      expect(mergedResult.toolProficiencies).toContain("Calligrapher's Supplies");
    });

    it('returns preSelectedTools as an array of tool names from background and class choices', async () => {
      const { result } = renderTools();

      await waitFor(() => {
        expect(Array.isArray(result.current.preSelectedTools)).toBe(true);
        expect(result.current.preSelectedTools.length).toBeGreaterThan(0);
      });

      expect(result.current.preSelectedTools).toContain("Calligrapher's Supplies");
    });

    it('returns toolLimits with categoryLimits Map, preSelected array, and skilledUsesAvailable number', async () => {
      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current.toolLimits).not.toBeNull();
        expect(result.current.toolLimits).not.toBeUndefined();
      });

      expect(result.current.toolLimits).toHaveProperty('categoryLimits');
      expect(result.current.toolLimits.categoryLimits).toBeInstanceOf(Map);
      expect(result.current.toolLimits).toHaveProperty('preSelected');
      expect(Array.isArray(result.current.toolLimits.preSelected)).toBe(true);
      expect(result.current.toolLimits).toHaveProperty('skilledUsesAvailable');
      expect(typeof result.current.toolLimits.skilledUsesAvailable).toBe('number');
    });

    it('returns toolWarnings as an array', async () => {
      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current.toolWarnings).toBeDefined();
      });

      expect(Array.isArray(result.current.toolWarnings)).toBe(true);
    });

    it('does not call setFormData when preSelectedTools is empty', async () => {
      fetchBackgroundData.mockResolvedValue(null);
      fetchClassData.mockResolvedValue(null);
      loadFeatData.mockResolvedValue([]);

      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current.preSelectedTools).toEqual([]);
      });

      expect(mockSetFormData).not.toHaveBeenCalled();
    });
  });

  describe('5e ruleset - no tool proficiency processing', () => {
    it('returns empty preSelectedTools for 5e ruleset', async () => {
      const { result } = renderTools(createFormData5e());

      await waitFor(() => {
        expect(result.current.preSelectedTools).toEqual([]);
      });

      expect(fetchBackgroundData).not.toHaveBeenCalled();
      expect(fetchClassData).not.toHaveBeenCalled();
      expect(loadFeatData).not.toHaveBeenCalled();
    });

    it('returns empty toolLimits for 5e ruleset', async () => {
      const { result } = renderTools(createFormData5e());

      await waitFor(() => {
        expect(result.current.toolLimits).not.toBeNull();
        expect(result.current.toolLimits).not.toBeUndefined();
      });

      expect(result.current.toolLimits.categoryLimits).toBeInstanceOf(Map);
      expect(result.current.toolLimits.categoryLimits.size).toBe(0);
      expect(result.current.toolLimits.preSelected).toEqual([]);
      expect(result.current.toolLimits.skilledUsesAvailable).toBe(0);
    });

    it('returns empty warnings for 5e ruleset', async () => {
      const { result } = renderTools(createFormData5e());

      await waitFor(() => {
        expect(result.current.toolWarnings).toEqual([]);
      });
    });
  });

  describe('missing data handling', () => {
    it('returns empty preSelectedTools when background returns null', async () => {
      fetchBackgroundData.mockResolvedValue(null);

      const { result } = renderTools(createFormData2024({ background: 'NonExistent' }));

      await waitFor(() => {
        expect(result.current.preSelectedTools).toEqual([]);
      });
    });

    it('returns empty preSelectedTools when class returns null', async () => {
      fetchClassData.mockResolvedValue(null);

      const { result } = renderTools(createFormData2024({ class: { name: 'NonExistentClass' } }));

      await waitFor(() => {
        expect(result.current.preSelectedTools).toEqual([]);
      });
  });

    it('returns empty preSelectedTools when both background and class return null', async () => {
      fetchBackgroundData.mockResolvedValue(null);
      fetchClassData.mockResolvedValue(null);

      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current.preSelectedTools).toEqual([]);
      });
    });

    it('handles missing feats gracefully', async () => {
      loadFeatData.mockResolvedValue([]);

      const { result } = renderTools(createFormData2024({ feats: ['NonExistentFeat'] }));

      await waitFor(() => {
        expect(result.current.preSelectedTools).toBeDefined();
      });

      expect(fetchBackgroundData).toHaveBeenCalled();
      expect(fetchClassData).toHaveBeenCalled();
    });
  });

  describe('merge behavior via setFormData', () => {
    it('does not duplicate tools already in toolProficiencies', async () => {
      const existingTools = ["Calligrapher's Supplies"];
      const existingSetFormData = vi.fn((updater) => {
        const result = updater({ toolProficiencies: existingTools });
        return result;
      });

      renderTools(createFormData2024(), existingSetFormData);

      await waitFor(() => {
        expect(existingSetFormData).toHaveBeenCalled();
      });

      const lastCall = existingSetFormData.mock.calls[existingSetFormData.mock.calls.length - 1][0];
      const merged = lastCall({ toolProficiencies: existingTools });
      const count = merged.toolProficiencies.filter(t => t === "Calligrapher's Supplies").length;
      expect(count).toBe(1);
    });

    it('appends new pre-selected tools to existing toolProficiencies', async () => {
      const existingTools = ['Herbalism Kit'];
      const existingSetFormData = vi.fn((updater) => {
        const result = updater({ toolProficiencies: existingTools });
        return result;
      });

      renderTools(createFormData2024(), existingSetFormData);

      await waitFor(() => {
        expect(existingSetFormData).toHaveBeenCalled();
      });

      const lastCall = existingSetFormData.mock.calls[existingSetFormData.mock.calls.length - 1][0];
      const merged = lastCall({ toolProficiencies: existingTools });
      expect(merged.toolProficiencies).toContain('Herbalism Kit');
      expect(merged.toolProficiencies).toContain("Calligrapher's Supplies");
      expect(merged.toolProficiencies).toHaveLength(2);
    });
  });

  describe('return value structure', () => {
    it('returns an object with exactly toolLimits, toolWarnings, and preSelectedTools', async () => {
      const { result } = renderTools();

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      expect(result.current).toHaveProperty('toolLimits');
      expect(result.current).toHaveProperty('toolWarnings');
      expect(result.current).toHaveProperty('preSelectedTools');

      const keys = Object.keys(result.current);
      expect(keys).toEqual(['toolLimits', 'toolWarnings', 'preSelectedTools']);
    });
  });
});
