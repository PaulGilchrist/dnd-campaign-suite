import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CelestialResilienceModal from './CelestialResilienceModal.jsx';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockCreatureTargets = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
];

const defaultProps = {
    creatureTargets: mockCreatureTargets,
    allyTempHp: 3,
    selfTempHp: 7,
    maxTargets: 5,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
};

function makeProps(overrides) {
    return { ...defaultProps, ...(overrides || {}) };
}

// ── Tests ──

describe('CelestialResilienceModal', () => {
    // ── Rendering ──

    describe('initial render', () => {
        it('renders the Celestial Resilience title', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText('Celestial Resilience')).toBeInTheDocument();
        });

        it('renders the shield-hart icon in the header', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(document.querySelector('.sp-header .fa-solid.fa-shield-hart')).toBeInTheDocument();
        });

        it('renders all creature targets from creatureTargets prop', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText('Ally1')).toBeInTheDocument();
            expect(screen.getByText('Ally2')).toBeInTheDocument();
        });

        it('renders the confirm button with "Grant Resilience" label', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Grant Resilience \(0\)/ })).toBeInTheDocument();
        });

        it('renders the shield-hart icon on the confirm button', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            const btn = screen.getByRole('button', { name: /Grant Resilience/ });
            expect(btn.querySelector('.fa-solid.fa-shield-hart')).toBeInTheDocument();
        });

        it('renders the Skip button', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });
    });

    // ── Description rendering ──

    describe('description rendering', () => {
        it('renders the description with maxTargets when provided', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText(/Choose up to 5 allies to gain temporary hit points/)).toBeInTheDocument();
        });

        it('renders the description without maxTargets when maxTargets is falsy', () => {
            render(<CelestialResilienceModal {...makeProps({ maxTargets: 0 })} />);
            expect(screen.getByText(/Choose up to 5 allies to gain temporary hit points/)).toBeInTheDocument();
        });
    });

    // ── Note rendering ──

    describe('note rendering', () => {
        it('renders the note with self temp HP value', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText(/You gain 7 temporary hit points/)).toBeInTheDocument();
        });

        it('renders the note with ally temp HP value', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText(/Each selected ally gains 3 temporary hit points/)).toBeInTheDocument();
        });

        it('reflects different self temp HP values', () => {
            render(<CelestialResilienceModal {...makeProps({ selfTempHp: 10 })} />);
            expect(screen.getByText(/You gain 10 temporary hit points/)).toBeInTheDocument();
        });

        it('reflects different ally temp HP values', () => {
            render(<CelestialResilienceModal {...makeProps({ allyTempHp: 5 })} />);
            expect(screen.getByText(/Each selected ally gains 5 temporary hit points/)).toBeInTheDocument();
        });

        it('renders the note inside a sp-note element', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(document.querySelector('.sp-note')).toBeInTheDocument();
        });
    });

    // ── Empty targets ──

    describe('empty targets', () => {
        it('shows "No targets available." when creatureTargets is empty', () => {
            render(<CelestialResilienceModal {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });
    });

    // ── Callback passthrough ──

    describe('callback passthrough', () => {
        it('renders without crashing with no callbacks', () => {
            render(<CelestialResilienceModal {...makeProps({ onConfirm: undefined, onSkip: undefined })} />);
            expect(screen.getByText('Celestial Resilience')).toBeInTheDocument();
        });
    });
});
