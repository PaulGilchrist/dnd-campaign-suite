import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardData from './use-wizard-data';

describe('useWizardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
     });

  it('should initialize with empty arrays', () => {
    const { result } = renderHook(() =>
      useWizardData('5e')
      );

    expect(result.current.backgrounds).toEqual([]);
    expect(result.current.racesData).toEqual([]);
    expect(result.current.classSubtypes).toEqual([]);
    expect(result.current.feats).toEqual([]);
    expect(result.current.magicItems).toEqual([]);
     });

  it('should load 5e data when ruleset is 5e', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockImplementation((url) => {
      if (url === '/data/races.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'Human' }])
         });
      } else if (url === '/data/classes.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'Fighter', subclasses: [] }])
         });
      } else if (url === '/data/feats.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
         });
      } else if (url === '/data/magic-items.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
         });
       }
      return Promise.resolve({ ok: false });
      });

    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useWizardData('5e')
      );

    await waitFor(() => {
      expect(result.current.racesData.length).toBeGreaterThan(0);
      });

    expect(result.current.racesData).toEqual([{ name: 'Human' }]);
    expect(result.current.classSubtypes).toEqual([
       { className: 'Fighter', subtypes: [] }
      ]);
    });

  it('should load 2024 data when ruleset is 2024', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockImplementation((url) => {
      if (url === '/data/2024/races.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'Human 2024' }])
         });
      } else if (url === '/data/2024/classes.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'Fighter', majors: [] }])
         });
      } else if (url === '/data/2024/backgrounds.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'Acolyte' }])
         });
      } else if (url === '/data/2024/feats.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
         });
      } else if (url === '/data/2024/magic-items.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
         });
       }
      return Promise.resolve({ ok: false });
      });

    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useWizardData('2024')
      );

    await waitFor(() => {
      expect(result.current.racesData.length).toBeGreaterThan(0);
      });

    expect(result.current.racesData).toEqual([{ name: 'Human 2024' }]);
    expect(result.current.backgrounds).toEqual([{ name: 'Acolyte' }]);
    });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardData('5e')
      );

    await waitFor(() => {
       // Data should remain empty on error
      expect(result.current.racesData).toEqual([]);
      });
    });

  it('should return isDataLoading as true when data is not loaded', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
      });

    const { result } = renderHook(() =>
      useWizardData('5e')
      );

    expect(result.current.isDataLoading).toBe(true);
    });

  it('should reload data when ruleset changes', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockImplementation((url) => {
      if (url.includes('2024')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: '2024 Data' }])
         });
       } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: '5e Data' }])
         });
       }
      });

    global.fetch = mockFetch;

    const { result, rerender } = renderHook(() =>
      useWizardData('5e')
      );

    await waitFor(() => {
      expect(result.current.racesData.length).toBeGreaterThan(0);
      });

    expect(result.current.racesData[0].name).toBe('5e Data');

    rerender();
    });
});
