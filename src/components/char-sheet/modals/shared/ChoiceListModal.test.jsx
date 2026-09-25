// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChoiceListModal } from './ChoiceListModal.jsx';

const defaultOptions = [
  { name: 'Option A', description: 'Description A' },
  { name: 'Option B', description: 'Description B' },
  { name: 'Option C', description: 'Description C' },
];

function makeProps(overrides) {
  return {
    icon: 'fa-solid fa-star',
    title: 'Select Options',
    description: 'Choose your options below',
    options: defaultOptions,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

function clickApply() {
  fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
}

describe('ChoiceListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders modal with icon, title, and description', () => {
      render(<ChoiceListModal {...makeProps()} />);
      expect(screen.getByText('Select Options')).toBeInTheDocument();
      expect(screen.getByText('Choose your options below')).toBeInTheDocument();
    });

    it('renders all options with their names', () => {
      render(<ChoiceListModal {...makeProps()} />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('Option C')).toBeInTheDocument();
    });

    it('renders option descriptions prefixed with em dash', () => {
      render(<ChoiceListModal {...makeProps()} />);
      expect(screen.getByText('— Description A')).toBeInTheDocument();
      expect(screen.getByText('— Description B')).toBeInTheDocument();
      expect(screen.getByText('— Description C')).toBeInTheDocument();
    });

    it('renders confirm and cancel buttons', () => {
      render(<ChoiceListModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders without description paragraph when description is empty', () => {
      render(<ChoiceListModal {...makeProps({ description: '' })} />);
      expect(screen.queryByText('Choose your options below')).not.toBeInTheDocument();
    });

    it('renders with custom confirm and cancel labels', () => {
      render(<ChoiceListModal {...makeProps({ confirmLabel: 'Select', cancelLabel: 'Dismiss' })} />);
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    describe('single select', () => {
      it('disables confirm button when no option is selected', () => {
        render(<ChoiceListModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled();
      });

      it('enables confirm button after selecting an option', () => {
        render(<ChoiceListModal {...makeProps()} />);
        fireEvent.click(screen.getByText('Option A'));
        expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
      });

      it('switches selection when a different option is clicked', () => {
        render(<ChoiceListModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(radios[2]);
        expect(radios[0].checked).toBe(false);
        expect(radios[2].checked).toBe(true);
      });
    });

    describe('multi select', () => {
      it('renders checkboxes instead of radios when multiSelect is true', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3 })} />);
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
      });

      it('shows selection count when multiSelect is true', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3 })} />);
        expect(screen.getByText('Selected: 0 / 3')).toBeInTheDocument();
      });

      it('updates selection count when options are selected', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        expect(screen.getByText('Selected: 2 / 3')).toBeInTheDocument();
      });

      it('disables unselected options when maxSelections is reached', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 2 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        expect(checkboxes[2].disabled).toBe(true);
      });

      it('allows deselecting when at max selections', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 2 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[1]);
        expect(checkboxes[2].disabled).toBe(false);
      });

      it('does not add more than maxSelections', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 2 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[2]);
        const checked = document.querySelectorAll('input[type="checkbox"]:checked');
        expect(checked).toHaveLength(2);
      });

      it('allows selecting multiple options up to maxSelections', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[2]);
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].checked).toBe(true);
        expect(checkboxes[2].checked).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('does not allow any selection when maxSelections is 0', () => {
        render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 0 })} />);
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0].disabled).toBe(true);
      });

      it('does not disable any option in single select mode', () => {
        render(<ChoiceListModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => expect(radio.disabled).toBe(false));
      });
    });
  });

  describe('existing selections', () => {
    it('marks existing selections with (current) badge', () => {
      render(<ChoiceListModal {...makeProps({ existingSelections: ['Option A'] })} />);
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('does not badge options that are newly selected vs existing', () => {
      render(<ChoiceListModal {...makeProps({ existingSelections: ['Option A'] })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[1]);
      // Option A still has (current) badge, Option B does not
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('handles existingSelections containing options not in the options array', () => {
      render(<ChoiceListModal {...makeProps({ existingSelections: ['Nonexistent Option'] })} />);
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });
  });

  describe('custom option renderers', () => {
    it('uses custom getOptionKey to track selections', () => {
      const options = [{ id: 1, name: 'Opt1' }, { id: 2, name: 'Opt2' }];
      render(<ChoiceListModal {...makeProps({ options, getOptionKey: (opt) => opt.id })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('uses custom getOptionLabel for option text', () => {
      const options = [{ id: 1, label: 'Custom Label' }];
      render(<ChoiceListModal {...makeProps({ options, getOptionLabel: (opt) => opt.label })} />);
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    it('uses custom getOptionDescription for descriptions', () => {
      const options = [{ name: 'Opt1', customDesc: 'Custom description text' }];
      render(<ChoiceListModal {...makeProps({ options, getOptionDescription: (opt) => opt.customDesc })} />);
      expect(screen.getByText('— Custom description text')).toBeInTheDocument();
    });

    it('does not show description span when getOptionDescription returns empty', () => {
      const options = [{ name: 'Opt1', description: '' }];
      render(<ChoiceListModal {...makeProps({ options, getOptionDescription: (opt) => opt.description })} />);
      expect(screen.queryByText('— ')).not.toBeInTheDocument();
    });

    it('uses custom inputName for radio inputs', () => {
      render(<ChoiceListModal {...makeProps({ inputName: 'myChoice' })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios[0].name).toBe('myChoice');
    });
  });

  describe('confirm behavior', () => {
    it('calls onConfirm with selected key when single select and confirm is clicked', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Confirmed' } });
      render(<ChoiceListModal {...makeProps({ onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('Option A');
      });
    });

    it('calls onConfirm with array of selected keys in multi select', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Confirmed' } });
      render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      fireEvent.click(screen.getByText('Option B'));
      clickApply();
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith(['Option A', 'Option B']);
      });
    });

    it('does not call onConfirm when no option is selected', () => {
      const { onConfirm } = makeProps();
      render(<ChoiceListModal {...makeProps({ onConfirm })} />);
      clickApply();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('enters result view mode when resultView is true and onConfirm returns a result', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Result description' } });
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(screen.getByText('Result description')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('shows result description as HTML in result view mode', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: '<strong>Bold result</strong>' } });
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('<strong>Bold result</strong>');
      });
    });

    it('shows empty result when payload.description is missing', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: {} });
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toBe('');
      });
    });

    it('does not enter result view when resultView is false', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Result' } });
      render(<ChoiceListModal {...makeProps({ resultView: false, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(screen.getByText('Select Options')).toBeInTheDocument();
      });
    });

    it('does not enter result view when onConfirm returns null', async () => {
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  describe('close/cancel behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const { onClose } = makeProps();
      render(<ChoiceListModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked', () => {
      const { onClose } = makeProps();
      render(<ChoiceListModal {...makeProps({ onClose })} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not close when an option label is clicked', () => {
      const { onClose } = makeProps();
      render(<ChoiceListModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Option A'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Done button is clicked in result view', async () => {
      const onClose = vi.fn();
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Done' } });
      render(<ChoiceListModal {...makeProps({ resultView: true, onClose, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked in result view', async () => {
      const onClose = vi.fn();
      const { onConfirm } = makeProps();
      onConfirm.mockResolvedValue({ payload: { description: 'Done' } });
      render(<ChoiceListModal {...makeProps({ resultView: true, onClose, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickApply();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  describe('SelectedComponent', () => {
    it('renders SelectedComponent instead of default labels when provided', () => {
      const SelectedComponent = ({ option, selected, onToggle }) => (
        <div className="custom-option" data-selected={selected} onClick={onToggle}>
          {option.name}
        </div>
      );
      render(<ChoiceListModal {...makeProps({ SelectedComponent })} />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(document.querySelectorAll('.custom-option')).toHaveLength(3);
    });

    it('calls onToggle on SelectedComponent when clicked', () => {
      const SelectedComponent = ({ option, selected, onToggle }) => (
        <div data-selected={selected} onClick={onToggle}>{option.name}</div>
      );
      render(<ChoiceListModal {...makeProps({ SelectedComponent })} />);
      fireEvent.click(screen.getByText('Option A'));
      const updatedOptionA = screen.getByText('Option A');
      expect(updatedOptionA.getAttribute('data-selected')).toBe('true');
    });

    it('passes correct props to SelectedComponent in multi select mode', () => {
      const SelectedComponent = ({ option, selected, existing, disabled, onToggle }) => (
        <div data-selected={selected} data-existing={existing} data-disabled={disabled} onClick={onToggle}>
          {option.name}
        </div>
      );
      render(<ChoiceListModal {...makeProps({ SelectedComponent, multiSelect: true, maxSelections: 2, existingSelections: ['Option A'] })} />);
      // Option A is existing
      expect(screen.getByText('Option A').getAttribute('data-existing')).toBe('true');
      // Select A and B to reach max
      fireEvent.click(screen.getByText('Option A'));
      fireEvent.click(screen.getByText('Option B'));
      // Option C should be disabled
      expect(screen.getByText('Option C').getAttribute('data-disabled')).toBe('true');
    });
  });

  describe('edge cases', () => {
    it('renders no options when options array is empty', () => {
      render(<ChoiceListModal {...makeProps({ options: [] })} />);
      expect(screen.getByText('Select Options')).toBeInTheDocument();
      expect(document.querySelectorAll('.choice-option')).toHaveLength(0);
    });

    it('handles single option in list', () => {
      render(<ChoiceListModal {...makeProps({ options: [{ name: 'Only Option', description: 'Solo' }] })} />);
      expect(screen.getByText('Only Option')).toBeInTheDocument();
      expect(screen.getByText('— Solo')).toBeInTheDocument();
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(1);
    });
  });
});
