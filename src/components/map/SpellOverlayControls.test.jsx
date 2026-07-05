// @cleaned-by-ai
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
            expect(setShapeParams).toHaveBeenCalledTimes(1);
        });

        it('should show the selected shape in the dropdown', () => {
            const { container } = renderControls({ selectedShape: OverlayShape.CONE });
            const select = container.querySelector('select');
            expect(select.value).toBe('cone');
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
            const { container, rerender } = render(
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
                />
            );
            expect(container.querySelector('.spell-overlay-row')).toBeInTheDocument();

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
            expect(container.querySelector('.spell-overlay-row')).toBeInTheDocument();
        });

        it('should render size input for cube', () => {
            renderControls({ selectedShape: OverlayShape.CUBE });
            expect(screen.getByText('Size (ft)')).toBeInTheDocument();
        });

        it('should render distance and angle inputs for cone', () => {
            renderControls({ selectedShape: OverlayShape.CONE });
            expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
            expect(screen.getByText('Angle (°)')).toBeInTheDocument();
        });

        it('should render distance and width inputs for line', () => {
            renderControls({ selectedShape: OverlayShape.LINE });
            expect(screen.getByText('Distance (ft)')).toBeInTheDocument();
            expect(screen.getByText('Width (ft)')).toBeInTheDocument();
        });

        it('should update params on shape input change', () => {
            const setShapeParams = vi.fn();
            renderControls({
                selectedShape: OverlayShape.SPHERE,
                shapeParams: { radiusFt: 20 },
                setShapeParams,
            });
            const input = screen.getByRole('spinbutton');
            fireEvent.change(input, { target: { value: '30' } });
            expect(setShapeParams).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should use fallback values when params are missing', () => {
            renderControls({ selectedShape: OverlayShape.SPHERE, shapeParams: {} });
            const input = screen.getByRole('spinbutton');
            expect(input.value).toBe('20');
        });

        it('should parse invalid input as 0', () => {
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
    });

    describe('activity hint', () => {
        it('should not render hint when not active', () => {
            renderControls({ isActive: false });
            expect(screen.queryByText(/Click map to place/)).not.toBeInTheDocument();
        });

        it('should render hint when active', () => {
            renderControls({ isActive: true, selectedShape: OverlayShape.SPHERE });
            expect(screen.getByText('Click map to place')).toBeInTheDocument();
        });

        it('should include drag text for cone, line, and cube', () => {
            const { container } = renderControls({ isActive: true, selectedShape: OverlayShape.CONE });
            expect(container.querySelector('.spell-overlay-hint').textContent).toContain('drag for angle');
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
    });
});
