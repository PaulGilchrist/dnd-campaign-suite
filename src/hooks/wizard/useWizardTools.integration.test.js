// @maintained-by-ai
// Seam (test-suite trim, 2026-10):
// - Engine `useWizardConfig.test.js` owns generic config behaviour (slot state,
//   warnings, preSelect auto-merge mechanics incl. hasItems guards, error logging).
// - `useWizardTools.test.js` owns mock-engine wiring: the config object shape passed
//   to useWizardConfig and unit behaviour of the preSelect merge closure.
// - THIS file only smokes that the wrapper's config RUNS through the real engine +
//   real toolValidation service (dataLoader mocked): one 2024 end-to-end smoke plus
//   the wrapper-specific 5e short-circuit. Merge/dedup semantics and engine
//   mechanics are asserted there, not here.
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

describe('useWizardTools - wiring smoke through the real engine', () => {
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

  it('2024: loads 2024 data, exposes limits and pre-selected tools, and merges them via setFormData', async () => {
    const { result } = renderTools();

    // Slot path: class choose-string parsed to category limits by the real
    // toolValidation service and surfaced through the engine's slot state.
    await waitFor(() => {
      expect(result.current.toolLimits).not.toBeNull();
    });
    expect(result.current.toolLimits.categoryLimits).toBeInstanceOf(Map);
    expect(result.current.toolLimits.categoryLimits.get('Musical Instrument')).toBe(3);

    // Pre-select path: fixed background tool reaches preSelectedTools and the
    // engine invokes setFormData with the wrapper's merge.
    await waitFor(() => {
      expect(result.current.preSelectedTools).toContain("Calligrapher's Supplies");
      expect(mockSetFormData).toHaveBeenCalled();
    });

    expect(fetchBackgroundData).toHaveBeenCalledWith('Acolyte', '2024');
    expect(fetchClassData).toHaveBeenCalledWith('Bard', '2024');

    const mergeCall = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    expect(typeof mergeCall).toBe('function');
    const merged = mergeCall({ toolProficiencies: ['Herbalism Kit'] });
    expect(merged.toolProficiencies).toContain('Herbalism Kit');
    expect(merged.toolProficiencies).toContain("Calligrapher's Supplies");

    // Wrapper output envelope.
    expect(Object.keys(result.current).sort()).toEqual(['preSelectedTools', 'toolLimits', 'toolWarnings']);
  });

  it('5e: short-circuits — no dataLoader calls, empty limits, no setFormData', async () => {
    const { result } = renderTools(createFormData5e());

    await waitFor(() => {
      expect(result.current.toolLimits).not.toBeNull();
    });

    expect(result.current.toolLimits.categoryLimits).toBeInstanceOf(Map);
    expect(result.current.toolLimits.categoryLimits.size).toBe(0);
    expect(result.current.preSelectedTools).toEqual([]);
    expect(result.current.toolWarnings).toEqual([]);
    expect(fetchBackgroundData).not.toHaveBeenCalled();
    expect(fetchClassData).not.toHaveBeenCalled();
    expect(loadFeatData).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
  });
});
