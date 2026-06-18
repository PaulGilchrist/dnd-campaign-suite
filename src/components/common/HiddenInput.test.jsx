// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HiddenInput from './HiddenInput.jsx';

describe('HiddenInput', () => {
  const mockOnToggle = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the value as text when showInput is false and displayValue is true', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not render anything when showInput is false and displayValue is false', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
          displayValue={false}
        />
      );

      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('should render a number input when showInput is true', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5);
    });

    it('should render the parent span with correct classes', () => {
      const { container } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const span = container.querySelector('span.hidden-input.clickable');
      expect(span).toBeInTheDocument();
    });

    it('should render an empty input when value is null', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={null}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(null);
    });

    it('should render an empty input when value is undefined', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={undefined}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(null);
    });

    it('should render a zero value correctly', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={0}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(0);
    });

    it('should render an empty span when showInput is false and displayValue is false', () => {
      const { container } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
          displayValue={false}
        />
      );

      const span = container.querySelector('span.hidden-input.clickable');
      expect(span.textContent).toBe('');
    });
  });

  describe('input interaction', () => {
    it('should update local value on change without calling handleValueChange', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(input).toHaveValue(10);
    });

    it('should commit the current local value and toggle on blur', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith('10');
      expect(mockOnToggle).toHaveBeenCalled();
    });

    it('should commit the original value and toggle on blur when no change occurred', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(5);
      expect(mockOnToggle).toHaveBeenCalled();
    });

    it('should commit on Enter key and toggle', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnToggle).toHaveBeenCalled();
    });

    it('should not commit on non-Enter key press', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockOnToggle).not.toHaveBeenCalled();
    });

    it('should stop propagation on keyDown regardless of key', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      const stopPropagationSpy = vi.spyOn(Event.prototype, 'stopPropagation');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(stopPropagationSpy).toHaveBeenCalled();
      stopPropagationSpy.mockRestore();
    });

    it('should stop propagation on click', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      const stopPropagationSpy = vi.spyOn(Event.prototype, 'stopPropagation');
      fireEvent.click(input);

      expect(stopPropagationSpy).toHaveBeenCalled();
      stopPropagationSpy.mockRestore();
    });

    it('should focus the input when showInput becomes true', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(document.activeElement).toBe(input);
    });

    it('should hide the input and show the value when showInput becomes false', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput={false}
          value={5}
        />
      );

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not sync local value when the controlled value prop changes during editing', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={10}
        />
      );

      const input = screen.getByRole('spinbutton');
      // isEditingRef.current is true while showInput is true, so the
      // controlled value change is intentionally ignored.
      expect(input).toHaveValue(5);
    });

    it('should not sync local value when the controlled value prop changes after user edits', () => {
      const { rerender } = render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '15' } });

      rerender(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={20}
        />
      );

      // localValue was set to 15 by the user; showInput is still true so
      // isEditingRef.current is true, meaning the controlled value change is ignored.
      expect(input).toHaveValue(15);
    });

    it('should accept the input type attribute as number', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should set min attribute to 0 on the input', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
    });
  });
});
