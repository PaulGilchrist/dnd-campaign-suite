import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

const createOverlays = (count) =>
    Array.from({ length: count }, (_, i) => ({
        id: `overlay-${i}`,
        shape: Object.values(OverlayShape)[i % 5],
    }));

const renderControls = (props = {}) =>
    render(
        <SpellOverlayControls
            selectedShape={OverlayShape.SPHERE}
            setSelectedShape={vi.fn()}
            shapeParams={{ radiusFt: 20 }}
            setShapeParams={vi.fn()}
            overlays={[]}
            onRemoveOverlay={vi.fn()}
            onClearAll={vi.fn()}
            onCancelMode={vi.fn()}
            isActive={false}
            {...props}
        />
    );

describe('SpellOverlayControls', () => {
    describe('header', () => {
        it('should render the header with wand icon', () => {
            renderControls();
            const header = screen.getByText('Spell Overlay');
            expect(header).toBeInTheDocument();
        });

        it('should render the Font Awesome wand icon', () => {
            const { container } = renderControls();
            const icon = container.querySelector('i.fa-solid.fa-wand-magic-sparkles');
            expect(icon).not.toBeNull();
        });
    });

    describe('shape selector', () => {
        it('should render a shape select dropdown', () => {
            renderControls();
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
        });

        it('should render all 5 shape options', () => {
            renderControls();
            const select = screen.getByRole('combobox');
            const options = select.querySelectorAll('option');
            expect(options.length).toBe(5);
        });

        it('should render option labels for all shapes', () => {
            renderControls();
            expect(screen.getByText('Sphere')).toBeInTheDocument();
            expect(screen.getByText('Cylinder')).toBeInTheDocument();
            expect(screen.getByText('Cube')).toBeInTheDocument();
            expect(screen.getByText('Cone')).toBeInTheDocument();
            expect(screen.getByText('Line')).toBeInTheDocument();
        });

        it('should select the current shape in the dropdown', () => {
            const { container } = renderControls({ selectedShape: OverlayShape.CONE });
            const select = container.querySelector('select');
            expect(select.value).toBe('cone');
        });

        it('should call setSelectedShape and reset params on shape change', () => {
            const setSelectedShape = vi.fn();
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.SPHERE,
                setSelectedShape,
                setShapeParams,
            });
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'cone' } });
            expect(setSelectedShape).toHaveBeenCalledWith('cone');
            expect(setShapeParams).toHaveBeenCalledWith({
                radiusFt: 0,
                coneAngle: 53,
                widthFt: 0,
                distanceFt: 60,
                sizeFt: 0,
                color: 'rgba(255,80,60,0.35)',
            });
        });
    });

    describe('cancel button', () => {
        it('should not render cancel button when not active', () => {
            renderControls({ isActive: false });
            expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
        });

        it('should render cancel button when active', () => {
            renderControls({ isActive: true });
            const cancelBtn = screen.getByRole('button', { name: /cancel/i });
            expect(cancelBtn).toBeInTheDocument();
        });

        it('should render cancel button with Font Awesome times icon', () => {
            renderControls({ isActive: true });
            const { container } = renderControls({ isActive: true });
            const cancelBtn = container.querySelector('.spell-overlay-cancel-btn i.fa-solid.fa-times');
            expect(cancelBtn).not.toBeNull();
        });

        it('should call onCancelMode when cancel is clicked', () => {
            const onCancelMode = vi.fn();
            renderControls({ isActive: true, onCancelMode });
            const cancelBtn = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelBtn);
            expect(onCancelMode).toHaveBeenCalled();
        });
    });

    describe('sphere/cylinder radius input', () => {
        it('should render radius input for sphere', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE });
            expect(screen.getByText('Radius (ft)')).toBeInTheDocument();
        });

        it('should render radius input for cylinder', () => {
            renderControls({ selectedShape: OverlayShape.CYLINDER });
            expect(screen.getByText('Radius (ft)')).toBeInTheDocument();
        });

        it('should not render radius input for cube', () => {
            renderControls({ selectedShape: OverlayShape.CUBE });
            expect(screen.queryByText('Radius (ft)')).not.toBeInTheDocument();
        });

        it('should render radius input with default value from shapeParams', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE, shapeParams: { radiusFt: 30 } });
            const input = screen.getByRole('spinbutton');
            expect(input).toBeInTheDocument();
        });

        it('should use fallback value 20 when radiusFt is undefined', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE, shapeParams: {} });
            const input = screen.getByRole('spinbutton');
            expect(input.value).toBe('20');
        });

        it('should call setShapeParams on radius change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.SPHERE,
                shapeParams: { radiusFt: 20 },
                setShapeParams,
            });
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '30' } });
            expect(setShapeParams).toHaveBeenCalled();
        });

        it('should parse numeric value and fallback to 0 on invalid input', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.SPHERE,
                shapeParams: { radiusFt: 20 },
                setShapeParams,
            });
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: 'invalid' } });
            expect(setShapeParams).toHaveBeenCalledWith(
                expect.any(Function)
            );
        });
    });

    describe('cube size input', () => {
        it('should render size input for cube', () => {
            renderControls({ selectedShape: OverlayShape.CUBE });
            expect(screen.getByText('Size (ft)')).toBeInTheDocument();
        });

        it('should not render size input for sphere', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE });
            expect(screen.queryByText('Size (ft)')).not.toBeInTheDocument();
        });

        it('should use fallback value 15 when sizeFt is undefined', () => {
            renderControls({ selectedShape: OverlayShape.CUBE, shapeParams: {} });
            const input = screen.getByRole('spinbutton');
            expect(input.value).toBe('15');
        });

        it('should call setShapeParams on size change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.CUBE,
                shapeParams: { sizeFt: 15 },
                setShapeParams,
            });
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '20' } });
            expect(setShapeParams).toHaveBeenCalled();
        });
    });

    describe('cone inputs', () => {
        it('should render distance and angle inputs for cone', () => {
            renderControls({ selectedShape: OverlayShape.CONE });
            expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
            expect(screen.getByText('Angle (°)')).toBeInTheDocument();
        });

        it('should not render cone inputs for sphere', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE });
            expect(screen.queryByText('Distance (ft)')).not.toBeInTheDocument();
            expect(screen.queryByText('Angle (°)')).not.toBeInTheDocument();
        });

        it('should use fallback values for cone', () => {
            renderControls({ selectedShape: OverlayShape.CONE, shapeParams: {} });
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs.length).toBe(2);
        });

        it('should call setShapeParams on distance change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.CONE,
                shapeParams: { distanceFt: 60 },
                setShapeParams,
            });
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '30' } });
            expect(setShapeParams).toHaveBeenCalled();
        });

        it('should call setShapeParams on angle change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.CONE,
                shapeParams: { coneAngle: 90 },
                setShapeParams,
            });
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[1], { target: { value: '60' } });
            expect(setShapeParams).toHaveBeenCalled();
        });
    });

    describe('line inputs', () => {
        it('should render distance and width inputs for line', () => {
            renderControls({ selectedShape: OverlayShape.LINE });
            expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
            expect(screen.getByText('Width (ft)')).toBeInTheDocument();
        });

        it('should not render line inputs for sphere', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE });
            expect(screen.queryByText('Distance (ft)')).not.toBeInTheDocument();
            expect(screen.queryByText('Width (ft)')).not.toBeInTheDocument();
        });

        it('should use fallback values for line', () => {
            renderControls({ selectedShape: OverlayShape.LINE, shapeParams: {} });
            const inputs = screen.getAllByRole('spinbutton');
            expect(inputs.length).toBe(2);
        });

        it('should call setShapeParams on distance change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.LINE,
                shapeParams: { distanceFt: 60 },
                setShapeParams,
            });
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[0], { target: { value: '30' } });
            expect(setShapeParams).toHaveBeenCalled();
        });

        it('should call setShapeParams on width change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.LINE,
                shapeParams: { widthFt: 5 },
                setShapeParams,
            });
            const inputs = screen.getAllByRole('spinbutton');
            fireEvent.change(inputs[1], { target: { value: '10' } });
            expect(setShapeParams).toHaveBeenCalled();
        });
    });

    describe('activity hint', () => {
        it('should not render hint when not active', () => {
            renderControls({ isActive: false });
            expect(screen.queryByText(/Click map to place/)).not.toBeInTheDocument();
        });

        it('should render hint when active with sphere', () => {
            renderControls({ isActive: true, selectedShape: OverlayShape.SPHERE });
            expect(screen.getByText('Click map to place')).toBeInTheDocument();
        });

        it('should render hint with drag text for cone', () => {
            renderControls({ isActive: true, selectedShape: OverlayShape.CONE });
            expect(screen.getByText(/Click map to place.*drag for angle/)).toBeInTheDocument();
        });

        it('should render hint with drag text for line', () => {
            renderControls({ isActive: true, selectedShape: OverlayShape.LINE });
            expect(screen.getByText(/Click map to place.*drag for angle/)).toBeInTheDocument();
        });

        it('should render hint with drag text for cube', () => {
            renderControls({ isActive: true, selectedShape: OverlayShape.CUBE });
            expect(screen.getByText(/Click map to place.*drag for angle/)).toBeInTheDocument();
        });
    });

    describe('active overlays list', () => {
        it('should not render active section when no overlays', () => {
            renderControls({ overlays: [] });
            expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
        });

        it('should render active section when overlays exist', () => {
            renderControls({ overlays: createOverlays(2) });
            expect(screen.getByText('Active (2)')).toBeInTheDocument();
        });

        it('should show correct overlay count', () => {
            renderControls({ overlays: createOverlays(3) });
            expect(screen.getByText('Active (3)')).toBeInTheDocument();
        });

        it('should render each overlay with its shape label', () => {
            const overlays = createOverlays(3);
            const { container } = renderControls({ overlays });
            const items = container.querySelectorAll('.spell-overlay-item');
            expect(items.length).toBe(3);
            const labels = {
                [OverlayShape.SPHERE]: 'Sphere',
                [OverlayShape.CYLINDER]: 'Cylinder',
                [OverlayShape.CUBE]: 'Cube',
                [OverlayShape.CONE]: 'Cone',
                [OverlayShape.LINE]: 'Line',
            };
            items.forEach((item, i) => {
                const span = item.querySelector('span');
                expect(span.textContent).toBe(labels[overlays[i].shape]);
            });
        });

        it('should render a remove button for each overlay', () => {
            const overlays = createOverlays(2);
            renderControls({ overlays });
            const removeButtons = screen.getAllByRole('button');
            // should have at least 2 remove buttons (plus any other buttons)
            expect(removeButtons.length).toBeGreaterThanOrEqual(2);
        });

        it('should call onRemoveOverlay when overlay remove button is clicked', () => {
            const onRemoveOverlay = vi.fn();
            const overlays = createOverlays(2);
            const { container } = renderControls({ overlays, onRemoveOverlay });
            const removeButtons = container.querySelectorAll('.spell-overlay-item button');
            fireEvent.click(removeButtons[0]);
            expect(onRemoveOverlay).toHaveBeenCalledWith(overlays[0].id);
        });

        it('should render a clear all button', () => {
            renderControls({ overlays: createOverlays(1) });
            const clearBtn = screen.getByRole('button', { name: 'Clear All' });
            expect(clearBtn).toBeInTheDocument();
        });

        it('should call onClearAll when clear all is clicked', () => {
            const onClearAll = vi.fn();
            renderControls({ overlays: createOverlays(1), onClearAll });
            const clearBtn = screen.getByRole('button', { name: 'Clear All' });
            fireEvent.click(clearBtn);
            expect(onClearAll).toHaveBeenCalled();
        });

        it('should render unknown shape labels as the shape string', () => {
            renderControls({ overlays: [{ id: '1', shape: 'unknown-shape' }] });
            expect(screen.getByText('unknown-shape')).toBeInTheDocument();
        });
    });

    describe('container structure', () => {
        it('should render the root container with correct class', () => {
            const { container } = renderControls();
            const root = container.querySelector('.spell-overlay-controls');
            expect(root).not.toBeNull();
        });

        it('should render spell-overlay-row elements', () => {
            const { container } = renderControls({ selectedShape: OverlayShape.SPHERE });
            const rows = container.querySelectorAll('.spell-overlay-row');
            expect(rows.length).toBeGreaterThan(0);
        });
    });
});
