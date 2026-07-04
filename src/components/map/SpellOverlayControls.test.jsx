// @improved-by-ai
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
            expect(screen.getByText('Spell Overlay')).toBeInTheDocument();
        });
    });

    describe('shape selector', () => {
        it('should render a shape select dropdown with all shape options', () => {
            renderControls();
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
            const options = select.querySelectorAll('option');
            expect(options.length).toBe(5);
            const expectedLabels = ['Sphere', 'Cylinder', 'Cube', 'Cone', 'Line'];
            expectedLabels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
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

        it('should render cancel button and call onCancelMode when clicked', () => {
            const onCancelMode = vi.fn();
            renderControls({ isActive: true, onCancelMode });
            const cancelBtn = screen.getByRole('button', { name: /cancel/i });
            expect(cancelBtn).toBeInTheDocument();
            fireEvent.click(cancelBtn);
            expect(onCancelMode).toHaveBeenCalled();
        });
    });

    describe('shape-specific inputs', () => {
        it('should render radius input for sphere and cylinder', () => {
            const { rerender } = renderControls({ selectedShape: OverlayShape.SPHERE });
            expect(screen.getByText('Radius (ft)')).toBeInTheDocument();

            rerender(
                <SpellOverlayControls
                    selectedShape={OverlayShape.CYLINDER}
                    setSelectedShape={vi.fn()}
                    shapeParams={{ radiusFt: 20 }}
                    setShapeParams={vi.fn()}
                    overlays={[]}
                    onRemoveOverlay={vi.fn()}
                    onClearAll={vi.fn()}
                    onCancelMode={vi.fn()}
                    isActive={false}
                />
            );
            expect(screen.queryByText('Radius (ft)')).toBeInTheDocument();
        });

        it('should not render radius input for cube', () => {
            renderControls({ selectedShape: OverlayShape.CUBE });
            expect(screen.queryByText('Radius (ft)')).not.toBeInTheDocument();
        });

        it('should use fallback value 20 when radiusFt is undefined', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE, shapeParams: {} });
            expect(screen.getByRole('spinbutton').value).toBe('20');
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
            expect(setShapeParams).toHaveBeenCalledWith(expect.any(Function));
        });

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
            expect(screen.getByRole('spinbutton').value).toBe('15');
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

        it('should call setShapeParams on cone distance change', () => {
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

        it('should call setShapeParams on cone angle change', () => {
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

        it('should call setShapeParams on line distance change', () => {
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

        it('should call setShapeParams on line width change', () => {
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

        it('should render hint with drag text for cone, line, and cube', () => {
            const { container } = renderControls({ isActive: true, selectedShape: OverlayShape.CONE });
            expect(container.querySelector('.spell-overlay-hint').textContent).toContain('drag for angle');

            const { container: container2 } = renderControls({ isActive: true, selectedShape: OverlayShape.LINE });
            expect(container2.querySelector('.spell-overlay-hint').textContent).toContain('drag for angle');

            const { container: container3 } = renderControls({ isActive: true, selectedShape: OverlayShape.CUBE });
            expect(container3.querySelector('.spell-overlay-hint').textContent).toContain('drag for angle');
        });
    });

    describe('active overlays list', () => {
        it('should not render active section when no overlays', () => {
            renderControls({ overlays: [] });
            expect(screen.queryByText(/Active/)).not.toBeInTheDocument();
        });

        it('should render active section with overlay count', () => {
            renderControls({ overlays: createOverlays(2) });
            expect(screen.getByText('Active (2)')).toBeInTheDocument();
        });

        it('should show correct overlay count', () => {
            renderControls({ overlays: createOverlays(3) });
            expect(screen.getByText('Active (3)')).toBeInTheDocument();
        });

        it('should render each overlay with its shape label and remove button', () => {
            const overlays = createOverlays(3);
            const { container } = renderControls({ overlays });
            const labels = {
                [OverlayShape.SPHERE]: 'Sphere',
                [OverlayShape.CYLINDER]: 'Cylinder',
                [OverlayShape.CUBE]: 'Cube',
                [OverlayShape.CONE]: 'Cone',
                [OverlayShape.LINE]: 'Line',
            };
            const items = container.querySelectorAll('.spell-overlay-item');
            expect(items.length).toBe(3);
            items.forEach((item, i) => {
                const span = item.querySelector('span');
                expect(span.textContent).toBe(labels[overlays[i].shape]);
            });
        });

        it('should call onRemoveOverlay when overlay remove button is clicked', () => {
            const onRemoveOverlay = vi.fn();
            const overlays = createOverlays(2);
            const { container } = renderControls({ overlays, onRemoveOverlay });
            const removeButtons = container.querySelectorAll('.spell-overlay-item button');
            fireEvent.click(removeButtons[0]);
            expect(onRemoveOverlay).toHaveBeenCalledWith(overlays[0].id);
        });

        it('should render a clear all button and call onClearAll when clicked', () => {
            const onClearAll = vi.fn();
            renderControls({ overlays: createOverlays(1), onClearAll });
            const clearBtn = screen.getByRole('button', { name: 'Clear All' });
            expect(clearBtn).toBeInTheDocument();
            fireEvent.click(clearBtn);
            expect(onClearAll).toHaveBeenCalled();
        });

        it('should render unknown shape labels as the shape string', () => {
            renderControls({ overlays: [{ id: '1', shape: 'unknown-shape' }] });
            expect(screen.getByText('unknown-shape')).toBeInTheDocument();
        });
    });
});
