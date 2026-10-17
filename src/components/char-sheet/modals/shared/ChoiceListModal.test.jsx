// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChoiceListModal } from './ChoiceListModal.jsx';

const defaultOptions = [
  { name: 'Option A', description: 'Description A' },
  { name: 'Option B', description: 'Description B' },
  { name: 'Option C', description: 'Description C' },
];

function makeProps(overrides) {
  return {
    icon: 'fa-star',
    title: 'Select Options',
    description: 'Choose your options below',
    options: defaultOptions,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function clickConfirm(props = {}) {
  fireEvent.click(screen.getByRole('button', { name: props.confirmLabel || /Confirm/ }));
}

describe('ChoiceListModal', () => {
  describe('rendering', () => {
    it('renders title, description, every option with its description, and action buttons — omitting the paragraph when description is empty', () => {
      const { container, unmount } = render(<ChoiceListModal {...makeProps()} />);
      expect(container.querySelector('i.fa-star')).toBeInTheDocument();
      expect(screen.getByText('Select Options')).toBeInTheDocument();
      expect(screen.getByText('Choose your options below')).toBeInTheDocument();
      defaultOptions.forEach(opt => {
        expect(screen.getByText(opt.name)).toBeInTheDocument();
        expect(screen.getByText(`— ${opt.description}`)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      unmount();
      render(<ChoiceListModal {...makeProps({ description: '' })} />);
      expect(screen.getByText('Select Options')).toBeInTheDocument();
      expect(screen.queryByText('Choose your options below')).not.toBeInTheDocument();
    });

    it('supports custom confirm and cancel labels', () => {
      render(<ChoiceListModal {...makeProps({ confirmLabel: 'Select', cancelLabel: 'Dismiss' })} />);
      expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });
  });

  describe('single select', () => {
    it('enables Confirm only after a selection and replaces the selection when another option is clicked', () => {
      render(<ChoiceListModal {...makeProps()} />);
      const radios = screen.getAllByRole('radio');
      const confirm = screen.getByRole('button', { name: /Confirm/ });
      expect(confirm).toBeDisabled();

      fireEvent.click(radios[0]);
      expect(confirm).toBeEnabled();
      expect(radios[0].checked).toBe(true);

      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('multi select', () => {
    it('renders checkboxes with a live selection count and allows selecting every option up to the maximum', () => {
      render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3 })} />);
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      expect(screen.getByText('Selected: 0 / 3')).toBeInTheDocument();

      checkboxes.forEach(cb => fireEvent.click(cb));
      expect(screen.getByText('Selected: 3 / 3')).toBeInTheDocument();
      checkboxes.forEach(cb => expect(cb.checked).toBe(true));
    });

    it('disables unselected options at max, ignores clicks on them, and re-enables them after deselecting', () => {
      render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 2 })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      expect(screen.getByText('Selected: 2 / 2')).toBeInTheDocument();
      expect(checkboxes[2].disabled).toBe(true);

      fireEvent.click(checkboxes[2]);
      expect(screen.getAllByRole('checkbox').filter(cb => cb.checked)).toHaveLength(2);
      expect(screen.getByText('Selected: 2 / 2')).toBeInTheDocument();

      fireEvent.click(checkboxes[1]);
      expect(checkboxes[2].disabled).toBe(false);
      fireEvent.click(checkboxes[2]);
      expect(screen.getByText('Selected: 2 / 2')).toBeInTheDocument();
      expect(checkboxes[1].checked).toBe(false);
      expect(checkboxes[2].checked).toBe(true);
    });
  });

  describe('existing selections', () => {
    it('badges matching existing options with (current) and nothing else', () => {
      const { unmount } = render(<ChoiceListModal {...makeProps({ existingSelections: ['Option A'] })} />);
      expect(screen.getAllByText('(current)')).toHaveLength(1);

      // Selecting a different option must not move or duplicate the badge.
      fireEvent.click(screen.getByText('Option B'));
      const badges = screen.getAllByText('(current)');
      expect(badges).toHaveLength(1);
      expect(badges[0].closest('label')).toHaveTextContent('Option A');
      expect(screen.getByText('Option B').closest('label')).not.toHaveTextContent('(current)');
      unmount();

      render(<ChoiceListModal {...makeProps({ existingSelections: ['Nonexistent Option'] })} />);
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });
  });

  describe('option accessors', () => {
    it('uses getOptionLabel and getOptionDescription, omitting empty descriptions', () => {
      const options = [
        { id: 1, label: 'Custom Label', customDesc: 'Custom description text' },
        { id: 2, label: 'Bare Option' },
      ];
      render(<ChoiceListModal {...makeProps({
        options,
        getOptionLabel: (opt) => opt.label,
        getOptionDescription: (opt) => opt.customDesc,
      })} />);
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
      expect(screen.getByText('— Custom description text')).toBeInTheDocument();
      expect(screen.getByText('Bare Option').closest('label')).not.toHaveTextContent('—');
    });

    it('uses getOptionKey for selection identity, input name, and the confirm payload', async () => {
      const options = [{ id: 1, name: 'Opt1' }, { id: 2, name: 'Opt2' }];
      const onConfirm = vi.fn().mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({
        options,
        getOptionKey: (opt) => opt.id,
        inputName: 'myChoice',
        onConfirm,
      })} />);
      const radios = screen.getAllByRole('radio');
      radios.forEach(r => expect(r.name).toBe('myChoice'));

      fireEvent.click(radios[0]);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);

      clickConfirm();
      await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(2));
    });
  });

  describe('confirm', () => {
    it('calls onConfirm with the selected key in single select', () => {
      const onConfirm = vi.fn().mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({ onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickConfirm();
      expect(onConfirm).toHaveBeenCalledWith('Option A');
    });

    it('calls onConfirm with an array of selected keys in multi select', () => {
      const onConfirm = vi.fn().mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({ multiSelect: true, maxSelections: 3, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      fireEvent.click(screen.getByText('Option B'));
      clickConfirm();
      expect(onConfirm).toHaveBeenCalledWith(['Option A', 'Option B']);
    });

    it('does not call onConfirm when nothing is selected', () => {
      const onConfirm = vi.fn().mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({ onConfirm })} />);
      expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled();
      clickConfirm();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('result view', () => {
    it('renders the HTML result, ignores overlay clicks, and closes via Done', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockResolvedValue({ payload: { description: '<strong>Bold result</strong>' } });
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm, onClose })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickConfirm();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument());
      // Rendered as real HTML, not escaped text.
      expect(screen.getByText('Bold result').tagName).toBe('STRONG');
      expect(screen.getByText('Select Options')).toBeInTheDocument();

      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays in the selection view when resultView is false or onConfirm returns null', async () => {
      const { unmount } = render(<ChoiceListModal {...makeProps({ resultView: false })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickConfirm();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.getByText('Select Options')).toBeInTheDocument();
      unmount();

      const onConfirm = vi.fn().mockResolvedValue(null);
      render(<ChoiceListModal {...makeProps({ resultView: true, onConfirm })} />);
      fireEvent.click(screen.getByText('Option A'));
      clickConfirm();
      await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Option A'));
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.getByText('Select Options')).toBeInTheDocument();
    });
  });

  describe('close/cancel', () => {
    it('calls onClose only when Cancel is clicked, never on the overlay', () => {
      const onClose = vi.fn();
      render(<ChoiceListModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Option A'));
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('SelectedComponent', () => {
    it('replaces the default inputs with custom rows and toggles selection via onToggle', () => {
      const SelectedComponent = ({ option, selected, onToggle }) => (
        <div className="custom-option" data-selected={selected} onClick={onToggle}>
          {option.name}
        </div>
      );
      const { container } = render(<ChoiceListModal {...makeProps({ SelectedComponent })} />);
      expect(container.querySelectorAll('.custom-option')).toHaveLength(3);
      expect(container.querySelectorAll('input')).toHaveLength(0);

      fireEvent.click(screen.getByText('Option A'));
      expect(screen.getByText('Option A').getAttribute('data-selected')).toBe('true');
    });

    it('passes existing and disabled props to SelectedComponent in multi select', () => {
      const SelectedComponent = ({ option, selected, existing, disabled, onToggle }) => (
        <div
          data-selected={selected}
          data-existing={existing}
          data-disabled={disabled}
          onClick={onToggle}
        >
          {option.name}
        </div>
      );
      render(<ChoiceListModal {...makeProps({
        SelectedComponent,
        multiSelect: true,
        maxSelections: 2,
        existingSelections: ['Option A'],
      })} />);
      expect(screen.getByText('Option A').getAttribute('data-existing')).toBe('true');

      fireEvent.click(screen.getByText('Option A'));
      fireEvent.click(screen.getByText('Option B'));
      expect(screen.getByText('Option A').getAttribute('data-selected')).toBe('true');
      expect(screen.getByText('Option C').getAttribute('data-disabled')).toBe('true');
    });
  });
});
