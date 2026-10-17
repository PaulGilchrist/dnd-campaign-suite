// @maintained-by-ai
/**
 * Ownership: DestructiveStrideModal.jsx — the damage-type picker UI: exact
 * option rendering, Choose Type gating/disabled state, verbatim pass-through
 * args to the handler seam, same-object payload identity through onConfirm,
 * unconditional onClose after skip, and inertness on overlay/panel clicks.
 *
 * Deferred (canon lives upstream): destructiveStrideHandler lanes pin
 * applyDamageTypeChoice/skipTargetChoice internals (runtime stamps, buffs,
 * campaign log); CharSpecialActions modals/modalOnClose elemental lanes pin
 * the caller seams (open/close wiring, destructiveStrideTarget handoff).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DestructiveStrideModal from './DestructiveStrideModal.jsx';
import { applyDamageTypeChoice, skipTargetChoice } from '../../../services/automation/handlers/combat/destructiveStrideHandler.js';

// Mock the handler functions that the modal calls — payload shapes mirror the
// real contracts; behaviour of those payloads is pinned in the handler tests.
vi.mock('../../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
    applyDamageTypeChoice: vi.fn(),
    skipTargetChoice: vi.fn(),
}));

// Component-private DAMAGE_TYPES/DAMAGE_DATA mirrored as fixtures — drift
// here fails the radio-name assertions below, which is the point.
const DAMAGE_OPTIONS = [
    { type: 'Acid', description: 'Corrosive acid damage.' },
    { type: 'Cold', description: 'Biting cold damage.' },
    { type: 'Fire', description: 'Searing fire damage.' },
    { type: 'Lightning', description: 'Crackling lightning damage.' },
    { type: 'Thunder', description: 'Deafening thunder damage.' },
];

function makeProps(overrides) {
    return {
        action: { name: 'Destructive Stride' },
        playerStats: { name: 'TestMonk', level: 5 },
        campaignName: 'test-campaign',
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

// Each radio is labelled by its wrapping <label>: "<Type> — <description>."
function radioFor(option) {
    return screen.getByRole('radio', { name: `${option.type} — ${option.description}` });
}

function chooseTypeButton() {
    return screen.getByRole('button', { name: 'Choose Type' });
}

function skipButton() {
    return screen.getByRole('button', { name: 'Skip Target' });
}

afterEach(() => {
    applyDamageTypeChoice.mockReset();
    skipTargetChoice.mockReset();
});

describe('DestructiveStrideModal', () => {

    // ── Initial render ──

    describe('initial render', () => {
        it('renders the instruction, the proximity note, and exactly the five damage radios', () => {
            render(<DestructiveStrideModal {...makeProps()} />);

            expect(screen.getByText('Choose the damage type for Destructive Stride:')).toBeInTheDocument();
            expect(screen.getByText('Note: Choose a creature only if the monk comes within 5 ft. of them while striding.')).toBeInTheDocument();

            const radios = screen.getAllByRole('radio');
            expect(radios).toHaveLength(DAMAGE_OPTIONS.length);
            for (const option of DAMAGE_OPTIONS) {
                expect(radioFor(option)).toBeInTheDocument();
                expect(radioFor(option)).not.toBeChecked();
            }
        });

        it.each(DAMAGE_OPTIONS)(
            'selecting $type checks only that radio and arms Choose Type',
            async (option) => {
                render(<DestructiveStrideModal {...makeProps()} />);

                expect(chooseTypeButton()).toBeDisabled();
                fireEvent.click(radioFor(option));

                expect(radioFor(option)).toBeChecked();
                expect(screen.getAllByRole('radio').filter(r => r.checked)).toEqual([radioFor(option)]);
                expect(chooseTypeButton()).not.toBeDisabled();
            },
        );

        it('switches selection when a different option is clicked', () => {
            render(<DestructiveStrideModal {...makeProps()} />);

            const [acid, fire] = DAMAGE_OPTIONS;
            fireEvent.click(radioFor(acid));
            fireEvent.click(radioFor(fire));

            expect(radioFor(acid)).not.toBeChecked();
            expect(radioFor(fire)).toBeChecked();
        });

        it.each([
            ['no action', undefined],
            ['action without a name', {}],
        ])('falls back to the canonical title with %s', (_label, action) => {
            render(<DestructiveStrideModal {...makeProps({ action })} />);
            expect(screen.getByText('Destructive Stride')).toBeInTheDocument();
        });

        it('displays a custom action name in the header when provided', () => {
            render(<DestructiveStrideModal {...makeProps({ action: { name: 'Custom Stride' } })} />);
            expect(screen.getByText('Custom Stride')).toBeInTheDocument();
        });
    });

    // ── Confirm flow (handleApply) ──

    describe('confirm flow', () => {
        it.each(DAMAGE_OPTIONS)(
            'confirms $type with verbatim pass-through args and forwards the modal result identity',
            async (option) => {
                const props = makeProps();
                const result = {
                    type: 'modal',
                    modalName: 'destructiveStrideTarget',
                    payload: { chosenType: option.type, targets: [] },
                };
                applyDamageTypeChoice.mockResolvedValue(result);

                render(<DestructiveStrideModal {...props} />);
                fireEvent.click(radioFor(option));
                fireEvent.click(chooseTypeButton());

                await waitFor(() => expect(applyDamageTypeChoice).toHaveBeenCalledTimes(1));
                expect(applyDamageTypeChoice).toHaveBeenCalledWith(
                    props.action,
                    props.playerStats,
                    props.campaignName,
                    option.type,
                );
                await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
                expect(props.onConfirm.mock.calls[0][0]).toBe(result);
                expect(props.onClose).not.toHaveBeenCalled();
                expect(skipTargetChoice).not.toHaveBeenCalled();
            },
        );

        it('forwards a popup result from applyDamageTypeChoice unchanged (modal stays the caller\'s to close)', async () => {
            const props = makeProps();
            const result = { type: 'popup', payload: { type: 'automation_info' } };
            applyDamageTypeChoice.mockResolvedValue(result);

            render(<DestructiveStrideModal {...props} />);
            fireEvent.click(radioFor(DAMAGE_OPTIONS[2])); // Fire
            fireEvent.click(chooseTypeButton());

            await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
            expect(props.onConfirm.mock.calls[0][0]).toBe(result);
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it.each([
            ['null', null],
            ['undefined', undefined],
            ['a non-forwarded result type', { type: 'none' }],
        ])('stays open and silent when applyDamageTypeChoice returns %s', async (_label, result) => {
            const props = makeProps();
            applyDamageTypeChoice.mockResolvedValue(result);

            render(<DestructiveStrideModal {...props} />);
            fireEvent.click(radioFor(DAMAGE_OPTIONS[2])); // Fire
            fireEvent.click(chooseTypeButton());

            await waitFor(() => expect(applyDamageTypeChoice).toHaveBeenCalledTimes(1));
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(props.onClose).not.toHaveBeenCalled();
            // Selection is preserved so the player can retry.
            expect(radioFor(DAMAGE_OPTIONS[2])).toBeChecked();
            expect(chooseTypeButton()).not.toBeDisabled();
        });

        it('is inert before any selection: Choose Type starts disabled and never invokes the handler', () => {
            const props = makeProps();

            render(<DestructiveStrideModal {...props} />);
            expect(chooseTypeButton()).toBeDisabled();
            fireEvent.click(chooseTypeButton());

            expect(applyDamageTypeChoice).not.toHaveBeenCalled();
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });

    // ── Skip flow (handleSkip) ──

    describe('skip flow', () => {
        it('calls skipTargetChoice with verbatim args, forwards the popup result, and closes unconditionally', async () => {
            const props = makeProps();
            const result = { type: 'popup', payload: { type: 'automation_info' } };
            skipTargetChoice.mockResolvedValue(result);

            render(<DestructiveStrideModal {...props} />);
            fireEvent.click(skipButton());

            await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
            expect(skipTargetChoice).toHaveBeenCalledWith(
                props.action,
                props.playerStats,
                props.campaignName,
            );
            expect(props.onConfirm).toHaveBeenCalledTimes(1);
            expect(props.onConfirm.mock.calls[0][0]).toBe(result);
            expect(applyDamageTypeChoice).not.toHaveBeenCalled();
        });

        it('still closes without confirming when skipTargetChoice returns no result', async () => {
            const props = makeProps();
            skipTargetChoice.mockResolvedValue(null);

            render(<DestructiveStrideModal {...props} />);
            fireEvent.click(skipButton());

            await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
            expect(props.onConfirm).not.toHaveBeenCalled();
        });
    });

    // ── Inertness: overlay, panel, and the absence of a close affordance ──

    describe('inertness', () => {
        it('overlay and panel clicks are inert and preserve the pending selection', () => {
            const props = makeProps();

            const { container } = render(<DestructiveStrideModal {...props} />);
            fireEvent.click(radioFor(DAMAGE_OPTIONS[2])); // Fire

            const overlay = container.firstChild;
            const panel = overlay.firstChild;
            fireEvent.click(overlay);
            fireEvent.click(panel);

            expect(skipTargetChoice).not.toHaveBeenCalled();
            expect(applyDamageTypeChoice).not.toHaveBeenCalled();
            expect(props.onConfirm).not.toHaveBeenCalled();
            expect(props.onClose).not.toHaveBeenCalled();
            expect(radioFor(DAMAGE_OPTIONS[2])).toBeChecked();
        });

        it('offers no close button — dismissal is via Skip Target only', () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            expect(screen.queryByRole('button', { name: /close|dismiss|cancel/i })).not.toBeInTheDocument();
        });
    });
});
