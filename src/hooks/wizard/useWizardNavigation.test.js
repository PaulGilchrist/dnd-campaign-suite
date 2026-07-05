// @cleaned-by-ai
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardNavigation from './useWizardNavigation.js';
import { validateStep } from '../../config/utils.js';

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(),
}));

describe('useWizardNavigation', () => {
  const mockFormData = {
    name: 'Test Character',
    level: 1,
    race: { name: 'Human' },
    class: { name: 'Fighter' },
  };
  const mockRacesData = [{ name: 'Human', subraces: [] }];
  const mockClassSubtypes = [{ className: 'Fighter', subtypes: [] }];
  const mockRuleset = '5e';

  beforeEach(() => {
    vi.clearAllMocks();
    validateStep.mockResolvedValue({});
  });

  function renderWizard(step = 1, formData = mockFormData, races = mockRacesData, classes = mockClassSubtypes, ruleset = mockRuleset) {
    return renderHook(() => useWizardNavigation(step, formData, races, classes, ruleset));
  }

  describe('initialization', () => {
    it('sets currentStep to the initial value', () => {
      const { result } = renderWizard(3);
      expect(result.current.currentStep).toBe(3);
    });

    it('starts with isNextDisabled false', () => {
      const { result } = renderWizard();
      expect(result.current.isNextDisabled).toBe(false);
    });
  });

  describe('navigation', () => {
    it('advances to the next step when validation passes', async () => {
      const { result } = renderWizard(1);
      validateStep.mockResolvedValue({});

      await act(async () => {
        const success = await result.current.navigateNext();
        expect(success).toBe(true);
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('stays on the current step when validation fails', async () => {
      const { result } = renderWizard(1);
      validateStep.mockResolvedValue({ name: 'Required field' });

      await act(async () => {
        const success = await result.current.navigateNext();
        expect(success).toBe(false);
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('goes to the previous step', () => {
      const { result } = renderWizard(3);
      act(() => result.current.navigatePrevious());
      expect(result.current.currentStep).toBe(2);
    });

    it('jumps to an arbitrary step via goToStep', () => {
      const { result } = renderWizard(1);
      act(() => result.current.goToStep(5));
      expect(result.current.currentStep).toBe(5);
    });
  });

  describe('isNextDisabled', () => {
    it('is true when the current step has validation errors', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 1) return { race: 'Race is required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(true);
      });
    });

    it('is false when there are no validation errors', async () => {
      validateStep.mockResolvedValue({});
      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });
    });

    it('updates when currentStep changes', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 1) return {};
        if (step === 2) return { alignment: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });

      act(() => result.current.goToStep(2));
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(true);
      });
    });
  });

  describe('getStepEnabled', () => {
    it('always allows step 1', async () => {
      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(1)).toBe(true);
      });
    });

    it('blocks step 2 when ruleset is missing', async () => {
      const { result } = renderWizard(1, mockFormData, mockRacesData, mockClassSubtypes, null);
      await waitFor(() => {
        expect(result.current.getStepEnabled(2)).toBe(false);
      });
    });

    it('blocks step 3 when step 2 has validation errors', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 2) return { background: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(3)).toBe(false);
      });
    });

    it('blocks step 3 when step 2 has not yet validated asynchronously', () => {
      validateStep.mockImplementation(async (step) => {
        if (step === 2) {
          await new Promise((r) => setTimeout(r, 50));
          return {};
        }
        return {};
      });

      const { result } = renderWizard(1);
      expect(result.current.getStepEnabled(3)).toBe(false);
    });

    it('blocks steps 4+ when step 3 prerequisites are not met', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 3) return { subclass: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(false);
      });
    });

    it('blocks steps 4+ when class data has not loaded', async () => {
      const { result } = renderWizard(1, mockFormData, mockRacesData, [], mockRuleset);
      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(false);
      });
    });

    it('allows steps 4+ when all prerequisites are satisfied', async () => {
      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(true);
        expect(result.current.getStepEnabled(5)).toBe(true);
      });
    });
  });

  describe('isSaveEnabled', () => {
    it('is true when all steps are valid', async () => {
      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(true);
      });
    });

    it('is false when validation errors exist', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 2) return { background: 'Required' };
        return {};
      });
      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });
  });
});
