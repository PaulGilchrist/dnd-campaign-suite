// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonSpiritModal from './SummonSpiritModal.jsx';

// Modal-UI lane only: render/copy, selection, exact confirm payload, cancel.
// Summon resolution internals (tokens, AC/HP ladder, concentration) live in
// services/automation/handlers/spells/summonSpiritHandler.test.js; the
// modal→handler wiring is pinned in CharActionModals.async-confirm-handlers.test.jsx.

// 'Water' intentionally lacks a description so every interaction path also
// exercises the optional-description branch.
const VARIANTS = [
    { name: 'Bestial Spirit (Air)', description: 'Flies at 60 ft.' },
    { name: 'Bestial Spirit (Land)', description: 'Walks and climbs at 30 ft.' },
    { name: 'Bestial Spirit (Water)' },
];

function makeProps(overrides) {
    return {
        action: {
            name: 'Summon Beast',
            automation: { type: 'summon_spirit', typeLabel: 'Bestial Spirit', variants: VARIANTS },
        },
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        ...(overrides || {}),
    };
}

function variantButton(name) {
    return screen.getByRole('button', { name: new RegExp(`^${name}`) });
}

function clickSummon() {
    fireEvent.click(screen.getByRole('button', { name: /Summon/ }));
}

describe('SummonSpiritModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the action name, prompt, and one button per variant, with a description only when the variant provides one', () => {
        render(<SummonSpiritModal {...makeProps()} />);

        expect(screen.getByText('Summon Beast')).toBeInTheDocument();
        expect(screen.getByText('Choose the form your summoned creature takes:')).toBeInTheDocument();

        // Descriptions render inside their variant button only when present.
        expect(variantButton('Bestial Spirit \\(Air\\)')).toHaveTextContent('Flies at 60 ft.');
        expect(variantButton('Bestial Spirit \\(Land\\)')).toHaveTextContent('Walks and climbs at 30 ft.');
        expect(variantButton('Bestial Spirit \\(Water\\)')).toHaveAccessibleName('Bestial Spirit (Water)');
    });

    it('renders no variant options and keeps Summon disabled when the variants array is empty', () => {
        render(
            <SummonSpiritModal
                {...makeProps({ action: { name: 'Summon Spirit', automation: { variants: [] } } })}
            />
        );

        expect(screen.getByText('Summon Spirit')).toBeInTheDocument();
        expect(screen.queryByText('Choose the form your summoned creature takes:')).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(2); // Summon + Cancel only
        expect(screen.getByRole('button', { name: /Summon/ })).toBeDisabled();
    });

    it('keeps Summon disabled and inert until a variant is selected, and variant clicks neither confirm nor close', () => {
        const props = makeProps();
        render(<SummonSpiritModal {...props} />);

        const summonButton = screen.getByRole('button', { name: /Summon/ });
        expect(summonButton).toBeDisabled();
        clickSummon();
        expect(props.onConfirm).not.toHaveBeenCalled();

        fireEvent.click(variantButton('Bestial Spirit \\(Air\\)'));
        expect(props.onConfirm).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();

        expect(summonButton).toBeEnabled();
    });

    it('confirms with the exact variant name and follows the latest selection, including variants without descriptions', () => {
        const props = makeProps();
        render(<SummonSpiritModal {...props} />);

        fireEvent.click(variantButton('Bestial Spirit \\(Air\\)'));
        clickSummon();
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).toHaveBeenCalledWith('Bestial Spirit (Air)');

        // Switching to the description-less variant must update the payload.
        fireEvent.click(variantButton('Bestial Spirit \\(Water\\)'));
        clickSummon();
        expect(props.onConfirm).toHaveBeenCalledTimes(2);
        expect(props.onConfirm).toHaveBeenLastCalledWith('Bestial Spirit (Water)');
    });

    it('closes via Cancel without confirming', () => {
        const props = makeProps();
        render(<SummonSpiritModal {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });
});
