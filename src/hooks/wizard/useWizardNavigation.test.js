import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardNavigation from './useWizardNavigation.js';

// Mock the validateStep function
vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn()
}));

import { validateStep } from '../../config/utils.js';

describe('useWizardNavigation', () => {
  const mockFormData = {
    name: 'Test Character',
    level: 1,
    race: { name: 'Human' },
    class: { name: 'Fighter' }
  };
  const mockRacesData = [{ name: 'Human', subraces: [] }];
  const mockClassSubtypes = [{ className: 'Fighter', subtypes: [] }];
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
    expect(result.current).toHaveProperty('getStepEnabled');
    expect(result.current).toHaveProperty('isSaveEnabled');
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

  it('should return getStepEnabled function', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    expect(typeof result.current.getStepEnabled).toBe('function');
   });

  it('should return isSaveEnabled', () => {
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    expect(result.current).toHaveProperty('isSaveEnabled');
   });

  it('getStepEnabled should allow steps 1-2 regardless of validation', async () => {
    // Both step 2 and 3 have validation errors
    validateStep.mockImplementation((step) => {
      if (step === 2) return Promise.resolve({ background: 'Required' });
      if (step === 3) return Promise.resolve({ subclass: 'Required' });
      return Promise.resolve({});
    });

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(1)).toBe(true);
    expect(result.current.getStepEnabled(2)).toBe(true);
   });

  it('getStepEnabled should block step 3 when step 2 is invalid', async () => {
    // Step 2 has errors, step 3 is valid
    validateStep.mockImplementation((step) => {
      if (step === 2) return Promise.resolve({ background: 'Background is required' });
      return Promise.resolve({});
    });

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(3)).toBe(false);
   });

  it('getStepEnabled should allow step 3 when step 2 is valid', async () => {
    // All steps pass validation
    validateStep.mockResolvedValue({});

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(3)).toBe(true);
   });

  it('getStepEnabled should block steps 4+ when class data has not loaded yet', async () => {
    // Class 'Fighter' is not found in empty classSubtypes → sidebarStep3Valid = false
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, [], mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(4)).toBe(false);
   });

  it('getStepEnabled should allow steps 4+ when all step 3 requirements are satisfied', async () => {
    // Fighter has no subtypes, so no subclass needed → sidebarStep3Valid = true
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(4)).toBe(true);
   });

  it('getStepEnabled should block steps 4+ when a subclass is required but not selected', async () => {
    const localFormData = {
      ...mockFormData,
      class: { name: 'Barbarian' }
    };
    const localClassSubtypes = [
      { className: 'Barbarian', subtypes: [{ name: 'Path of the Berserker' }] }
    ];

    const { result } = renderHook(() =>
      useWizardNavigation(1, localFormData, mockRacesData, localClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // sidebarStep3Valid: Barbarian found, has subtypes, but no subclass selected → false
    expect(result.current.getStepEnabled(4)).toBe(false);
    expect(result.current.getStepEnabled(5)).toBe(false);
    expect(result.current.getStepEnabled(12)).toBe(false);
   });

  it('getStepEnabled should allow steps 4+ when step 3 is valid', async () => {
    // Default mocks have Fighter with no subtypes → no subclass needed → sidebarStep3Valid = true
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.getStepEnabled(4)).toBe(true);
    expect(result.current.getStepEnabled(5)).toBe(true);
    expect(result.current.getStepEnabled(12)).toBe(true);
   });

  it('isSaveEnabled should be false when step 2 is invalid', async () => {
    // Step 2 has errors, step 3 passes
    validateStep.mockImplementation((step) => {
      if (step === 2) return Promise.resolve({ background: 'Required' });
      return Promise.resolve({});
    });

    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isSaveEnabled).toBe(false);
   });

  it('isSaveEnabled should be false when a subclass is required but not selected', async () => {
    const localFormData = {
      ...mockFormData,
      class: { name: 'Barbarian' }
    };
    const localClassSubtypes = [
      { className: 'Barbarian', subtypes: [{ name: 'Path of the Berserker' }] }
    ];

    const { result } = renderHook(() =>
      useWizardNavigation(1, localFormData, mockRacesData, localClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isSaveEnabled).toBe(false);
   });

  it('isSaveEnabled should be true when all required fields are valid', async () => {
    // Default mock: validateStep returns {} for all steps
    // sidebarStep3Valid: Fighter found, no subtypes → true
    const { result } = renderHook(() =>
      useWizardNavigation(1, mockFormData, mockRacesData, mockClassSubtypes, mockRuleset)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isSaveEnabled).toBe(true);
   });
});
