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

    it('should render a number input with null value', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={null}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
    });

    it('should render a number input with undefined value', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={undefined}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
    });

    it('should render a number input with zero value', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={0}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(0);
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

      expect(mockOnChange).toHaveBeenCalledWith(10);
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

    it('should clamp value to max on commit', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
          max={10}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '15' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('should clamp value to 0 on commit when negative', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={5}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });
  });
});
