// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiResistanceSelectionModal from './MultiResistanceSelectionModal.jsx';

function makeProps(overrides = {}) {
  return {
    title: 'Resistance Selection',
    icon: 'fa-shield-halved',
    damageTypes: ['Acid', 'Fire', 'Cold', 'Lightning'],
    existingTypes: [],
    maxSelections: 2,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Resistance Selection',
    description: 'Resistance to Acid and Fire selected.',
  },
};

async function clickConfirm(name = 'Choose Resistances') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

function iconCount(className) {
  return document.querySelectorAll(`i.fa-solid.${className}`).length;
}

describe('MultiResistanceSelectionModal', () => {
  it('renders the selection screen disabled until a type is chosen', () => {
    render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: undefined })} />);
    expect(document.querySelector('.sp-overlay .sp-modal')).toBeInTheDocument();
    expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
    expect(iconCount('fa-shield-halved')).toBeGreaterThan(0);
    expect(screen.getByText(/Choose 2 damage types to gain resistance to:/)).toBeInTheDocument();
    for (const type of ['Acid', 'Fire', 'Cold', 'Lightning']) {
      expect(screen.getByLabelText(type)).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('enforces maxSelections while toggling damage types', () => {
    render(<MultiResistanceSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Acid')).toBeChecked();
    expect(screen.getByLabelText('Fire')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeEnabled();

    // At the cap: unselected types are disabled and cannot be checked.
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeDisabled();
    expect(screen.getByLabelText('Cold')).not.toBeChecked();

    // Deselecting frees a slot, allowing a switch.
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
    expect(screen.getByLabelText('Cold')).not.toBeDisabled();
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeChecked();
  });

  it('supports a single selection with singular wording and submits it', async () => {
    const props = makeProps({ maxSelections: 1 });
    render(<MultiResistanceSelectionModal {...props} />);
    expect(screen.getByText(/Choose 1 damage type to gain resistance to:/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeChecked();
    expect(screen.getByLabelText('Fire')).toBeDisabled();
    await clickConfirm();
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(['Cold']);
  });

  it('allows every type when maxSelections covers the list', () => {
    render(<MultiResistanceSelectionModal {...makeProps({ maxSelections: 4 })} />);
    for (const type of ['Acid', 'Fire', 'Cold', 'Lightning']) {
      fireEvent.click(screen.getByLabelText(type));
    }
    for (const type of ['Acid', 'Fire', 'Cold', 'Lightning']) {
      expect(screen.getByLabelText(type)).toBeChecked();
      expect(screen.getByLabelText(type)).not.toBeDisabled();
    }
  });

  it('preselects existing types and marks deselected ones "(current)"', () => {
    render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire', 'Cold'] })} />);
    expect(screen.getByText(/Change resistance types \(currently Fire, Cold\):/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeChecked();
    expect(screen.getByLabelText('Cold')).toBeChecked();
    expect(screen.getByLabelText('Acid')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText(/Fire/)).not.toBeChecked();
    expect(screen.getByLabelText(/Fire/).closest('label').textContent).toContain('(current)');
    // Selection still contains Cold, so confirm stays enabled.
    expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeEnabled();

    fireEvent.click(screen.getByLabelText(/Fire/));
    expect(screen.getByLabelText(/Fire/)).toBeChecked();
    expect(screen.getByLabelText(/Fire/).closest('label').textContent).not.toContain('(current)');
  });

  it('disables the Change button when all existing types are deselected', () => {
    render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire'] })} />);
    expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeDisabled();
  });

  it('calls onConfirm with the selected damage types', async () => {
    const props = makeProps();
    render(<MultiResistanceSelectionModal {...props} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    fireEvent.click(screen.getByLabelText('Fire'));
    await clickConfirm();
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(['Acid', 'Fire']);
  });

  it('shows the result screen after confirming, then closes via Done', async () => {
    const props = makeProps();
    props.onConfirm.mockResolvedValue(defaultResult);
    render(<MultiResistanceSelectionModal {...props} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await clickConfirm();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument());
    expect(screen.getByText('Resistance to Acid and Fire selected.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Resistances' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders HTML markup in the result description', async () => {
    const props = makeProps();
    props.onConfirm.mockResolvedValue({
      ...defaultResult,
      payload: { ...defaultResult.payload, description: '<strong>Resistance:</strong> Acid <em>selected</em>.' },
    });
    render(<MultiResistanceSelectionModal {...props} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await clickConfirm();
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.querySelector('strong')).toBeInTheDocument();
      expect(body.querySelector('em')).toBeInTheDocument();
    });
  });

  it('stays on the selection screen when onConfirm resolves null', async () => {
    const props = makeProps();
    props.onConfirm.mockResolvedValue(null);
    render(<MultiResistanceSelectionModal {...props} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await clickConfirm();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeInTheDocument();
  });

  it('closes via Cancel but not via overlay or modal clicks', () => {
    const props = makeProps();
    render(<MultiResistanceSelectionModal {...props} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom title and icon, falling back to defaults', () => {
    const { unmount } = render(<MultiResistanceSelectionModal {...makeProps({ title: 'Elemental Resistance', icon: 'fa-fire' })} />);
    expect(screen.getByText('Elemental Resistance')).toBeInTheDocument();
    expect(iconCount('fa-fire')).toBeGreaterThan(0);
    unmount();
    render(<MultiResistanceSelectionModal {...makeProps({ title: undefined, icon: undefined })} />);
    expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
    expect(iconCount('fa-shield-halved')).toBeGreaterThan(0);
  });

  it('lists existing types missing from damageTypes in the current list only', () => {
    render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Poison'], damageTypes: ['Acid', 'Fire'] })} />);
    expect(screen.getByText(/Change resistance types \(currently Poison\):/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Acid')).not.toBeChecked();
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
  });
});
