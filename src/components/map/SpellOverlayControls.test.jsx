// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';

// Mirrors PARAM_FIELDS in the component: numeric inputs + fallback per shape.
const SHAPE_CASES = [
  { shape: OverlayShape.SPHERE, hint: 'Click map to place', fields: [{ param: 'radiusFt', fallback: 20 }] },
  { shape: OverlayShape.CYLINDER, hint: 'Click map to place', fields: [{ param: 'radiusFt', fallback: 20 }] },
  { shape: OverlayShape.CUBE, hint: 'Click map to place, drag for angle', fields: [{ param: 'sizeFt', fallback: 15 }] },
  { shape: OverlayShape.CONE, hint: 'Click map to place, drag for angle', fields: [{ param: 'distanceFt', fallback: 60 }, { param: 'coneAngle', fallback: 90 }] },
  { shape: OverlayShape.LINE, hint: 'Click map to place, drag for angle', fields: [{ param: 'distanceFt', fallback: 60 }, { param: 'widthFt', fallback: 5 }] },
];

const PREV_PARAMS = { radiusFt: 20, sizeFt: 15, distanceFt: 60, coneAngle: 90, widthFt: 5 };

describe('SpellOverlayControls', () => {
  const setSelectedShape = vi.fn();
  const setShapeParams = vi.fn();
  const onRemoveOverlay = vi.fn();
  const onClearAll = vi.fn();
  const onCancelMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) =>
    render(<SpellOverlayControls
      selectedShape={OverlayShape.SPHERE}
      setSelectedShape={setSelectedShape}
      shapeParams={{}}
      setShapeParams={setShapeParams}
      overlays={[]}
      onRemoveOverlay={onRemoveOverlay}
      onClearAll={onClearAll}
      onCancelMode={onCancelMode}
      isActive={false}
      {...props}
    />);

  // Resolve what setShapeParams received (updater fn from param edits, or DEFAULTS object on shape change).
  const appliedParams = () => {
    const arg = setShapeParams.mock.calls.at(-1)[0];
    return typeof arg === 'function' ? arg(PREV_PARAMS) : arg;
  };

  it('renders header and shape dropdown with all options, selecting the current shape', () => {
    renderComponent({ selectedShape: OverlayShape.CONE });
    expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue(OverlayShape.CONE);
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Sphere', 'Cylinder', 'Cube', 'Cone', 'Line']);
  });

  it('updates shape and resets params to that shape defaults on shape change', () => {
    renderComponent({ isActive: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: OverlayShape.CONE } });
    expect(setSelectedShape).toHaveBeenCalledWith(OverlayShape.CONE);
    expect(appliedParams()).toEqual(DEFAULTS[OverlayShape.CONE]);
  });

  it('shows cancel button only when active and calls onCancelMode when clicked', () => {
    const { unmount } = renderComponent();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    unmount();

    renderComponent({ isActive: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelMode).toHaveBeenCalled();
  });

  it.each(SHAPE_CASES)('$shape: renders param inputs with fallbacks and updates each param', ({ shape, fields }) => {
    renderComponent({ selectedShape: shape, isActive: true });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(fields.length);
    fields.forEach((field, i) => {
      expect(inputs[i]).toHaveValue(field.fallback);
      fireEvent.change(inputs[i], { target: { value: '25' } });
      expect(appliedParams()).toEqual(expect.objectContaining({ [field.param]: 25 }));
    });
  });

  // Backlog FU 2026-11-09: the cone spread field was labeled `Angle (°)` —
  // colliding with the placement hint's ORIENTATION meaning. Pin the renamed
  // label while the param key stays the contract (`coneAngle`).
  it('labels the cone spread param Cone Spread (°) and writes coneAngle', () => {
    renderComponent({ selectedShape: OverlayShape.CONE, isActive: true });
    const input = screen.getByLabelText('Cone Spread (°)');
    expect(input).toBeInTheDocument();
    expect(screen.queryByText('Angle (°)')).not.toBeInTheDocument();
    expect(input).toHaveValue(90);
    fireEvent.change(input, { target: { value: '45' } });
    expect(appliedParams()).toEqual(expect.objectContaining({ coneAngle: 45 }));
  });

  it('treats non-numeric and empty input values as 0', () => {
    renderComponent({ selectedShape: OverlayShape.SPHERE, isActive: true });
    const input = screen.getByRole('spinbutton');
    for (const value of ['not-a-number', '']) {
      fireEvent.change(input, { target: { value } });
      expect(appliedParams()).toEqual(expect.objectContaining({ radiusFt: 0 }));
    }
  });

  it('shows a next-placement-only hint beside the param inputs on mount', () => {
    const { container } = renderComponent({ isActive: true });
    const hint = screen.getByText('Params apply to the next placement only');
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveClass('spell-overlay-hint');
    // Sits with/under the param row: sibling of the .spell-overlay-row holding the inputs
    const paramRow = container.querySelector('.spell-overlay-row + .spell-overlay-hint');
    expect(paramRow).toBe(hint);
  });

  it('hides the active section when there are no overlays', () => {
    renderComponent();
    expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
  });

  // Panel fixtures must be renderable overlays — malformed rows are skipped
  // by design now (no phantom "Active (N)" rows, backlog 2026-11-02 BD).
  const validOverlay = (item) => ({
    startGridX: 1,
    startGridY: 1,
    radiusFt: 20,
    sizeFt: 15,
    distanceFt: 60,
    coneAngle: 53,
    widthFt: 5,
    color: 'rgba(255,80,60,0.07)',
    ...item,
  });

  it('lists active overlays with an honest count and shape labels', () => {
    const overlays = [
      validOverlay({ id: 'o1', shape: OverlayShape.CUBE }),
      validOverlay({ id: 'o2', shape: OverlayShape.CONE }),
    ];
    const { container } = renderComponent({ overlays });
    expect(screen.getByText('Active (2)')).toBeInTheDocument();
    const labels = Array.from(container.querySelectorAll('.spell-overlay-item span')).map((s) => s.textContent);
    expect(labels).toEqual(['Cube (1,1)', 'Cone (1,1)']);
  });

  it('skips malformed rows: no phantom panel row, count reflects only renderable overlays', () => {
    const overlays = [
      validOverlay({ id: 'good', shape: OverlayShape.SPHERE }),
      { id: 'junk-1', shape: 'sphere', x: 5, y: 5, radius: 20 },
      { id: 'junk-2', name: 'Fireball', level: 3 },
      { id: 'junk-3', shape: 'unknown-shape', startGridX: 0, startGridY: 0 },
    ];
    const { container } = renderComponent({ overlays });
    expect(screen.getByText('Active (1)')).toBeInTheDocument();
    const items = container.querySelectorAll('.spell-overlay-item');
    expect(items).toHaveLength(1);
    expect(items[0].querySelector('span').textContent).toBe('Sphere (1,1)');
  });

  it('hides the active section entirely when every row is junk', () => {
    renderComponent({ overlays: [{ id: 'junk', shape: 'sphere', x: 1, y: 1, radius: 5 }] });
    expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
  });

  it('calls onRemoveOverlay and onClearAll from the active list', () => {
    const overlays = [
      validOverlay({ id: 'o1', shape: OverlayShape.CUBE }),
      validOverlay({ id: 'o2', shape: OverlayShape.CONE }),
    ];
    const { container } = renderComponent({ overlays });
    fireEvent.click(container.querySelector('.spell-overlay-item button'));
    expect(onRemoveOverlay).toHaveBeenCalledWith('o1');
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('hides the placement hint when not active', () => {
    renderComponent();
    expect(screen.queryByText(/Click map to place/)).not.toBeInTheDocument();
  });

  it.each(SHAPE_CASES)('$shape shows hint: $hint', ({ shape, hint }) => {
    renderComponent({ selectedShape: shape, isActive: true });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });
});
