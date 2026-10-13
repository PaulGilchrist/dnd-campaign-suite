import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const synced = {};
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => {
        if (!(prop in synced)) synced[prop] = defaultValue;
        return [synced[prop], (v) => { synced[prop] = v; }];
    },
}));
vi.mock('../../services/ui/clientId.js', () => ({
    getClientId: () => 'cid-test-1',
}));

import EnforcementSection from './EnforcementSection.jsx';

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
});

describe('EnforcementSection (L5-001)', () => {
    const characters = [{ name: 'Rakan' }, { name: 'Mira' }];

    it('renders master switch OFF by default with referee unassigned', () => {
        render(<EnforcementSection campaignName="test-campaign" characters={characters} />);
        expect(document.querySelector('.enforcement-master span').textContent).toBe('Enforcement OFF');
        expect(screen.getByText(/No referee assigned/)).toBeInTheDocument();
        expect(screen.getByText(/cid-test-1/)).toBeInTheDocument();
    });

    it('sub-flag inputs are disabled while enforcement is OFF', () => {
        render(<EnforcementSection campaignName="test-campaign" characters={characters} />);
        const fieldset = document.querySelector('.enforcement-flags');
        expect(fieldset.disabled).toBe(true);
    });

    it('flipping the master switch writes enforcement through the synced setter', () => {
        render(<EnforcementSection campaignName="test-campaign" characters={characters} />);
        const master = document.querySelector('.enforcement-master input[type="checkbox"]');
        fireEvent.click(master);
        expect(synced.enforcement).toMatchObject({ mode: 'on', turnLock: false });
    });

    it('claim referee writes { name, clientId }', () => {
        render(<EnforcementSection campaignName="test-campaign" characters={characters} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Mira' } });
        fireEvent.click(screen.getByRole('button', { name: /Claim Referee/ }));
        expect(synced.referee).toEqual({ name: 'Mira', clientId: 'cid-test-1' });
    });

    it('shows the active referee and offers Release', () => {
        synced.referee = { name: 'Rakan', clientId: 'cid-test-1' };
        render(<EnforcementSection campaignName="test-campaign" characters={characters} />);
        expect(screen.getByText(/Referee:/)).toBeInTheDocument();
        expect(screen.getByText('(this browser)')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Release/ }));
        expect(synced.referee).toBeNull();
    });
});
