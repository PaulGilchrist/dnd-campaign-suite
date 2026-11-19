// @maintained-by-ai
// "In Play" strip contract: conditions and effects surface from the runtime
// character stores and the campaign targetEffects key; the combat block
// surfaces from the combatSummary lane (store echo AND cold-mount cache
// fallback) without ever writing back.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import GMScreenInPlay from './GMScreenInPlay.jsx';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../services/encounters/combatData.js';
import { makePartyMember, seedCharStore, clearGMScreenStores, CAMPAIGN } from './gm-test-utils.jsx';

afterEach(() => {
    clearGMScreenStores(['Aragorn']);
});

function renderInPlay(party, campaignEffects = []) {
    return render(
        <GMScreenInPlay party={party} campaignName={CAMPAIGN} campaignEffects={campaignEffects} />
    );
}

describe('GMScreenInPlay', () => {
    it('clean table: placeholder only — no phantom rows', () => {
        renderInPlay([makePartyMember()]);
        expect(screen.getByText('No zones or markers on the table.')).toBeInTheDocument();
        expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
        expect(screen.queryByText(/Combat —/)).not.toBeInTheDocument();
    });

    it('party conditions surface as labelled rows from the runtime store', () => {
        seedCharStore('Aragorn', { activeConditions: ['poisoned'] });
        renderInPlay([makePartyMember()]);
        const line = screen.getByText('Aragorn').closest('.gm-inplay-line');
        expect(line).toHaveTextContent('Poisoned');
        expect(screen.queryByText('No zones or markers on the table.')).toBeInTheDocument();
        // (the zones line stays honest: a condition is not a zone)
    });

    it('campaign target effects badge the party member they target', () => {
        renderInPlay([makePartyMember()], [
            { target: 'Aragorn', effect: 'disadvantage_next_attack', source: 'Rime' },
        ]);
        expect(screen.getByText('Aragorn')).toBeInTheDocument();
        expect(document.querySelector('.gm-inplay-line')).toHaveTextContent('Disadv On Next Attack Roll');
        expect(screen.queryByText('No zones or markers on the table.')).not.toBeInTheDocument();
    });

    it('effects targeting creatures outside the party list as unassigned', () => {
        renderInPlay([makePartyMember()], [
            { target: 'Goblin', effect: 'disadvantage_next_attack' },
        ]);
        expect(screen.getByText('Unassigned effects')).toBeInTheDocument();
        expect(document.querySelector('.gm-inplay-line')).toHaveTextContent('Disadv On Next Attack Roll');
    });

    it('combat rows render from the live combatSummary store echo', () => {
        getStore('combatSummary').set('round', 2);
        getStore('combatSummary').set('creatures', [
            { name: 'Aragorn', type: 'player', currentHp: 22, maxHp: 30, conditions: [] },
            { name: 'Goblin', type: 'monster', currentHp: 0, maxHp: 7, conditions: [{ key: 'prone', label: 'Prone' }] },
        ]);
        getStore('campaign').set('activeCreatureName', 'Goblin');
        seedCharStore('Aragorn', { currentHitPoints: 22 });
        renderInPlay([makePartyMember()]);
        expect(screen.getByText(/Combat — round 2/)).toBeInTheDocument();
        expect(screen.getByText('active: Goblin')).toBeInTheDocument();
        expect(screen.getByText('22 / 30')).toBeInTheDocument();
        const goblinLine = screen.getByText('Goblin').closest('.gm-inplay-line');
        expect(goblinLine).toHaveTextContent('0 / 7');
        expect(goblinLine.querySelector('.gm-combat-hp')).toHaveClass('gm-hp-down');
        expect(goblinLine).toHaveTextContent('Prone');
    });

    it('player combat rows ignore the board placeholder and mirror the sheet', () => {
        // A join-stamped player board row carries 1/1 until the sheet syncs;
        // the In Play block must show the runtime HP, not the placeholder.
        getStore('combatSummary').set('creatures', [
            { name: 'Aragorn', type: 'player', currentHp: 1, maxHp: 1, conditions: [] },
        ]);
        seedCharStore('Aragorn', { currentHitPoints: 18 });
        renderInPlay([makePartyMember()]);
        const line = screen.getByText('Aragorn').closest('.gm-inplay-line');
        expect(line).toHaveTextContent('18 / 30');
        expect(line).not.toHaveTextContent('1 / 1');
    });

    it('combat rows fall back to the combatData cache on a cold mount', () => {
        setCombatSummaryCache({ round: 1, creatures: [{ name: 'Orc', type: 'monster', currentHp: 7, maxHp: 15, conditions: [] }] }, CAMPAIGN);
        renderInPlay([makePartyMember()]);
        expect(screen.getByText(/Combat — round 1/)).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });
});
