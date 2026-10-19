// @maintained-by-ai
// L5-003 §8.4 — opportunity-attack trigger engine tests.
// Lane: trigger predicate + per-defender reaction consumption. Defender-detection internals are
// OWNED HERE — consumer hooks (usePlayerDragging/useSelectMove/useItemDragging) mock this module
// and pin only their own commit payloads; sheet resolution lives in
// CharReactions.opportunityAttack.test.jsx; te registry display lives in EffectAdder /
// ConditionEffectBadges tests.
// Constant-cite: MELEE_REACH_FEET (5 ft) and OPPORTUNITY_ATTACK bytes are owned by
// baseCombatActions.test.js #985 — cited here, never re-pinned. The `reachFeet` param is
// default-only (no production caller overrides), so no override leg is authored.
// Reach edge math (from the cited 5 ft default): 1 cell of separation is the inside edge
// (5 <= 5), 2 cells is the just-outside edge (10 > 5) — both legs exercised, hand-derived once.
// Old→new map: away-triggers→1 · within-reach / never-in-reach→2(it.each) · NPC-mover→3
// (strengthened: adjacent NPC never provokes) · player↔player→4 · enforcement-off→5(it.each,
// guards folded + fast-path read census) · no-move→6(it.each, invalid-cell guards folded) ·
// enforced-charge + actionEconomy-off→7(it.each folded, exact log/popup bytes) · spent-reaction→8
// (exact bytes, no-advisory asserted) · no_opportunity_attacks→9(it.each incl. default reason) ·
// NEW: te-other-creature falsifier→10 · NEW: multi-defender loop→11.
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

const ADV_SPENT = "Goblin 1 reacts — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on Goblin 1's sheet.";
const ADV_ADVISORY = "Goblin 1 reacts — Hero left their reach. Resolve the Opportunity Attack on Goblin 1's sheet.";

function mapWith(over = {}) {
    return {
        players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
        placedItems: [{ name: 'Goblin 1', gridX: 5, gridY: 4, type: 'npc' }],
        ...over,
    };
}

function mockCampaignStore(enforcement = ON, targetEffects = []) {
    getRuntimeValue.mockImplementation((store, key) => {
        if (store === 'campaign' && key === 'enforcement') return enforcement;
        if (store === 'campaign' && key === 'targetEffects') return targetEffects;
        return null;
    });
}

const loggedEntries = () => addEntry.mock.calls.map(c => c[1]);

beforeEach(() => {
    vi.clearAllMocks();
    // Explicit falsy defaults so keyed mockImplementations from earlier tests never leak.
    getRuntimeValue.mockReturnValue(null);
    chargeSlot.mockReturnValue(true);
});

