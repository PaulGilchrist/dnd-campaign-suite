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

import EnforcementSection from './EnforcementSection.jsx';

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
});

describe('EnforcementSection (L5-001)', () => {
    it('renders master switch OFF by default', () => {
        render(<EnforcementSection campaignName="test-campaign" />);
        expect(document.querySelector('.enforcement-master span').textContent).toBe('Enforcement OFF');
        expect(screen.queryByText(/Referee/)).not.toBeInTheDocument();
    });

    it('sub-flag inputs are disabled while enforcement is OFF', () => {
        render(<EnforcementSection campaignName="test-campaign" />);
        const fieldset = document.querySelector('.enforcement-flags');
        expect(fieldset.disabled).toBe(true);
    });

    it('flipping the master switch writes enforcement through the synced setter', () => {
        render(<EnforcementSection campaignName="test-campaign" />);
        const master = document.querySelector('.enforcement-master input[type="checkbox"]');
        fireEvent.click(master);
        expect(synced.enforcement).toMatchObject({ mode: 'on', turnLock: false });
    });
});
