// @maintained-by-ai
// Contract tests for useWizardNavigation. validateStep is mocked at the module
// boundary — its own rules are covered in src/config/utils.test.js — and the
// ruleset walk-skipping (5e skips Background) is covered in WizardStepNumbering.test.jsx.
// Step enablement semantics: getStepEnabled(N) = every step BEFORE N is valid
// (validPrefixes[N-1]); steps 8+ fall back to the full chain (isSaveEnabled).
// Negative assertions flush microtasks first so they cannot pass off the
// initial `step2Valid=false` state as the scenario's outcome.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardNavigation from './useWizardNavigation.js';
import { validateStep } from '../../config/utils.js';

vi.mock('../../config/utils.js', () => {
  const validateStep = vi.fn(() => Promise.resolve({}));
  return { validateStep };
});

// All mocked validateStep promises settle within a couple of microtasks,
// so flushing leaves every derived flag in its final state.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const formDataWith = (overrides = {}) => ({
  name: 'Test Character',
  level: 1,
  race: { name: 'Human' },
  class: { name: 'Fighter' },
  ...overrides,
});

describe('useWizardNavigation', () => {
  const mockRacesData = [{ name: 'Human', subraces: [] }];
  const mockClassSubtypes = [{ className: 'Fighter', subtypes: [] }];

  beforeEach(() => {
    vi.clearAllMocks();
    validateStep.mockResolvedValue({});
  });

  function renderWizard(step = 1, formData = formDataWith(), races = mockRacesData, classes = mockClassSubtypes, ruleset = '5e') {
    return renderHook(
      ({ step: s, formData: f, races: r, classes: c, ruleset: rl }) => useWizardNavigation(s, f, r, { classSubtypes: c, ruleset: rl }),
      { initialProps: { step, formData, races, classes, ruleset } }
    );
  }

  describe('step navigation', () => {
    it('sets currentStep to the initial value', () => {
      const { result } = renderWizard(3);
      expect(result.current.currentStep).toBe(3);
    });

    it('navigateNext returns true and advances one visible step when validation passes', async () => {
      const { result } = renderWizard(1);

      let success;
      await act(async () => {
        success = await result.current.navigateNext();
      });

      expect(success).toBe(true);
      expect(result.current.currentStep).toBe(2);
    });

    it('navigateNext returns false and stays put when the current step has errors', async () => {
      validateStep.mockResolvedValue({ name: 'Required field' });
      const { result } = renderWizard(1);

      let success;
      await act(async () => {
        success = await result.current.navigateNext();
      });

      expect(success).toBe(false);
      expect(result.current.currentStep).toBe(1);
    });

    it('navigatePrevious walks back and never goes before the first step', () => {
      const { result } = renderWizard(3);
      act(() => result.current.navigatePrevious());
      expect(result.current.currentStep).toBe(2);
      act(() => result.current.navigatePrevious());
      expect(result.current.currentStep).toBe(1);
      act(() => result.current.navigatePrevious());
      expect(result.current.currentStep).toBe(1);
    });

    it('jumps to an arbitrary step via goToStep', () => {
      const { result } = renderWizard(1);
      act(() => result.current.goToStep(5));
      expect(result.current.currentStep).toBe(5);
    });
  });

  describe('isNextDisabled', () => {
    it('is true while the current step has errors and clears once they are fixed', async () => {
      validateStep.mockResolvedValue({ name: 'Required' });
      const { result, rerender } = renderWizard(1);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(true);

      validateStep.mockResolvedValue({});
      rerender({ step: 1, formData: formDataWith(), races: mockRacesData, classes: mockClassSubtypes, ruleset: '5e' });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('revalidates the current step after goToStep changes the step', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { alignment: 'Required' } : {})
      );
      const { result } = renderWizard(2);
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(true);

      act(() => result.current.goToStep(3));
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('revalidates when formData identity changes', async () => {
      validateStep.mockImplementation((_step, formData) =>
        Promise.resolve(formData.name === '' ? { name: 'Required' } : {})
      );
      const { result, rerender } = renderWizard(1, formDataWith({ name: '' }));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(true);

      rerender({ step: 1, formData: formDataWith({ name: 'Fixed' }), races: mockRacesData, classes: mockClassSubtypes, ruleset: '5e' });
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(result.current.isNextDisabled).toBe(false);
    });
  });

  describe('getStepEnabled prefix chain', () => {
    it('always enables step 1, even without a ruleset', () => {
      const { result } = renderWizard(1, formDataWith(), mockRacesData, mockClassSubtypes, null);
      expect(result.current.getStepEnabled(1)).toBe(true);
    });

    it('blocks everything past step 1 when the ruleset is missing', () => {
      const { result } = renderWizard(1, formDataWith(), mockRacesData, mockClassSubtypes, null);
      expect(result.current.getStepEnabled(2)).toBe(false);
      expect(result.current.isSaveEnabled).toBe(false);
    });

    it('fails closed on step 3 while step 2 validation is still pending', () => {
      validateStep.mockImplementation((step) =>
        step === 2 ? new Promise(() => {}) : Promise.resolve({})
      );
      const { result } = renderWizard(1);
      expect(result.current.getStepEnabled(3)).toBe(false);
    });

    it('keeps step 3 blocked after step 2 resolves with errors', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { background: 'Required' } : {})
      );
      const { result } = renderWizard(1);
      await flush();
      expect(validateStep.mock.calls.some((c) => c[0] === 2)).toBe(true);
      expect(result.current.getStepEnabled(3)).toBe(false);
    });

    it('enables step 3 once step 2 validates clean', async () => {
      const { result } = renderWizard(1);
      await flush();
      expect(result.current.getStepEnabled(3)).toBe(true);
    });

    it('blocks step 4 when no race is chosen, while step 3 stays navigable', async () => {
      const { result } = renderWizard(1, formDataWith({ race: undefined }));
      await flush();
      expect(result.current.getStepEnabled(3)).toBe(true);
      expect(result.current.getStepEnabled(4)).toBe(false);
    });

    it('blocks step 5 when the race has subraces but none is selected, while step 4 stays navigable', async () => {
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(1, formDataWith(), racesWithSubraces);
      await flush();
      expect(result.current.getStepEnabled(4)).toBe(true);
      expect(result.current.getStepEnabled(5)).toBe(false);
    });

    it('enables step 5 once a required subrace is selected', async () => {
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];
      const { result } = renderWizard(1, formDataWith({ race: { name: 'Human', subrace: { name: 'Lightfoot' } } }), racesWithSubraces);
      await flush();
      expect(result.current.getStepEnabled(5)).toBe(true);
    });

    it('requires background only on the 2024 ruleset', async () => {
      validateStep.mockResolvedValue({});
      const noBg2024 = renderWizard(1, formDataWith(), mockRacesData, mockClassSubtypes, '2024');
      await flush();
      expect(noBg2024.result.current.getStepEnabled(5)).toBe(true);
      expect(noBg2024.result.current.getStepEnabled(6)).toBe(false);
      expect(noBg2024.result.current.isSaveEnabled).toBe(false);

      const withBg2024 = renderWizard(1, formDataWith({ background: 'Soldier' }), mockRacesData, mockClassSubtypes, '2024');
      await flush();
      expect(withBg2024.result.current.getStepEnabled(6)).toBe(true);

      const noBg5e = renderWizard(1, formDataWith(), mockRacesData, mockClassSubtypes, '5e');
      await flush();
      expect(noBg5e.result.current.getStepEnabled(6)).toBe(true);
    });

    it('blocks step 7 when no class is chosen', async () => {
      const { result } = renderWizard(1, formDataWith({ class: undefined }));
      await flush();
      expect(result.current.getStepEnabled(6)).toBe(true);
      expect(result.current.getStepEnabled(7)).toBe(false);
    });

    it('blocks save and step 8 when the class has subclasses but none is selected', async () => {
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const { result } = renderWizard(1, formDataWith(), mockRacesData, classesWithSubclasses);
      await flush();
      expect(result.current.getStepEnabled(7)).toBe(true);
      expect(result.current.getStepEnabled(8)).toBe(false);
      expect(result.current.isSaveEnabled).toBe(false);
    });

    it('blocks save when class subtype data has not loaded', async () => {
      const { result } = renderWizard(1, formDataWith(), mockRacesData, []);
      await flush();
      expect(result.current.getStepEnabled(7)).toBe(true);
      expect(result.current.isSaveEnabled).toBe(false);
    });

    it('enables save when every prerequisite holds; unknown and non-integer steps fall back to that chain', async () => {
      const { result } = renderWizard(1);
      await flush();
      expect(result.current.isSaveEnabled).toBe(true);
      expect(result.current.getStepEnabled(8)).toBe(true);
      expect(result.current.getStepEnabled(3.5)).toBe(true);
      expect(result.current.getStepEnabled('nonsense')).toBe(true);
    });
  });

  describe('isSaveEnabled', () => {
    it('is false while basic information (step 2) is invalid', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { background: 'Required' } : {})
      );
      const { result } = renderWizard(1);
      await flush();
      expect(result.current.isSaveEnabled).toBe(false);
    });
  });
});