describe('findOpportunityDefenders (pure)', () => {
    it('player moving away across the reach edge ⇒ exactly the adjacent NPC reacts', () => {
        const defenders = findOpportunityDefenders({
            mapData: mapWith(),
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 }, // 1 cell (5 ft) from Goblin 1 — inside edge
            toCell: { gridX: 7, gridY: 4 }, // 2 cells (10 ft) — just outside edge
        });
        expect(defenders.map(d => d.name)).toEqual(['Goblin 1']);
    });

    it.each([
        ['stays within reach after the move', { gridX: 4, gridY: 4 }, { gridX: 4, gridY: 5 }],
        ['starts already outside reach', { gridX: 7, gridY: 4 }, { gridX: 9, gridY: 4 }],
    ])('%s ⇒ never provokes', (_desc, fromCell, toCell) => {
        const defenders = findOpportunityDefenders({
            mapData: mapWith(),
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell,
            toCell,
        });
        expect(defenders).toEqual([]);
    });

    it('NPC mover retreating from a player ⇒ exactly that player reacts; adjacent NPCs never provoke', () => {
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                { name: 'Goblin 1', gridX: 5, gridY: 4 }, // the mover
                { name: 'Goblin 2', gridX: 6, gridY: 4 }, // in-reach-at-from, outside-at-to — must not appear
            ],
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

    it('player-type tokens in placedItems never provoke a player mover', () => {
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                { name: 'Ally', gridX: 5, gridY: 4, type: 'player' }, // same-side; geometrically would provoke
                { name: 'Goblin 2', gridX: 3, gridY: 4, type: 'npc' },
            ],
        };
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

    it.each([
        ['enforcement unset', null],
        ['enforcement mode off', { mode: 'off', opportunityAttacks: true, actionEconomy: true }],
        ['opportunityAttacks flag off', { mode: 'on', opportunityAttacks: false, actionEconomy: true }],
    ])('off-switch — %s ⇒ zero charges, zero logs, and only the enforcement flag is read', async (_desc, enforcement) => {
        mockCampaignStore(enforcement);
        await onTokenMoveLanded(base);
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'enforcement');
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        ['same-cell move (zero distance)', { gridX: 4, gridY: 4 }, { gridX: 4, gridY: 4 }],
        ['fromCell without finite coordinates', { gridX: 'x', gridY: 4 }, { gridX: 7, gridY: 4 }],
        ['missing toCell', { gridX: 4, gridY: 4 }, null],
    ])('guards — %s ⇒ no-op even when enforced', async (_desc, fromCell, toCell) => {
        mockCampaignStore();
        await onTokenMoveLanded({ ...base, fromCell, toCell });
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        [true, ADV_SPENT],
        [false, ADV_ADVISORY],
    ])('enforced trigger — actionEconomy %s ⇒ exact advisory log + popup; reaction charged only while the economy is live', async (actionEconomy, reason) => {
        mockCampaignStore({ ...ON, actionEconomy });
        const setPopupHtml = vi.fn();
        await onTokenMoveLanded({ ...base, setPopupHtml });
        expect(chargeSlot).toHaveBeenCalledTimes(actionEconomy ? 1 : 0);
        if (actionEconomy) {
            expect(chargeSlot).toHaveBeenCalledWith({ creatureName: 'Goblin 1', bucket: 'reaction', campaignName: 'test-campaign' });
        }
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith(reason);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_triggered',
            creature: 'Goblin 1',
            target: 'Hero',
            bucket: 'opportunityAttack',
            source: 'token-move',
            reason,
        });
    });

    it('reaction already spent ⇒ charge attempted once, exact denied log, no triggered advisory', async () => {
        mockCampaignStore();
        chargeSlot.mockReturnValue(false);
        await onTokenMoveLanded(base);
        expect(chargeSlot).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Goblin 1',
            target: 'Hero',
            bucket: 'reaction',
            source: 'opportunity-attack-trigger',
            reason: "Goblin 1's reaction is already used — no opportunity attack on Hero.",
        });
    });

    it.each([
        ['te carries its own reason', 'Watched by a spell.', 'Watched by a spell.'],
        ['te carries no reason', undefined, 'A condition prevents opportunity attacks.'],
    ])('defender under no_opportunity_attacks (%s) ⇒ no charge, exact denied log', async (_desc, teReason, blockedNote) => {
        mockCampaignStore(ON, [{ target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: teReason }]);
        await onTokenMoveLanded(base);
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'enforcement_denied',
            creature: 'Goblin 1',
            target: 'Hero',
            bucket: 'opportunityAttack',
            source: 'token-move',
            reason: `Hero left Goblin 1's reach — ${blockedNote}`,
        });
    });

    it('no_opportunity_attacks on ANOTHER creature does not block the defender', async () => {
        mockCampaignStore(ON, [{ target: 'Somebody Else', effect: 'no_opportunity_attacks', reason: 'Not them.' }]);
        await onTokenMoveLanded(base);
        expect(chargeSlot).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(loggedEntries()[0].type).toBe('enforcement_triggered');
    });

    it('two adjacent NPCs left behind ⇒ each charged and logged independently, in map order', async () => {
        mockCampaignStore();
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                { name: 'Goblin 1', gridX: 5, gridY: 4, type: 'npc' },
                { name: 'Ogre', gridX: 4, gridY: 5, type: 'npc' },
            ],
        };
        await onTokenMoveLanded({ ...base, mapData });
        expect(chargeSlot.mock.calls.map(c => c[0].creatureName)).toEqual(['Goblin 1', 'Ogre']);
        expect(loggedEntries().map(e => e.reason)).toEqual([
            ADV_SPENT,
            "Ogre reacts — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on Ogre's sheet.",
        ]);
    });
});
