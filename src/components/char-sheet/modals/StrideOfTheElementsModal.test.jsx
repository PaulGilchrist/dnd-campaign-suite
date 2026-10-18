// @maintained-by-ai
/**
 * Ownership: StrideOfTheElementsModal.jsx — the movement-mode chooser UI: instruction
 * copy, exactly four STRIDE_OPTIONS rendered as exclusive radios, pre-confirm inertness,
 * exact (label, buffEntry) args to onConfirm, close via Cancel only, overlay/panel
 * inertness, and header-title fallback.
 *
 * Deferred (canon lives upstream): strideOfTheElementsHandler.test.js pins the
 * attunement gate and pass-through payload; CharSpecialActions.modals.test.jsx pins
 * chip→modal routing and CharSpecialActions.elementalEffects.test.jsx pins the
 * host-side handleStrideConfirm buff/log/popup seam against a MOCKED modal. This file
 * is the sole drift pin for STRIDE_OPTIONS content (per the handler test's delegation),
 * so confirm expectations are verbatim literals, never derived from the import.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StrideOfTheElementsModal from './StrideOfTheElementsModal.jsx';
import { STRIDE_OPTIONS } from '../../../services/automation/handlers/combat/strideOfTheElementsHandler.js';

// Verbatim drift pins — hard-coded so any label/effect/speedBonus/teleportDistance
// edit in STRIDE_OPTIONS fails these literals.
const CONFIRM_PINS = [
    ['Ice Walk', { effect: 'ice_walk' }],
    ['+10 Speed', { effect: 'speed_boost', speedBonus: 10 }],
    ['Fly Speed', { effect: 'fly_speed_equals_walk_speed' }],
    ['Teleport 30 ft', { effect: 'teleport_ready', teleportDistance: '30 ft' }],
];

function makeProps(overrides) {
    return {
        action: { name: 'Stride of the Elements' },
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

// Each radio is labelled by its wrapping <label>: "<label> — <description>"
function radioFor(option) {
    return screen.getByRole('radio', { name: `${option.label} — ${option.description}` });
}

function chooseButton() {
    return screen.getByRole('button', { name: 'Choose' });
}

function cancelButton() {
    return screen.getByRole('button', { name: 'Cancel' });
}

function checkedRadios() {
    return screen.getAllByRole('radio').filter(r => r.checked);
}

describe('StrideOfTheElementsModal', () => {

    // ── Initial render ──

    it('renders the instruction, exactly four unchecked stride radios, a disabled Choose, and Cancel', () => {
        expect(STRIDE_OPTIONS).toHaveLength(CONFIRM_PINS.length); // keep pins aligned

        render(<StrideOfTheElementsModal {...makeProps()} />);

        expect(screen.getByText('Stride of the Elements')).toBeInTheDocument();
        expect(screen.getByText('Choose a special movement type:')).toBeInTheDocument();

        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(STRIDE_OPTIONS.length);
        for (const option of STRIDE_OPTIONS) {
            expect(radioFor(option)).toBeInTheDocument();
            expect(radioFor(option)).not.toBeChecked();
        }
        expect(chooseButton()).toBeDisabled();
        expect(cancelButton()).toBeInTheDocument();
    });

    // ── Selection ──

    it('checks only the clicked radio, arms Choose, and moves selection to a newly clicked radio', () => {
        const props = makeProps();
        render(<StrideOfTheElementsModal {...props} />);

        fireEvent.click(radioFor(STRIDE_OPTIONS[0]));
        expect(checkedRadios()).toEqual([radioFor(STRIDE_OPTIONS[0])]);
        expect(chooseButton()).not.toBeDisabled();

        fireEvent.click(radioFor(STRIDE_OPTIONS[2]));
        expect(checkedRadios()).toEqual([radioFor(STRIDE_OPTIONS[2])]);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it.each(STRIDE_OPTIONS.map((option, i) => ({
        optionLabel: option.label,
        option,
        confirmArgs: CONFIRM_PINS[i],
    })))(
        'confirms $optionLabel with the exact buff payload and leaves closing to the caller',
        ({ option, confirmArgs }) => {
            const props = makeProps();
            render(<StrideOfTheElementsModal {...props} />);

            fireEvent.click(radioFor(option));
            fireEvent.click(chooseButton());

            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm).toHaveBeenCalledWith(...confirmArgs);
            expect(props.onClose).not.toHaveBeenCalled();
        },
    );

    // ── Cancel ──

    it('Cancel closes once without confirming, discarding any pending selection', () => {
        const props = makeProps();
        render(<StrideOfTheElementsModal {...props} />);

        fireEvent.click(radioFor(STRIDE_OPTIONS[1])); // pending selection
        fireEvent.click(cancelButton());

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    // ── Inertness ──

    it('is inert before any selection: disabled Choose clicks invoke neither callback', () => {
        const props = makeProps();
        render(<StrideOfTheElementsModal {...props} />);

        expect(chooseButton()).toBeDisabled();
        fireEvent.click(chooseButton());

        expect(props.onConfirm).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(checkedRadios()).toHaveLength(0);
    });

    it('overlay and panel clicks are inert and preserve the pending selection', () => {
        const props = makeProps();
        const { container } = render(<StrideOfTheElementsModal {...props} />);

        fireEvent.click(radioFor(STRIDE_OPTIONS[0])); // pending selection

        const overlay = container.firstChild;
        const panel = overlay.firstChild;
        fireEvent.click(overlay);
        fireEvent.click(panel);

        expect(props.onConfirm).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(checkedRadios()).toEqual([radioFor(STRIDE_OPTIONS[0])]);
        expect(chooseButton()).not.toBeDisabled();
    });

    // ── Header title ──

    it.each([
        { action: { name: 'Custom Stride' }, expected: 'Custom Stride' },
        { action: {}, expected: 'Stride of the Elements' },
        { action: null, expected: 'Stride of the Elements' },
        { action: undefined, expected: 'Stride of the Elements' },
    ])('shows "$expected" in the header', ({ action, expected }) => {
        render(<StrideOfTheElementsModal {...makeProps({ action })} />);
        expect(screen.getByText(expected)).toBeInTheDocument();
    });
});
