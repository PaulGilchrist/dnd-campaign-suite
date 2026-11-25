// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFooter from './WizardFooter.jsx';

// Owned truth-table for WizardFooter: full wizard-position matrix →
// exact button set (labels, enabled state, semantic classes) and exact
// callback routing. Flow-level gate interplay lives in
// CharacterCreationWizard.submission.test.jsx; do not restate it here.
const POSITION_CASES = [
  { name: 'first step', props: { isFirstStep: true, isLastStep: false },
    buttons: [['Cancel', false, 'btn btn-secondary'], ['Next', false, 'btn btn-primary']] },
  { name: 'first step, Next disabled', props: { isFirstStep: true, isLastStep: false, isNextDisabled: true },
    buttons: [['Cancel', false, 'btn btn-secondary'], ['Next', true, 'btn btn-primary']] },
  { name: 'middle step', props: { isFirstStep: false, isLastStep: false },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Next', false, 'btn btn-primary']] },
  { name: 'middle step (edit)', props: { isFirstStep: false, isLastStep: false, isEditing: true },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Next', false, 'btn btn-primary']] },
  { name: 'last step (create)', props: { isFirstStep: false, isLastStep: true },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Create Character', false, 'btn btn-success']] },
  { name: 'last step (create), Save lane gated', props: { isFirstStep: false, isLastStep: true, isSaveEnabled: false },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Create Character', false, 'btn btn-success']] },
  { name: 'last step (edit)', props: { isFirstStep: false, isLastStep: true, isEditing: true },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Save Changes', false, 'btn btn-success']] },
  { name: 'last step (edit), Save lane gated', props: { isFirstStep: false, isLastStep: true, isEditing: true, isSaveEnabled: false },
    buttons: [['Previous', false, 'btn btn-secondary'], ['Save Changes', true, 'btn btn-success']] },
  { name: 'single step (create)', props: { isFirstStep: true, isLastStep: true },
    buttons: [['Cancel', false, 'btn btn-secondary'], ['Create Character', false, 'btn btn-success']] },
  { name: 'single step (edit)', props: { isFirstStep: true, isLastStep: true, isEditing: true },
    buttons: [['Cancel', false, 'btn btn-secondary'], ['Save Changes', false, 'btn btn-success']] },
];

const CLICK_CASES = [
  ['Cancel', { isFirstStep: true, isLastStep: false }, 'onCancel'],
  ['Previous', { isFirstStep: false, isLastStep: false }, 'onPrevious'],
  ['Next', { isFirstStep: false, isLastStep: false }, 'onNext'],
  ['Create Character', { isFirstStep: false, isLastStep: true }, 'onSubmit'],
  ['Save Changes', { isFirstStep: false, isLastStep: true, isEditing: true }, 'onSubmit'],
];

describe('WizardFooter', () => {
  const createProps = (overrides = {}) => ({
    onCancel: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  });

  it.each(POSITION_CASES)('renders exactly the $name buttons', ({ props, buttons }) => {
    const { container } = render(<WizardFooter {...createProps()} {...props} />);
    // Exact button count — pins absence of every other label at once.
    expect(container.querySelectorAll('button')).toHaveLength(buttons.length);
    for (const [label, disabled, cls] of buttons) {
      const button = screen.getByRole('button', { name: label });
      if (disabled) {
        expect(button).toBeDisabled();
      } else {
        expect(button).toBeEnabled();
      }
      expect(button).toHaveClass(...cls.split(' '));
    }
  });

  // Cancel is clickable on the first step (its guard-prompting behavior is
  // owned by CharacterCreationWizard.close-guard.test.jsx — here we only pin
  // that the footer routes the click to onCancel and nothing else).
  it.each(CLICK_CASES)('clicking %s fires only that callback', (label, props, handler) => {
    const all = createProps();
    render(<WizardFooter {...all} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(all[handler]).toHaveBeenCalledTimes(1);
    for (const [key, fn] of Object.entries(all)) {
      if (key !== handler) expect(fn).not.toHaveBeenCalled();
    }
  });

  describe('edit-mode Save Changes gate (sidebar ✓ Save parity)', () => {
    const lastStepEdit = { isFirstStep: false, isLastStep: true, isEditing: true };
    const saveChanges = () => screen.getByRole('button', { name: 'Save Changes' });

    // Gating idiom: the disabled STATE is the pin (repo law — assert the
    // disabled attribute, never click a disabled control). The truth-table
    // case 'last step (edit), Save lane gated' owns the disabled assertion;
    // here we own the cause-title faces the sidebar Save already ships.

    // Same cause-naming idiom the sidebar Save ships (e8643bce3): the
    // disabled button names the step the ladder waits on.
    it('names the ladder cause on a gated button, per the CURRENT ruleset flow', () => {
      render(
        <WizardFooter
          {...createProps()}
          {...lastStepEdit}
          isSaveEnabled={false}
          ruleset="5e"
          firstInvalidStep={4}
        />
      );
      expect(saveChanges()).toHaveAttribute('title', 'Complete "Subrace" first');
    });

    it('stays silent on a non-ladder (caps-only) disablement', () => {
      render(<WizardFooter {...createProps()} {...lastStepEdit} isSaveEnabled={false} firstInvalidStep={null} />);
      expect(saveChanges()).toBeDisabled();
      expect(saveChanges()).not.toHaveAttribute('title');
    });

    it('shows no cause title and no gate when the Save lane is open', () => {
      render(<WizardFooter {...createProps()} {...lastStepEdit} ruleset="2024" firstInvalidStep={5} />);
      expect(saveChanges()).toBeEnabled();
      expect(saveChanges()).not.toHaveAttribute('title');
    });
  });
});
