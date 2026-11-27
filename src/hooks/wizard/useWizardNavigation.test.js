// @maintained-by-ai 2026-11-26
// Contract tests for useWizardNavigation. validateStep is mocked at the module
// boundary — its own rules are covered in src/config/utils.test.js — and the
// ruleset walk-skipping (5e skips Background) is covered in WizardStepNumbering.test.jsx.
// Step enablement semantics: getStepEnabled(N) = every step BEFORE N is valid
// (validPrefixes[N-1]); steps 8+ (and non-integer steps) fall back to the full
// chain (isSaveEnabled). IsSaveEnabled has no separate describe: it is the
// last link of the same prefix chain and is pinned inside these tests.
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

  const rerenderWizard = (rerender, formData = formDataWith()) =>
    rerender({ step: 1, formData, races: mockRacesData, classes: mockClassSubtypes, ruleset: '5e' });

  describe('step navigation', () => {
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

    it('starts on the initial step and navigatePrevious walks back, clamping at the first step', () => {
      const { result } = renderWizard(3);
      expect(result.current.currentStep).toBe(3);
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
    it('is true while the current step has errors and clears once the data is fixed', async () => {
      // Data-driven mock: the fix is a formData change (new identity), which
      // is also what revalidation must key off — no mock swap needed.
      validateStep.mockImplementation((_step, formData) =>
        Promise.resolve(formData.name === '' ? { name: 'Required' } : {})
      );
      const { result, rerender } = renderWizard(1, formDataWith({ name: '' }));
      await flush();
      expect(result.current.isNextDisabled).toBe(true);

      rerenderWizard(rerender, formDataWith({ name: 'Fixed' }));
      await flush();
      expect(result.current.isNextDisabled).toBe(false);
    });

    it('revalidates the current step after goToStep changes the step', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { alignment: 'Required' } : {})
      );
      const { result } = renderWizard(2);
      await flush();
      expect(result.current.isNextDisabled).toBe(true);

      act(() => result.current.goToStep(3));
      await flush();
      expect(result.current.isNextDisabled).toBe(false);
    });
  });

  describe('getStepEnabled prefix chain', () => {
    it('a missing ruleset leaves only step 1 enabled and blocks Save', () => {
      const { result } = renderWizard(1, formDataWith(), mockRacesData, mockClassSubtypes, null);
      expect(result.current.getStepEnabled(1)).toBe(true);
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

    it('gates step 3 and Save on step 2 validation: errors block, clean resolves unblock', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { background: 'Required' } : {})
      );
      const blocked = renderWizard(1);
      await flush();
      expect(blocked.result.current.getStepEnabled(3)).toBe(false);
      expect(blocked.result.current.isSaveEnabled).toBe(false);

      validateStep.mockResolvedValue({});
      const clear = renderWizard(1);
      await flush();
      expect(clear.result.current.getStepEnabled(3)).toBe(true);
      expect(clear.result.current.isSaveEnabled).toBe(true);
    });

    it.each([
      { label: 'race', formData: formDataWith({ race: undefined }), enabledPrior: 3, blockedStep: 4 },
      { label: 'class', formData: formDataWith({ class: undefined }), enabledPrior: 6, blockedStep: 7 },
    ])('blocks step $blockedStep while no $label is chosen (step $enabledPrior stays navigable)', async ({ formData, enabledPrior, blockedStep }) => {
      const { result } = renderWizard(1, formData);
      await flush();
      expect(result.current.getStepEnabled(enabledPrior)).toBe(true);
      expect(result.current.getStepEnabled(blockedStep)).toBe(false);
    });

    it('requires a subrace pick when the race has subraces, and clears once one is selected', async () => {
      const racesWithSubraces = [{ name: 'Human', subraces: [{ name: 'Lightfoot' }, { name: 'Mountain' }] }];

      const unselected = renderWizard(1, formDataWith(), racesWithSubraces);
      await flush();
      expect(unselected.result.current.getStepEnabled(4)).toBe(true);
      expect(unselected.result.current.getStepEnabled(5)).toBe(false);

      const selected = renderWizard(1, formDataWith({ race: { name: 'Human', subrace: { name: 'Lightfoot' } } }), racesWithSubraces);
      await flush();
      expect(selected.result.current.getStepEnabled(5)).toBe(true);
    });

    it('requires background only on the 2024 ruleset', async () => {
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

    it.each([
      { label: 'no subclass is selected', classes: [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }] },
      { label: 'subtype data has not loaded', classes: [] },
    ])('blocks step 8 and Save when $label (step 7 stays navigable)', async ({ classes }) => {
      const { result } = renderWizard(1, formDataWith(), mockRacesData, classes);
      await flush();
      expect(result.current.getStepEnabled(7)).toBe(true);
      expect(result.current.getStepEnabled(8)).toBe(false);
      expect(result.current.isSaveEnabled).toBe(false);
    });

    it('blocks save when the chosen subclass name is absent from the CURRENT ruleset list (stale switch pick), and clears once re-picked', async () => {
      const classesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
      const stale = renderWizard(1, formDataWith({ class: { name: 'Fighter', subclass: { name: 'Martial Warrior' } } }), mockRacesData, classesWithSubclasses);
      await flush();
      expect(stale.result.current.getStepEnabled(8)).toBe(false);
      expect(stale.result.current.isSaveEnabled).toBe(false);

      const repicked = renderWizard(1, formDataWith({ class: { name: 'Fighter', subclass: { name: 'Champion' } } }), mockRacesData, classesWithSubclasses);
      await flush();
      expect(repicked.result.current.isSaveEnabled).toBe(true);
    });

    it('enables save when every prerequisite holds; unknown and non-integer steps fall back to that chain; the ladder reports no blocker', async () => {
      const { result } = renderWizard(1);
      await flush();
      expect(result.current.isSaveEnabled).toBe(true);
      expect(result.current.getStepEnabled(8)).toBe(true);
      expect(result.current.getStepEnabled(3.5)).toBe(true);
      expect(result.current.getStepEnabled('nonsense')).toBe(true);
      expect(result.current.firstInvalidStep).toBe(null);
    });
  });

  describe('firstInvalidStep (cause label for ladder-disabled controls)', () => {
    it('names the 2024-only Background step when a no-background switch blocks the ladder, and clears to null once picked', async () => {
      // Exactly the 5e→2024 edit-switch face: every carried row is valid and
      // the newly required Background step is the one thing missing.
      const blocked = renderWizard(2, formDataWith(), mockRacesData, mockClassSubtypes, '2024');
      await flush();
      expect(blocked.result.current.firstInvalidStep).toBe(5);
      // The blocking step itself stays navigable; everything after it waits.
      expect(blocked.result.current.getStepEnabled(5)).toBe(true);
      expect(blocked.result.current.getStepEnabled(6)).toBe(false);
      expect(blocked.result.current.isSaveEnabled).toBe(false);

      const fixed = renderWizard(2, formDataWith({ background: 'Soldier' }), mockRacesData, mockClassSubtypes, '2024');
      await flush();
      expect(fixed.result.current.firstInvalidStep).toBe(null);
      expect(fixed.result.current.isSaveEnabled).toBe(true);
    });

    it('names the earliest failure when several steps are invalid', async () => {
      const { result } = renderWizard(1, formDataWith({ race: undefined }), mockRacesData, mockClassSubtypes, '2024');
      await flush();
      // Race (3) fails before Background (5) does.
      expect(result.current.firstInvalidStep).toBe(3);
    });

    it('names the async-validated Basic Information step when step 2 fails', async () => {
      validateStep.mockImplementation((step) =>
        Promise.resolve(step === 2 ? { name: 'Required' } : {})
      );
      const { result } = renderWizard(1);
      await flush();
      expect(result.current.firstInvalidStep).toBe(2);
    });
  });
});
