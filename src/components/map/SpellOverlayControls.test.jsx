// @maintained-by-ai 2026-11-26
// Component-level contract for SpellOverlayControls: shape picker + DEFAULTS
// reset, per-shape param face (labels, fallbacks, writes), armed-only copy,
// active-list counting/skipping, and remove/Clear-All wiring. Sibling split:
// same-shape chip identity (label/tooltip/aria) lives in
// SpellOverlayControls.chip-label.test.jsx; the unarmed manage-only face
// (disabled controls, both placement hints absent) in
// SpellOverlayControls.unarmed-params.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';

// Mirrors PARAM_FIELDS in the component: numeric inputs + label/fallback per
// shape, plus the armed placement hint (drag-for-angle for CONE/LINE/CUBE).
// Pinning labels here also locks the cone rename to `Cone Spread (°)` — the
// old `Angle (°)` label collided with the hint's ORIENTATION meaning
// (backlog FU 2026-11-09) — while the param key stays the contract.
const SHAPE_CASES = [
  { shape: OverlayShape.SPHERE, hint: 'Click map to place', fields: [{ param: 'radiusFt', label: 'Radius (ft)', fallback: 20 }] },
  { shape: OverlayShape.CYLINDER, hint: 'Click map to place', fields: [{ param: 'radiusFt', label: 'Radius (ft)', fallback: 20 }] },
  { shape: OverlayShape.CUBE, hint: 'Click map to place, drag for angle', fields: [{ param: 'sizeFt', label: 'Size (ft)', fallback: 15 }] },
  { shape: OverlayShape.CONE, hint: 'Click map to place, drag for angle', fields: [{ param: 'distanceFt', label: 'Distance (ft)', fallback: 60 }, { param: 'coneAngle', label: 'Cone Spread (°)', fallback: 90 }] },
  { shape: OverlayShape.LINE, hint: 'Click map to place, drag for angle', fields: [{ param: 'distanceFt', label: 'Distance (ft)', fallback: 60 }, { param: 'widthFt', label: 'Width (ft)', fallback: 5 }] },
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

  it.each(SHAPE_CASES)('$shape: shows $hint and edits each labeled param with its fallback', ({ shape, hint, fields }) => {
    renderComponent({ selectedShape: shape, isActive: true });
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(fields.length);
    fields.forEach((field) => {
      const input = screen.getByLabelText(field.label);
      expect(input).toHaveValue(field.fallback);
      fireEvent.change(input, { target: { value: '25' } });
      expect(appliedParams()).toEqual(expect.objectContaining({ [field.param]: 25 }));
    });
  });

  it('treats non-numeric and empty input values as 0', () => {
    renderComponent({ selectedShape: OverlayShape.SPHERE, isActive: true });
    const input = screen.getByRole('spinbutton');
    for (const value of ['not-a-number', '']) {
      fireEvent.change(input, { target: { value } });
      expect(appliedParams()).toEqual(expect.objectContaining({ radiusFt: 0 }));
    }
  });

  it('shows the params-apply-to-next-placement hint while armed', () => {
    renderComponent({ isActive: true });
    expect(screen.getByText('Params apply to the next placement only')).toHaveClass('spell-overlay-hint');
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

  it.each([
    { case: 'no overlays', overlays: [] },
    { case: 'only malformed rows', overlays: [{ id: 'junk', shape: 'sphere', x: 1, y: 1, radius: 5 }] },
  ])('hides the active section when the board has $case', ({ overlays }) => {
    renderComponent({ overlays });
    expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
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
});
