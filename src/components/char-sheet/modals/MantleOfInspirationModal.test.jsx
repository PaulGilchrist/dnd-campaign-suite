import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MantleOfInspirationModal from './MantleOfInspirationModal.jsx';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockCreatureTargets = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
];

const defaultProps = {
    creatureTargets: mockCreatureTargets,
    tempHp: 5,
    dieRoll: 4,
    bardicDieSize: 6,
    maxTargets: 2,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
};

function makeProps(overrides) {
    return { ...defaultProps, ...(overrides || {}) };
}

// ── Tests ──

describe('MantleOfInspirationModal', () => {
    // ── Rendering ──

    describe('initial render', () => {
        it('renders the Mantle of Inspiration title', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByText('Mantle of Inspiration')).toBeInTheDocument();
        });

        it('renders the feather icon in the header', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(document.querySelector('.sp-header .fa-solid.fa-feather')).toBeInTheDocument();
        });

        it('renders all creature targets from creatureTargets prop', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByText('Ally1')).toBeInTheDocument();
            expect(screen.getByText('Ally2')).toBeInTheDocument();
        });

        it('renders the confirm button with "Inspire" label', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeInTheDocument();
        });

        it('renders the feather icon on the confirm button', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            const btn = screen.getByRole('button', { name: /Inspire/ });
            expect(btn.querySelector('.fa-solid.fa-feather')).toBeInTheDocument();
        });

        it('renders the Skip button', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });
    });

    // ── Description rendering ──

    describe('description rendering', () => {
        it('renders the description with maxTargets when provided', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByText(/Choose up to 2 allies to grant temporary hit points/)).toBeInTheDocument();
        });

        it('renders the description without maxTargets when maxTargets is falsy', () => {
            render(<MantleOfInspirationModal {...makeProps({ maxTargets: 0 })} />);
            expect(screen.getByText(/Choose allies to grant temporary hit points/)).toBeInTheDocument();
        });

        it('renders the description without maxTargets when maxTargets is null', () => {
            render(<MantleOfInspirationModal {...makeProps({ maxTargets: null })} />);
            expect(screen.getByText(/Choose allies to grant temporary hit points/)).toBeInTheDocument();
        });

        it('renders the description without maxTargets when maxTargets is undefined', () => {
            render(<MantleOfInspirationModal {...makeProps({ maxTargets: undefined })} />);
            expect(screen.getByText(/Choose allies to grant temporary hit points/)).toBeInTheDocument();
        });
    });

    // ── Note rendering ──

    describe('note rendering', () => {
        it('renders the note with rolled die value and bardic die size', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByText(/Rolled 4 on 1d6:/)).toBeInTheDocument();
        });

        it('renders the note with the correct temp HP value', () => {
            render(<MantleOfInspirationModal {...makeProps({ tempHp: 10 })} />);
            expect(screen.getByText(/Each target gains 10 temp HP/)).toBeInTheDocument();
        });

        it('renders the note mentioning Reaction movement without Opportunity Attacks', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(screen.getByText(/can use their Reaction to move up to their Speed without provoking Opportunity Attacks/)).toBeInTheDocument();
        });

        it('renders the note inside an sp-note element', () => {
            render(<MantleOfInspirationModal {...makeProps()} />);
            expect(document.querySelector('.sp-note')).toBeInTheDocument();
        });
    });

    // ── Dynamic values ──

    describe('dynamic values', () => {
        it('reflects different die roll values in the note', () => {
            render(<MantleOfInspirationModal {...makeProps({ dieRoll: 1 })} />);
            expect(screen.getByText(/Rolled 1 on 1d6:/)).toBeInTheDocument();
        });

        it('reflects different bardic die sizes in the note', () => {
            render(<MantleOfInspirationModal {...makeProps({ bardicDieSize: 8 })} />);
            expect(screen.getByText(/Rolled 4 on 1d8:/)).toBeInTheDocument();
        });

        it('reflects different temp HP values in the note', () => {
            render(<MantleOfInspirationModal {...makeProps({ tempHp: 1 })} />);
            expect(screen.getByText(/Each target gains 1 temp HP/)).toBeInTheDocument();
        });

        it('reflects different maxTargets in both description and note', () => {
            render(<MantleOfInspirationModal {...makeProps({ maxTargets: 5 })} />);
            expect(screen.getByText(/Choose up to 5 allies to grant temporary hit points/)).toBeInTheDocument();
        });
    });

    // ── Empty targets ──

    describe('empty targets', () => {
        it('shows "No targets available." when creatureTargets is empty', () => {
            render(<MantleOfInspirationModal {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });
    });

    // ── Callback passthrough ──

    describe('callback passthrough', () => {
        it('renders without crashing with no callbacks', () => {
            render(<MantleOfInspirationModal {...makeProps({ onConfirm: undefined, onSkip: undefined })} />);
            expect(screen.getByText('Mantle of Inspiration')).toBeInTheDocument();
        });
    });
});
