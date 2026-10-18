// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepSpecial from './WizardStepSpecial.jsx';

// Fresh props per test; real PreviewToggle is jsdom-safe (plain textarea + sanitized preview).
function makeProps(formDataOverrides = {}) {
  return {
    stepNumber: 17,
    formData: { specialActions: [], ...formDataOverrides },
    onArrayFieldChange: vi.fn(),
  };
}

describe('WizardStepSpecial', () => {
  it('renders step header and add-action form', () => {
    render(<WizardStepSpecial {...makeProps()} />);
    expect(screen.getByText('Step 17: Special Actions')).toBeInTheDocument();
    expect(screen.getByText('Add New Action')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Action name (required)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Additional details (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Action' })).toBeInTheDocument();
  });

  it('renders existing actions with name, description, details, and a Remove button', () => {
    const props = makeProps({
      specialActions: [{ name: 'Breath Weapon', description: 'A blast of fire', details: '30ft cone' }],
    });
    render(<WizardStepSpecial {...props} />);
    expect(screen.getByText('Custom Special Actions')).toBeInTheDocument();
    expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    expect(screen.getByText('A blast of fire')).toBeInTheDocument();
    expect(screen.getByText('30ft cone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it.each([
    ['an empty array', []],
    ['a missing specialActions key', undefined],
  ])('omits the Custom Special Actions section for %s', (_label, specialActions) => {
    render(<WizardStepSpecial {...makeProps({ specialActions })} />);
    expect(screen.queryByText('Custom Special Actions')).not.toBeInTheDocument();
  });

  it('emits exact field-keyed payloads when typing name, description, and details', () => {
    // newSpecialAction absent entirely — exercises the undefined-spread path.
    const props = makeProps();
    render(<WizardStepSpecial {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Action name (required)'), { target: { value: 'New Action Name' } });
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('newSpecialAction', { name: 'New Action Name' });

    fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'A powerful new description' } });
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('newSpecialAction', { description: 'A powerful new description' });

    fireEvent.change(screen.getByPlaceholderText('Additional details (optional)'), { target: { value: 'Some important details' } });
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('newSpecialAction', { details: 'Some important details' });
  });

  it('preserves untouched newSpecialAction fields when updating one', () => {
    const props = makeProps({
      newSpecialAction: { name: 'Existing Name', description: 'Existing Desc', details: 'Existing Details' },
    });
    render(<WizardStepSpecial {...props} />);

    fireEvent.change(screen.getByPlaceholderText('Action name (required)'), { target: { value: 'Updated Name' } });
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('newSpecialAction', {
      name: 'Updated Name',
      description: 'Existing Desc',
      details: 'Existing Details',
    });
  });

  it('appends a trimmed action (whitespace details become null) and clears the form', () => {
    const props = makeProps({
      specialActions: [{ name: 'Existing', description: 'Old', details: null }],
      newSpecialAction: { name: '  Trimmed Action  ', description: '  Desc  ', details: '   ' },
    });
    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('specialActions', [
      { name: 'Existing', description: 'Old', details: null },
      { name: 'Trimmed Action', description: 'Desc', details: null },
    ]);
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('newSpecialAction', {});
  });

  it('emits nothing when the action name is blank', () => {
    const props = makeProps({
      newSpecialAction: { name: '   ', description: 'Desc with content', details: '' },
    });
    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Action' }));
    expect(props.onArrayFieldChange).not.toHaveBeenCalled();
  });

  it('removes only the clicked action, preserving order of the rest', () => {
    const props = makeProps({
      specialActions: [
        { name: 'Action 1', description: 'Desc 1', details: null },
        { name: 'Action 2', description: 'Desc 2', details: 'Details 2' },
        { name: 'Action 3', description: 'Desc 3', details: null },
      ],
    });
    render(<WizardStepSpecial {...props} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('specialActions', [
      { name: 'Action 1', description: 'Desc 1', details: null },
      { name: 'Action 3', description: 'Desc 3', details: null },
    ]);
  });

  it('normalizes string actions for display and removal into object payloads', () => {
    const props = makeProps({ specialActions: ['String Action 1', 'String Action 2'] });
    render(<WizardStepSpecial {...props} />);

    expect(screen.getByText('String Action 1')).toBeInTheDocument();
    expect(screen.getByText('String Action 2')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(props.onArrayFieldChange).toHaveBeenCalledWith('specialActions', [
      { name: 'String Action 2', description: '', details: null },
    ]);
  });
});
