import React from 'react';
import { render, screen } from '@testing-library/react';
import { getStore, notify } from '../../hooks/runtime/useRuntimeState.js';
import TurnEconomyStrip from './TurnEconomyStrip.jsx';

function setCampaignStore(map) {
    const store = getStore('campaign');
    for (const [k, v] of Object.entries(map)) store.set(k, v);
    notify('campaign');
}

beforeEach(() => {
    getStore('campaign').clear();
});

describe('TurnEconomyStrip (L5-001)', () => {
    it('renders nothing while enforcement is off/unset (L1–4 unchanged)', () => {
        const { container } = render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        expect(container).toBeEmptyDOMElement();
        setCampaignStore({ enforcement: { mode: 'off' } });
        const { container: c2 } = render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        expect(c2).toBeEmptyDOMElement();
    });

    it('shows full budget at turn start', () => {
        setCampaignStore({ enforcement: { mode: 'on', turnLock: true, actionEconomy: true } });
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        expect(screen.getByLabelText('Turn economy for Rakan')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Bonus')).toBeInTheDocument();
        expect(screen.getByText('Reaction')).toBeInTheDocument();
        expect(screen.getByText('0/30 ft')).toBeInTheDocument();
    });

    it('shows spent states and remaining movement from turnState', () => {
        setCampaignStore({
            enforcement: { mode: 'on' },
            turnState: {
                Rakan: { actionsUsed: 1, bonusActionsUsed: 0, reactionsUsed: 1, movementUsedFeet: 30, hasMoved: true, turnActive: true },
            },
        });
        render(<TurnEconomyStrip creatureName="Rakan" speedFeet={30} />);
        expect(screen.getByText('Action used')).toBeInTheDocument();
        expect(screen.getByText('Bonus')).toBeInTheDocument();
        expect(screen.getByText('Reaction used')).toBeInTheDocument();
        expect(screen.getByText('30/30 ft')).toBeInTheDocument();
    });

    it('falls back to 30 ft default speed when unknown', () => {
        setCampaignStore({ enforcement: { mode: 'on' } });
        render(<TurnEconomyStrip creatureName="Goblin" />);
        expect(screen.getByText('0/30 ft')).toBeInTheDocument();
    });

    it('does not render for empty creature name', () => {
        setCampaignStore({ enforcement: { mode: 'on' } });
        const { container } = render(<TurnEconomyStrip creatureName={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});
