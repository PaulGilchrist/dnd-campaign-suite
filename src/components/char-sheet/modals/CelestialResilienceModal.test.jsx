import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CelestialResilienceModal from './CelestialResilienceModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockCreatureTargets = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 15, maxHp: 25 },
    { name: 'Ally3', type: 'npc', currentHp: 50, maxHp: 50 },
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

describe('CelestialResilienceModal', () => {
    describe('note interpolation', () => {
        it('renders note with default self and ally temp HP values', () => {
            render(<CelestialResilienceModal {...makeProps()} />);
            expect(screen.getByText(/You gain 7 temporary hit points/)).toBeInTheDocument();
            expect(screen.getByText(/Each selected ally gains 3 temporary hit points/)).toBeInTheDocument();
        });

        it('renders note with custom self temp HP', () => {
            render(<CelestialResilienceModal {...makeProps({ selfTempHp: 10 })} />);
            expect(screen.getByText(/You gain 10 temporary hit points/)).toBeInTheDocument();
        });

        it('renders note with custom ally temp HP', () => {
            render(<CelestialResilienceModal {...makeProps({ allyTempHp: 5 })} />);
            expect(screen.getByText(/Each selected ally gains 5 temporary hit points/)).toBeInTheDocument();
        });

        it('renders note with zero temp HP values', () => {
            render(<CelestialResilienceModal {...makeProps({ allyTempHp: 0, selfTempHp: 0 })} />);
            expect(screen.getByText(/You gain 0 temporary hit points/)).toBeInTheDocument();
            expect(screen.getByText(/Each selected ally gains 0 temporary hit points/)).toBeInTheDocument();
        });

        it('renders note with large temp HP values', () => {
            render(<CelestialResilienceModal {...makeProps({ allyTempHp: 100, selfTempHp: 200 })} />);
            expect(screen.getByText(/You gain 200 temporary hit points/)).toBeInTheDocument();
            expect(screen.getByText(/Each selected ally gains 100 temporary hit points/)).toBeInTheDocument();
        });
    });
});
