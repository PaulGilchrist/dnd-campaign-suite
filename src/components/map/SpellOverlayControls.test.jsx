import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';

describe('SpellOverlayControls', () => {
  const mockSetSelectedShape = vi.fn();
  const mockSetShapeParams = vi.fn((fn) => {
    if (typeof fn === 'function') {
      const prev = { radiusFt: 20, sizeFt: 15, distanceFt: 60, coneAngle: 90, widthFt: 5 };
      return fn(prev);
    }
    return fn;
  });
  const mockOnRemoveOverlay = vi.fn();
  const mockOnClearAll = vi.fn();
  const mockOnCancelMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    selectedShape: OverlayShape.SPHERE,
    setSelectedShape: mockSetSelectedShape,
    shapeParams: { radiusFt: 20 },
    setShapeParams: mockSetShapeParams,
    overlays: [],
    onRemoveOverlay: mockOnRemoveOverlay,
    onClearAll: mockOnClearAll,
    onCancelMode: mockOnCancelMode,
    isActive: false,
  };

  const renderComponent = (props = {}) =>
    render(<SpellOverlayControls { ...defaultProps } { ...props } />);

  const getSetShapeParamsResult = () => {
    const callArg = mockSetShapeParams.mock.calls[0][0];
    const prev = { radiusFt: 20, sizeFt: 15, distanceFt: 60, coneAngle: 90, widthFt: 5 };
    return typeof callArg === 'function' ? callArg(prev) : callArg;
  };

  describe('header and shape selector', () => {
    it('renders the header with wand icon', () => {
      renderComponent();
      expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
    });

    it('renders the shape dropdown with all options', () => {
      renderComponent();
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByText('Sphere')).toBeInTheDocument();
      expect(screen.getByText('Cylinder')).toBeInTheDocument();
      expect(screen.getByText('Cube')).toBeInTheDocument();
      expect(screen.getByText('Cone')).toBeInTheDocument();
      expect(screen.getByText('Line')).toBeInTheDocument();
    });

    it('selects the current shape in the dropdown', () => {
      renderComponent({ selectedShape: OverlayShape.CONE });
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue(OverlayShape.CONE);
    });

    it('calls setSelectedShape when shape changes', () => {
      renderComponent();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: OverlayShape.CONE } });
      expect(mockSetSelectedShape).toHaveBeenCalledWith(OverlayShape.CONE);
    });

    it('resets shapeParams to shape defaults when shape changes', () => {
      renderComponent();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: OverlayShape.CONE } });
      expect(mockSetShapeParams).toHaveBeenCalledWith(DEFAULTS[OverlayShape.CONE]);
    });
  });

  describe('isActive / cancel button', () => {
    it('does not show cancel button when not active', () => {
      renderComponent({ isActive: false });
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('shows cancel button and calls onCancelMode when clicked', () => {
      renderComponent({ isActive: true });
      const cancelBtn = screen.getByText('Cancel');
      expect(cancelBtn).toBeInTheDocument();
      fireEvent.click(cancelBtn);
      expect(mockOnCancelMode).toHaveBeenCalled();
    });
  });

  describe('sphere shape params', () => {
    it('renders radius input with default value for sphere', () => {
      renderComponent({ selectedShape: OverlayShape.SPHERE });
      expect(screen.getByText('Radius (ft)')).toBeInTheDocument();
      const input = screen.getByRole('spinbutton', { name: /radius/i });
      expect(input).toHaveValue(20);
    });

    it('calls setShapeParams with radiusFt on change', () => {
      renderComponent({ selectedShape: OverlayShape.SPHERE });
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '30' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ radiusFt: 30 }));
    });

    it('uses default 20 when shapeParams.radiusFt is undefined', () => {
      renderComponent({
        selectedShape: OverlayShape.SPHERE,
        shapeParams: {},
      });
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(20);
    });
  });

  describe('cube shape params', () => {
    it('renders size input with default value for cube', () => {
      renderComponent({ selectedShape: OverlayShape.CUBE });
      expect(screen.getByText('Size (ft)')).toBeInTheDocument();
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(15);
    });

    it('calls setShapeParams with sizeFt on change', () => {
      renderComponent({ selectedShape: OverlayShape.CUBE });
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '20' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ sizeFt: 20 }));
    });

    it('uses default 15 when shapeParams.sizeFt is undefined', () => {
      renderComponent({
        selectedShape: OverlayShape.CUBE,
        shapeParams: {},
      });
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(15);
    });
  });

  describe('cone shape params', () => {
    it('renders distance and angle inputs with default values for cone', () => {
      renderComponent({ selectedShape: OverlayShape.CONE });
      expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
      expect(screen.getByText('Angle (°)')).toBeInTheDocument();
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(60);
      expect(inputs[1]).toHaveValue(90);
    });

    it('calls setShapeParams with distanceFt on distance change', () => {
      renderComponent({ selectedShape: OverlayShape.CONE });
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '30' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ distanceFt: 30 }));
    });

    it('calls setShapeParams with coneAngle on angle change', () => {
      renderComponent({ selectedShape: OverlayShape.CONE });
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[1], { target: { value: '60' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ coneAngle: 60 }));
    });

    it('uses defaults when shapeParams is empty', () => {
      renderComponent({
        selectedShape: OverlayShape.CONE,
        shapeParams: {},
      });
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(60);
      expect(inputs[1]).toHaveValue(90);
    });
  });

  describe('line shape params', () => {
    it('renders distance and width inputs with default values for line', () => {
      renderComponent({ selectedShape: OverlayShape.LINE });
      expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
      expect(screen.getByText('Width (ft)')).toBeInTheDocument();
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(60);
      expect(inputs[1]).toHaveValue(5);
    });

    it('calls setShapeParams with distanceFt on distance change', () => {
      renderComponent({ selectedShape: OverlayShape.LINE });
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '30' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ distanceFt: 30 }));
    });

    it('calls setShapeParams with widthFt on width change', () => {
      renderComponent({ selectedShape: OverlayShape.LINE });
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[1], { target: { value: '10' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ widthFt: 10 }));
    });

    it('uses defaults when shapeParams is empty', () => {
      renderComponent({
        selectedShape: OverlayShape.LINE,
        shapeParams: {},
      });
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(60);
      expect(inputs[1]).toHaveValue(5);
    });
  });

  describe('handleParamChange edge cases', () => {
    it('treats non-numeric and empty values as 0', () => {
      renderComponent({ selectedShape: OverlayShape.SPHERE });
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: 'not-a-number' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ radiusFt: 0 }));
      vi.clearAllMocks();
      fireEvent.change(input, { target: { value: '' } });
      expect(getSetShapeParamsResult()).toEqual(expect.objectContaining({ radiusFt: 0 }));
    });
  });

  describe('active overlays list', () => {
    it('does not show active section when no overlays', () => {
      renderComponent({ overlays: [] });
      expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
    });

    it('shows active section with overlay count when overlays exist', () => {
      const overlays = [
        { id: 'o1', shape: OverlayShape.SPHERE },
        { id: 'o2', shape: OverlayShape.CONE },
      ];
      renderComponent({ overlays });
      expect(screen.getByText('Active (2)')).toBeInTheDocument();
    });

    it('renders each overlay with shape label and remove button', () => {
      const overlays = [
        { id: 'o1', shape: OverlayShape.CUBE },
        { id: 'o2', shape: OverlayShape.CONE },
      ];
      const { container } = renderComponent({ overlays, selectedShape: OverlayShape.CUBE });
      const activeSection = container.querySelector('.spell-overlay-active');
      const overlayLabels = activeSection.querySelectorAll('span');
      expect(overlayLabels).toHaveLength(2);
      expect(overlayLabels[0].textContent).toBe('Cube');
      expect(overlayLabels[1].textContent).toBe('Cone');
      const buttons = activeSection.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
    });

    it('calls onRemoveOverlay when a remove button is clicked', () => {
      const overlays = [
        { id: 'o1', shape: OverlayShape.CUBE },
        { id: 'o2', shape: OverlayShape.CONE },
      ];
      renderComponent({ overlays, selectedShape: OverlayShape.CUBE });
      const removeButtons = screen.getAllByRole('button', { name: '' });
      fireEvent.click(removeButtons[0]);
      expect(mockOnRemoveOverlay).toHaveBeenCalledWith('o1');
    });

    it('calls onClearAll when clear all is clicked', () => {
      const overlays = [{ id: 'o1', shape: OverlayShape.SPHERE }];
      renderComponent({ overlays });
      fireEvent.click(screen.getByText('Clear All'));
      expect(mockOnClearAll).toHaveBeenCalled();
    });

    it('shows fallback label for unknown shape', () => {
      const overlays = [{ id: 'o1', shape: 'unknown-shape' }];
      renderComponent({ overlays });
      expect(screen.getByText('unknown-shape')).toBeInTheDocument();
    });
  });

  describe('placement hint', () => {
    it('does not show hint when not active', () => {
      renderComponent({ isActive: false });
      expect(screen.queryByText(/Click map to place/)).not.toBeInTheDocument();
    });

    it('shows basic hint when active with sphere', () => {
      renderComponent({ isActive: true, selectedShape: OverlayShape.SPHERE });
      expect(screen.getByText(/Click map to place$/)).toBeInTheDocument();
    });

    it('shows hint with "drag for angle" for cone, line, and cube', () => {
      renderComponent({ isActive: true, selectedShape: OverlayShape.CONE });
      expect(screen.getByText(/Click map to place.*drag for angle/)).toBeInTheDocument();
    });
  });
});
