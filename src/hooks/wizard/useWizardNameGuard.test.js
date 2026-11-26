// @maintained-by-ai 2026-11-24
// Contract test for useWizardNameGuard: the touched-gated required hint, the
// live duplicate check, the guard-owned-error-only write discipline, and the
// (field, value) pass-through of the wrapped change handler. Deterministic
// against mocks — no DOM, network, or app internals involved. Parent value
// flow (typing then clearing) is simulated with rerender; the end-to-end
// render timing lives in CharacterCreationWizard.integration.test.jsx.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useWizardNameGuard from './useWizardNameGuard.js';
import { DUPLICATE_CHARACTER_NAME_ERROR, CHARACTER_NAME_REQUIRED_ERROR } from '../../config/utils.js';

function renderGuard(props = {}) {
  const setErrors = vi.fn();
  const updateField = vi.fn();
  const { result, rerender } = renderHook(
    ({ name, existingNames, errors }) =>
      useWizardNameGuard(name, existingNames, errors, setErrors, updateField),
    {
      initialProps: { name: '', existingNames: [], errors: {}, ...props },
    }
  );
  return { result, rerender, setErrors, updateField };
}

describe('useWizardNameGuard', () => {
  it('writes NOTHING on mount while an empty name is untouched (pristine arrival is silent)', () => {
    const { setErrors } = renderGuard();
    expect(setErrors).not.toHaveBeenCalled();
  });

  it('arms the required error only after blur marks the field touched', () => {
    const { result, setErrors } = renderGuard();
    act(() => result.current.handleNameBlur());
    expect(setErrors).toHaveBeenCalledWith({ name: CHARACTER_NAME_REQUIRED_ERROR });
  });

  it('marks the name touched on a name change (typed then cleared arms the required error)', () => {
    const { result, rerender, setErrors, updateField } = renderGuard({ name: 'Aragorn' });
    // Valid name on arrival: silent, and the value reaches updateField verbatim.
    expect(setErrors).not.toHaveBeenCalled();
    act(() => result.current.handleFieldChange('name', ''));
    expect(updateField).toHaveBeenCalledWith('name', '');
    // The parent applies the cleared value and re-renders the hook.
    setErrors.mockClear();
    rerender({ name: '', existingNames: [], errors: {} });
    expect(setErrors).toHaveBeenCalledWith({ name: CHARACTER_NAME_REQUIRED_ERROR });
  });

  it('a non-name change never marks the name touched', () => {
    const { result, setErrors, updateField } = renderGuard();
    act(() => result.current.handleFieldChange('level', 5));
    expect(updateField).toHaveBeenCalledWith('level', 5);
    expect(setErrors).not.toHaveBeenCalled();
  });

  it('raises the duplicate error live on a colliding name — no first touch required', () => {
    const { setErrors } = renderGuard({ name: 'Aragorn', existingNames: ['Aragorn'] });
    expect(setErrors).toHaveBeenCalledWith({ name: DUPLICATE_CHARACTER_NAME_ERROR });
  });

  it('clears a guard-owned error once the name is valid again', () => {
    const { setErrors } = renderGuard({
      name: 'Edgin',
      errors: { name: DUPLICATE_CHARACTER_NAME_ERROR },
    });
    expect(setErrors).toHaveBeenCalledWith({ name: null });
  });

  it('never churns an errors.name owned by another validator', () => {
    const validatorError = 'Name must start with a letter';
    const { setErrors } = renderGuard({ name: '', errors: { name: validatorError } });
    expect(setErrors).not.toHaveBeenCalled();
  });
});
