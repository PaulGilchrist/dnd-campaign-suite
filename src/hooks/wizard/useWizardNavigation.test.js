// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
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
    return renderHook(
      ({ step: s, formData: f, races: r, classes: c, ruleset: rl }) => useWizardNavigation(s, f, r, { classSubtypes: c, ruleset: rl }),
      { initialProps: { step, formData, races, classes, ruleset } }
    );
  }

  describe('initialization', () => {
    it('sets currentStep to the initial value', () => {
      const { result } = renderWizard(3);
      expect(result.current.currentStep).toBe(3);
    });

    it('navigates to the next step when validation passes', async () => {
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

    it('navigates to the previous step', () => {
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

    it('updates when formData changes affecting validation', async () => {
      const state = { hasError: false };
      validateStep.mockImplementation((step) => {
        if (step === 2 && state.hasError) return { name: 'Required' };
        return {};
      });

      const initialFormData = { ...mockFormData, name: 'Valid Name' };
      const { result, rerender } = renderWizard(2, initialFormData);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });

      state.hasError = true;
      const newFormData = { ...mockFormData, name: '' };
      rerender({ step: 2, formData: newFormData, races: mockRacesData, classes: mockClassSubtypes, ruleset: mockRuleset });
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      expect(result.current.isNextDisabled).toBe(true);
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

    it('blocks step 5 when step 4 prerequisites are not met', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 4) return { subrace: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(5)).toBe(false);
      });
    });

    it('blocks step 6 when step 5 prerequisites are not met', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 5) return { background: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(6)).toBe(false);
      });
    });

    it('blocks step 7 when step 6 prerequisites are not met', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 6) return { class: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(7)).toBe(false);
      });
    });

    it('uses step7Valid for unknown step numbers', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 7) return { subclass: 'Required' };
        return {};
      });

      const { result } = renderWizard(1);
      await waitFor(() => {
        expect(result.current.getStepEnabled(8)).toBe(false);
      });
    });
  });

  describe('step4Valid - subrace selection', () => {
    it('allows step 4 when race has subraces and subrace is selected', async () => {
      const formDataWithSubrace = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human', subrace: { name: 'Lightfoot' } },
        class: { name: 'Fighter' },
      };
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(1, formDataWithSubrace, racesWithSubraces, mockClassSubtypes, mockRuleset);
      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(true);
      });
    });

    it('blocks step 4 when race has subraces but no subrace selected', async () => {
      const formDataNoSubrace = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(1, formDataNoSubrace, racesWithSubraces, mockClassSubtypes, mockRuleset);
      await waitFor(() => {
        expect(result.current.getStepEnabled(4)).toBe(false);
      });
    });

    it('isNextDisabled is false on step 4 when subrace is selected', async () => {
      const formDataWithSubrace = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human', subrace: { name: 'Lightfoot' } },
        class: { name: 'Fighter' },
      };
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(4, formDataWithSubrace, racesWithSubraces, mockClassSubtypes, mockRuleset);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });
    });

    it('isNextDisabled is true on step 4 when subrace is not selected', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 4) return { subrace: 'Required' };
        return {};
      });
      const formDataNoSubrace = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(4, formDataNoSubrace, racesWithSubraces, mockClassSubtypes, mockRuleset);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(true);
      });
    });
  });

  describe('step5Valid - 2024 ruleset background', () => {
    it('allows step 5 when 2024 ruleset and background is provided', async () => {
      const formDataWithBackground = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        background: 'Soldier',
        class: { name: 'Fighter' },
      };
      const { result } = renderWizard(1, formDataWithBackground, mockRacesData, mockClassSubtypes, '2024');
      await waitFor(() => {
        expect(result.current.getStepEnabled(5)).toBe(true);
      });
    });

    it('blocks step 5 when 2024 ruleset and no background provided', async () => {
      const formDataNoBackground = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const { result } = renderWizard(1, formDataNoBackground, mockRacesData, mockClassSubtypes, '2024');
      await waitFor(() => {
        expect(result.current.getStepEnabled(5)).toBe(false);
      });
    });

    it('allows step 5 for 5e ruleset regardless of background', async () => {
      const formDataNoBackground = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const { result } = renderWizard(1, formDataNoBackground, mockRacesData, mockClassSubtypes, '5e');
      await waitFor(() => {
        expect(result.current.getStepEnabled(5)).toBe(true);
      });
    });

    it('isNextDisabled is true on step 5 for 2024 without background', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 5) return { background: 'Required' };
        return {};
      });
      const formDataNoBackground = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const { result } = renderWizard(5, formDataNoBackground, mockRacesData, mockClassSubtypes, '2024');
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(true);
      });
    });

    it('isNextDisabled is false on step 5 for 2024 with background', async () => {
      const formDataWithBackground = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        background: 'Soldier',
        class: { name: 'Fighter' },
      };
      const { result } = renderWizard(5, formDataWithBackground, mockRacesData, mockClassSubtypes, '2024');
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });
    });
  });

  describe('step7Valid - subclass selection', () => {
    it('allows step 7 when class has subclasses and subclass is selected', async () => {
      const formDataWithSubclass = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter', subclass: { name: 'Champion' } },
      };
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const { result } = renderWizard(1, formDataWithSubclass, mockRacesData, classesWithSubclasses, mockRuleset);
      await waitFor(() => {
        expect(result.current.getStepEnabled(7)).toBe(true);
      });
    });

    it('blocks step 7 when class has subclasses but no subclass selected', async () => {
      const formDataNoSubclass = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const { result } = renderWizard(1, formDataNoSubclass, mockRacesData, classesWithSubclasses, mockRuleset);
      await waitFor(() => {
        expect(result.current.getStepEnabled(7)).toBe(false);
      });
    });

    it('isNextDisabled is false on step 7 when subclass is selected', async () => {
      const formDataWithSubclass = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter', subclass: { name: 'Champion' } },
      };
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const { result } = renderWizard(7, formDataWithSubclass, mockRacesData, classesWithSubclasses, mockRuleset);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(false);
      });
    });

    it('isNextDisabled is true on step 7 when subclass is not selected', async () => {
      validateStep.mockImplementation((step) => {
        if (step === 7) return { subclass: 'Required' };
        return {};
      });
      const formDataNoSubclass = {
        name: 'Test Character',
        level: 1,
        race: { name: 'Human' },
        class: { name: 'Fighter' },
      };
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const { result } = renderWizard(7, formDataNoSubclass, mockRacesData, classesWithSubclasses, mockRuleset);
      await waitFor(() => {
        expect(result.current.isNextDisabled).toBe(true);
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

    it('is false when step 2 has validation errors', async () => {
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
