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
    it('renders the value as text when showInput is false and displayValue is true', () => {
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

    it('renders nothing when showInput is false and displayValue is false', () => {
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

    it('renders a number input with correct value when showInput is true', () => {
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
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5);
      expect(document.activeElement).toBe(input);
    });

    it('renders a number input with null value', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={null}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('renders a number input with zero value', () => {
      render(
        <HiddenInput
          handleInputToggle={mockOnToggle}
          handleValueChange={mockOnChange}
          showInput
          value={0}
        />
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(0);
    });

    it('hides the input and shows the value when showInput becomes false', () => {
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

    it('does not sync local value when the controlled value prop changes during editing', () => {
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
  });

  describe('input interaction', () => {
    it('updates local value on change without calling handleValueChange', () => {
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

    it('commits the current local value and toggles on blur', () => {
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

    it('commits the original value and toggles on blur when no change occurred', () => {
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

    it('commits on Enter key and toggles, but not on Escape', () => {
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

      mockOnChange.mockClear();
      mockOnToggle.mockClear();

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockOnToggle).not.toHaveBeenCalled();
    });

    it('clamps value to max and 0 minimum on commit', () => {
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

    it('clamps negative values to 0 on commit', () => {
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
