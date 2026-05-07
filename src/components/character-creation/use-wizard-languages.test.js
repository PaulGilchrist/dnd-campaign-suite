import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardLanguages from './use-wizard-languages';

// Mock the languages validation services
vi.mock('../../services/languages-fightingstyles-validation.js', () => ({
  getLanguageLimits: vi.fn(),
  getFightingStyleLimits: vi.fn(),
  validateLanguagesAndFightingStyles: vi.fn()
}));

import {
  getLanguageLimits,
  getFightingStyleLimits,
  validateLanguagesAndFightingStyles
} from '../../services/languages-fightingstyles-validation.js';

describe('useWizardLanguages', () => {
  const mockFormData = {
    class: { name: 'Fighter', fightingStyles: ['Defense'] },
    race: { name: 'Human' },
    background: 'Soldier',
    languages: ['Common'],
    rules: '5e',
    level: 1
      };

  beforeEach(() => {
    vi.clearAllMocks();
    getLanguageLimits.mockResolvedValue({ maxLanguages: 2, preSelected: ['Common'] });
    getFightingStyleLimits.mockResolvedValue({ maxStyles: 1, preSelected: [] });
    validateLanguagesAndFightingStyles.mockResolvedValue([]);
      });

  it('should initialize with null limits and empty arrays', () => {
    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    expect(result.current.languageLimits).toBe(null);
    expect(result.current.fightingStyleLimits).toBe(null);
    expect(result.current.languageWarnings).toEqual([]);
    expect(result.current.preSelectedLanguages).toEqual([]);
    expect(result.current.preSelectedFightingStyles).toEqual([]);
      });

  it('should load language and fighting style limits', async () => {
    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    await waitFor(() => {
      expect(result.current.languageLimits).not.toBe(null);
        });

    expect(result.current.languageLimits).toEqual({ maxLanguages: 2, preSelected: ['Common'] });
    expect(result.current.fightingStyleLimits).toEqual({ maxStyles: 1, preSelected: [] });
      });

  it('should load pre-selected languages from limits', async () => {
    getLanguageLimits.mockResolvedValue({ maxLanguages: 2, preSelected: ['Common', 'Elvish'] });

    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    await waitFor(() => {
      expect(result.current.preSelectedLanguages.length).toBeGreaterThan(0);
        });

    expect(result.current.preSelectedLanguages).toEqual(['Common', 'Elvish']);
      });

  it('should load pre-selected fighting styles from limits', async () => {
    getFightingStyleLimits.mockResolvedValue({ maxStyles: 1, preSelected: ['Defense'] });

    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    await waitFor(() => {
      expect(result.current.preSelectedFightingStyles.length).toBeGreaterThan(0);
        });

    expect(result.current.preSelectedFightingStyles).toEqual(['Defense']);
      });

  it('should handle validation errors gracefully', async () => {
    validateLanguagesAndFightingStyles.mockRejectedValue(new Error('Validation error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    await waitFor(() => {
         // Should still have empty warnings even on error
      expect(result.current.languageWarnings).toEqual([]);
        });
      });

  it('should return all expected properties', () => {
    const { result } = renderHook(() =>
      useWizardLanguages(mockFormData)
        );

    expect(result.current).toHaveProperty('languageLimits');
    expect(result.current).toHaveProperty('fightingStyleLimits');
    expect(result.current).toHaveProperty('languageWarnings');
    expect(result.current).toHaveProperty('preSelectedLanguages');
    expect(result.current).toHaveProperty('preSelectedFightingStyles');
      });
});
