// @improved-by-ai
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

    it('sets isNextDisabled to false initially', () => {
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

    it('goes to the previous step', async () => {
      const { result } = renderWizard(3);

      await waitFor(() => {
        expect(result.current.isNextDisabled).toBeDefined();
      });

      act(() => {
        result.current.navigatePrevious();
      });

      expect(result.current.currentStep).toBe(2);
    });

    it('jumps to an arbitrary step via goToStep', async () => {
      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(true).toBe(true);
      });

      act(() => {
        result.current.goToStep(5);
      });

      expect(result.current.currentStep).toBe(5);
    });

    it('allows setCurrentStep to set an arbitrary step', async () => {
      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(true).toBe(true);
      });

      act(() => {
        result.current.setCurrentStep(7);
      });

      expect(result.current.currentStep).toBe(7);
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

    it('is false when the current step has no validation errors', async () => {
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

      act(() => {
        result.current.goToStep(2);
      });

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

    it('allows step 2 when ruleset is provided', async () => {
      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(result.current.getStepEnabled(2)).toBe(true);
      });
    });

    it('blocks step 2 when ruleset is missing', async () => {
      const { result } = renderWizard(1, mockFormData, mockRacesData, mockClassSubtypes, null);

      await waitFor(() => {
        expect(result.current.getStepEnabled(2)).toBe(false);
      });
    });

    it('allows step 3 when step 1 and step 2 are valid', async () => {
      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(result.current.getStepEnabled(3)).toBe(true);
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

    it('blocks step 3 when step 2 is not yet validated', async () => {
      validateStep.mockImplementation(async (step) => {
        if (step === 2) {
          await new Promise((r) => setTimeout(r, 50));
          return {};
        }
        return {};
      });

      const { result } = renderWizard(1);

      // step2Valid starts false, so step 3 should be blocked initially
      expect(result.current.getStepEnabled(3)).toBe(false);
    });

    it('blocks steps 4+ when step 3 has validation errors', async () => {
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

    it('blocks steps 4+ when a subclass is required but not selected', async () => {
      const localFormData = { ...mockFormData, class: { name: 'Barbarian' } };
      const localClassSubtypes = [
        { className: 'Barbarian', subtypes: [{ name: 'Path of the Berserker' }] },
      ];

      const { result } = renderWizard(1, localFormData, mockRacesData, localClassSubtypes, mockRuleset);

      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(false);
        expect(result.current.getStepEnabled(5)).toBe(false);
      });
    });

    it('allows steps 4+ when all prerequisites are satisfied', async () => {
      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(true);
        expect(result.current.getStepEnabled(5)).toBe(true);
        expect(result.current.getStepEnabled(12)).toBe(true);
      });
    });

    it('blocks steps 4+ when a subrace is required but not selected', async () => {
      const localFormData = { ...mockFormData, race: { name: 'Elf', subrace: {} } };
      const localRacesData = [
        { name: 'Elf', subraces: [{ name: 'High Elf' }] },
      ];

      const { result } = renderWizard(1, localFormData, localRacesData, mockClassSubtypes, mockRuleset);

      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(false);
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

    it('is false when step 2 is invalid', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 2) return { background: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);

      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });

    it('is false when a subclass is required but not selected', async () => {
      const localFormData = { ...mockFormData, class: { name: 'Barbarian' } };
      const localClassSubtypes = [
        { className: 'Barbarian', subtypes: [{ name: 'Path of the Berserker' }] },
      ];

      const { result } = renderWizard(1, localFormData, mockRacesData, localClassSubtypes, mockRuleset);

      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });

    it('is false when a subrace is required but not selected', async () => {
      const localFormData = { ...mockFormData, race: { name: 'Elf', subrace: {} } };
      const localRacesData = [
        { name: 'Elf', subraces: [{ name: 'High Elf' }] },
      ];

      const { result } = renderWizard(1, localFormData, localRacesData, mockClassSubtypes, mockRuleset);

      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });

    it('is false when ruleset is missing', async () => {
      const { result } = renderWizard(1, mockFormData, mockRacesData, mockClassSubtypes, null);

      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });

    it('is false when class data has not loaded', async () => {
      const { result } = renderWizard(1, mockFormData, mockRacesData, [], mockRuleset);

      await waitFor(() => {
        expect(result.current.isSaveEnabled).toBe(false);
      });
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderWizard();

      expect(result.current).toHaveProperty('currentStep');
      expect(result.current).toHaveProperty('isNextDisabled');
      expect(result.current).toHaveProperty('navigateNext');
      expect(result.current).toHaveProperty('navigatePrevious');
      expect(result.current).toHaveProperty('goToStep');
      expect(result.current).toHaveProperty('setCurrentStep');
      expect(result.current).toHaveProperty('getStepEnabled');
      expect(result.current).toHaveProperty('isSaveEnabled');
    });

    it('returns functions with correct types', () => {
      const { result } = renderWizard();

      expect(typeof result.current.navigateNext).toBe('function');
      expect(typeof result.current.navigatePrevious).toBe('function');
      expect(typeof result.current.goToStep).toBe('function');
      expect(typeof result.current.setCurrentStep).toBe('function');
      expect(typeof result.current.getStepEnabled).toBe('function');
    });

    it('returns boolean primitives for state flags', () => {
      const { result } = renderWizard();

      expect(typeof result.current.isNextDisabled).toBe('boolean');
      expect(typeof result.current.isSaveEnabled).toBe('boolean');
    });
  });
});
