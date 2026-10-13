// L5-003 §8.4 — opportunity-attack trigger engine tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));
vi.mock('./chargeEconomy.js', () => ({
    chargeSlot: vi.fn(() => true),
}));
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { findOpportunityDefenders, onTokenMoveLanded } from './opportunityTrigger.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { chargeSlot } from './chargeEconomy.js';
import { addEntry } from '../ui/logService.js';

const ON = { mode: 'on', opportunityAttacks: true, actionEconomy: true };

function mapWith(over = {}) {
    return {
        players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
        placedItems: [{ name: 'Goblin 1', gridX: 5, gridY: 4, type: 'npc' }],
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    chargeSlot.mockReturnValue(true);
});

describe('findOpportunityDefenders (pure)', () => {
    it('player moving AWAY from an adjacent NPC ⇒ that NPC reacts', () => {
        const defenders = findOpportunityDefenders({
            mapData: mapWith(),
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 },
            toCell: { gridX: 7, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toEqual(['Goblin 1']);
    });

    it('moving within reach (adjacent→adjacent) does NOT provoke', () => {
        const defenders = findOpportunityDefenders({
            mapData: mapWith(),
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 },
            toCell: { gridX: 4, gridY: 5 },
        });
        expect(defenders).toEqual([]);
    });

    it('starting outside reach never provokes', () => {
        const defenders = findOpportunityDefenders({
            mapData: mapWith(),
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 2, gridY: 2 },
            toCell: { gridX: 0, gridY: 0 },
        });
        expect(defenders).toEqual([]);
    });

    it('NPC mover retreating from a player ⇒ the player reacts (mapDataRef shape)', () => {
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [{ name: 'Goblin 1', gridX: 5, gridY: 4 }],
        };
        const defenders = findOpportunityDefenders({
            mapData,
            moverName: 'Goblin 1',
            moverIsPlayer: false,
            fromCell: { gridX: 5, gridY: 4 },
            toCell: { gridX: 8, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toEqual(['Hero']);
    });

    it('NPC↔NPC and player↔player never provoke (no faction truth on the map)', () => {
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                { name: 'Ally', gridX: 5, gridY: 4, type: 'player' },
                { name: 'Goblin 2', gridX: 3, gridY: 4, type: 'npc' },
            ],
        };
        // Hero moves away — only the NPC reacts, never the second player.
        const defenders = findOpportunityDefenders({
            mapData,
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 },
            toCell: { gridX: 10, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toEqual(['Goblin 2']);
    });
});

describe('onTokenMoveLanded', () => {
    const base = {
        campaignName: 'test-campaign',
        moverName: 'Hero',
        moverIsPlayer: true,
        fromCell: { gridX: 4, gridY: 4 },
        toCell: { gridX: 7, gridY: 4 },
        mapData: mapWith(),
    };

    it('enforcement off ⇒ synchronous no-op, zero charges, zero logs', async () => {
        getRuntimeValue.mockReturnValue(null);
        await onTokenMoveLanded(base);
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('no move (same cell) ⇒ no-op even when enforced', async () => {
        getRuntimeValue.mockReturnValue(ON);
        await onTokenMoveLanded({ ...base, toCell: { gridX: 4, gridY: 4 } });
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('enforced: reaction charged + enforcement_triggered advisory', async () => {
        getRuntimeValue.mockReturnValue(ON);
        await onTokenMoveLanded(base);
        expect(chargeSlot).toHaveBeenCalledWith({ creatureName: 'Goblin 1', bucket: 'reaction', campaignName: 'test-campaign' });
        const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'enforcement_triggered');
        expect(log).toBeDefined();
        expect(log.reason).toContain('Goblin 1 reacts');
        expect(log.reason).toContain('Reaction spent');
    });

    it('spent reaction ⇒ enforcement_denied bucket reaction, no advisory', async () => {
        getRuntimeValue.mockReturnValue(ON);
        chargeSlot.mockReturnValue(false);
        await onTokenMoveLanded(base);
        const denied = addEntry.mock.calls.map(c => c[1]).find(e => e.bucket === 'reaction');
        expect(denied).toBeDefined();
        expect(denied.reason).toContain('reaction is already used');
    });

    it('defender under no_opportunity_attacks ⇒ denied with the te reason', async () => {
        getRuntimeValue.mockImplementation((store, key) => {
            if (store === 'campaign' && key === 'enforcement') return ON;
            if (store === 'campaign' && key === 'targetEffects') {
                return [{ target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: 'Watched by a spell.' }];
            }
            return null;
        });
        await onTokenMoveLanded(base);
        expect(chargeSlot).not.toHaveBeenCalled();
        const denied = addEntry.mock.calls.map(c => c[1]).find(e => e.bucket === 'opportunityAttack');
        expect(denied.reason).toContain('Watched by a spell.');
    });

    it('actionEconomy OFF ⇒ advisory only, no charge, no spent-denial', async () => {
        getRuntimeValue.mockReturnValue({ mode: 'on', opportunityAttacks: true, actionEconomy: false });
        await onTokenMoveLanded(base);
        expect(chargeSlot).not.toHaveBeenCalled();
        const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'enforcement_triggered');
        expect(log.reason).toContain('Goblin 1 reacts');
        expect(log.reason).not.toContain('Reaction spent');
    });
});
