import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardNavigation from './use-wizard-navigation';

// Mock the validateStep function
vi.mock('./utils', () => ({
  validateStep: vi.fn()
}));

import { validateStep } from './utils';

describe('useWizardNavigation', () => {
  const mockFormData = {
    name: 'Test Character',
    level: 1,
    race: { name: 'Human' },
    class: { name: 'Fighter' }
  };
  const mockRacesData = [];
  const mockClassSubtypes = [];
  const mockRuleset = '5e';

  beforeEach(() => {
    vi.clearAllMocks();
    validateStep.mockResolvedValue({});
   });

  it('should initialize with the correct step', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    expect(result.current.currentStep).toBe(1);
   });

  it('should return all navigation methods', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    expect(result.current).toHaveProperty('currentStep');
    expect(result.current).toHaveProperty('isNextDisabled');
    expect(result.current).toHaveProperty('navigateNext');
    expect(result.current).toHaveProperty('navigatePrevious');
    expect(result.current).toHaveProperty('goToStep');
    expect(result.current).toHaveProperty('setCurrentStep');
   });

  it('should navigate to next step when validation passes', async () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await result.current.navigateNext();
     });

    expect(result.current.currentStep).toBe(2);
   });

  it('should not navigate to next step when validation fails', async () => {
    validateStep.mockResolvedValue({ name: 'Required field' });

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await result.current.navigateNext();
     });

    expect(result.current.currentStep).toBe(1);
   });

  it('should navigate to previous step', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(2, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    act(() => {
      result.current.navigatePrevious();
     });

    expect(result.current.currentStep).toBe(1);
   });

  it('should go to a specific step', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    act(() => {
      result.current.goToStep(5);
     });

    expect(result.current.currentStep).toBe(5);
   });

  it('should disable next button when validation fails', async () => {
    validateStep.mockResolvedValue({ name: 'Required field' });

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      // Wait for useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0));
     });

    expect(result.current.isNextDisabled).toBe(true);
   });

  it('should enable next button when validation passes', async () => {
    validateStep.mockResolvedValue({});

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      // Wait for useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0));
     });

    expect(result.current.isNextDisabled).toBe(false);
   });
});
