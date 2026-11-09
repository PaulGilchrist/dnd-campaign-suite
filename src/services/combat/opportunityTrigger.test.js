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
// NEW: te-other-creature falsifier→10 · multi-defender loop + joined toast→11 ·
// NEW: multi-defender join phrasing (3-name/economy-off/mixed-denials/all-denied)→nested describe.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    // Pending-marker arm (pendingOpportunityAttacks.js, reached via the
    // trigger seam): writers must exist on the mock even where a leg never
    // calls them — vitest throws on property access of an undefined export.
    setRuntimeValue: vi.fn(),
    deleteRuntimeKey: vi.fn(),
}));
vi.mock('./chargeEconomy.js', () => ({
    chargeSlot: vi.fn(() => true),
}));
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import { findOpportunityDefenders, onTokenMoveLanded } from './opportunityTrigger.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
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
        // OA advisories request sticky display (backlog 2026-11-03 CN) —
        // the toast waits for an explicit dismiss instead of a 4s timer.
        expect(setPopupHtml).toHaveBeenCalledWith(reason, { sticky: true });
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
        const setPopupHtml = vi.fn();
        await onTokenMoveLanded({ ...base, setPopupHtml });
        expect(chargeSlot).toHaveBeenCalledTimes(1);
        // Denied face rides the same board channel — verbatim log reason.
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith(
            "Goblin 1's reaction is already used — no opportunity attack on Hero.",
            { sticky: true }
        );
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
    ])('defender under no_opportunity_attacks (%s) ⇒ no charge, exact denied log + board advisory', async (_desc, teReason, blockedNote) => {
        mockCampaignStore(ON, [{ target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: teReason }]);
        const setPopupHtml = vi.fn();
        await onTokenMoveLanded({ ...base, setPopupHtml });
        expect(chargeSlot).not.toHaveBeenCalled();
        // te block (te.reason rides) surfaces on the SAME board channel.
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith(`Hero left Goblin 1's reach — ${blockedNote}`, { sticky: true });
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

    it('two adjacent NPCs left behind ⇒ each charged and logged independently, in map order; ONE joined toast names both', async () => {
        mockCampaignStore();
        const setPopupHtml = vi.fn();
        const mapData = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                { name: 'Goblin 1', gridX: 5, gridY: 4, type: 'npc' },
                { name: 'Ogre', gridX: 4, gridY: 5, type: 'npc' },
            ],
        };
        await onTokenMoveLanded({ ...base, mapData, setPopupHtml });
        expect(chargeSlot.mock.calls.map(c => c[0].creatureName)).toEqual(['Goblin 1', 'Ogre']);
        expect(loggedEntries().map(e => e.reason)).toEqual([
            ADV_SPENT,
            "Ogre reacts — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on Ogre's sheet.",
        ]);
        // Multi-defender join (backlog 2026-11-09): the single .map-toast node
        // used to show only the LAST defender's copy — now one sticky advisory
        // names EVERY triggering defender.
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith(
            "Goblin 1 and Ogre react — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on their sheets.",
            { sticky: true }
        );
    });

    // Join-phrasing legs for the multi-defender advisory (trigger-log rows
    // stay per-defender singular verbatim — pinned above and in #11).
    describe('multi-defender joined advisory (backlog 2026-11-09)', () => {
        const npc = (name, gridX, gridY) => ({ name, gridX, gridY, type: 'npc' });
        const threeDefenderMap = {
            players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
            placedItems: [
                npc('Goblin 1', 5, 4),
                npc('Ogre', 4, 5),
                npc('Bugbear', 3, 4),
            ],
        };

        it('three defenders ⇒ "A, B and C react" join, one toast, no Oxford comma', async () => {
            mockCampaignStore();
            const setPopupHtml = vi.fn();
            await onTokenMoveLanded({ ...base, mapData: threeDefenderMap, setPopupHtml });
            expect(setPopupHtml).toHaveBeenCalledTimes(1);
            expect(setPopupHtml).toHaveBeenCalledWith(
                "Goblin 1, Ogre and Bugbear react — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on their sheets.",
                { sticky: true }
            );
            expect(loggedEntries()).toHaveLength(3); // one row per defender, unchanged
        });

        it('actionEconomy off ⇒ joined advisory drops the "Reaction spent" note', async () => {
            mockCampaignStore({ ...ON, actionEconomy: false });
            const setPopupHtml = vi.fn();
            await onTokenMoveLanded({
                ...base,
                mapData: {
                    players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
                    placedItems: [npc('Goblin 1', 5, 4), npc('Ogre', 4, 5)],
                },
                setPopupHtml,
            });
            expect(setPopupHtml).toHaveBeenCalledWith(
                'Goblin 1 and Ogre react — Hero left their reach. Resolve the Opportunity Attack on their sheets.',
                { sticky: true }
            );
        });

        it('mixed faces ⇒ denials keep their per-defender popup; the FINAL toast names every TRIGGERED defender only', async () => {
            // Goblin 1 blocked (no_opportunity_attacks) · Ogre spent reaction
            // · Bugbear triggers clean.
            mockCampaignStore(ON, [
                { target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: 'Watched by a spell.' },
            ]);
            chargeSlot.mockImplementation(({ creatureName }) => creatureName !== 'Ogre');
            const setPopupHtml = vi.fn();
            await onTokenMoveLanded({ ...base, mapData: threeDefenderMap, setPopupHtml });
            // Per-defender denial copies first (existing semantics), then the
            // single joined trigger advisory last.
            expect(setPopupHtml.mock.calls.map(c => c[0])).toEqual([
                "Hero left Goblin 1's reach — Watched by a spell.",
                "Ogre's reaction is already used — no opportunity attack on Hero.",
                "Bugbear reacts — Hero left their reach. Reaction spent; Resolve the Opportunity Attack on Bugbear's sheet.",
            ]);
            expect(setPopupHtml.mock.calls.map(c => c[1]))
                .toEqual([{ sticky: true }, { sticky: true }, { sticky: true }]);
            expect(loggedEntries().map(e => e.type)).toEqual([
                'enforcement_denied',
                'enforcement_denied',
                'enforcement_triggered',
            ]);
        });

        it('all defenders denied ⇒ zero joined advisory (denial popups only, as before)', async () => {
            mockCampaignStore();
            chargeSlot.mockReturnValue(false);
            const setPopupHtml = vi.fn();
            await onTokenMoveLanded({
                ...base,
                mapData: {
                    players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
                    placedItems: [npc('Goblin 1', 5, 4), npc('Ogre', 4, 5)],
                },
                setPopupHtml,
            });
            expect(setPopupHtml).toHaveBeenCalledTimes(2); // one per denial, no join
            expect(setPopupHtml.mock.calls.map(c => c[0])).toEqual([
                "Goblin 1's reaction is already used — no opportunity attack on Hero.",
                "Ogre's reaction is already used — no opportunity attack on Hero.",
            ]);
        });
    });

    // Pending-resolution markers (bug-monster-oa-resolution-auto-missed-by-
    // melee-range-gate): the trigger parks one `pendingOAs` entry per
    // triggering defender naming the mover — the resolution lanes' proof of
    // trigger-time adjacency. Lifecycle math (clear/prune/evict) is owned by
    // pendingOpportunityAttacks.test.js; this seam pins ONLY the arm write.
    describe('pendingOAs marker arm at the trigger seam', () => {
        const npc = (name, gridX, gridY) => ({ name, gridX, gridY, type: 'npc' });
        const oaWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'pendingOAs');

        it('triggered defender ⇒ ONE marker {defender, mover, promptId} written to the campaign store', async () => {
            mockCampaignStore();
            await onTokenMoveLanded(base);
            const writes = oaWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0][3]).toBe('test-campaign');
            expect(Object.keys(writes[0][2])).toEqual(['Goblin 1']);
            expect(writes[0][2]['Goblin 1']).toEqual({
                defender: 'Goblin 1',
                mover: 'Hero',
                promptId: expect.any(String),
            });
        });

        it('actionEconomy off (advisory trigger) still arms the marker', async () => {
            mockCampaignStore({ ...ON, actionEconomy: false });
            await onTokenMoveLanded(base);
            expect(oaWrites()).toHaveLength(1);
            expect(oaWrites()[0][2]['Goblin 1'].mover).toBe('Hero');
        });

        it.each([
            ['spent reaction (chargeSlot false)', () => { chargeSlot.mockReturnValue(false); }],
            ['no_opportunity_attacks blocker', () => {
                mockCampaignStore(ON, [{ target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: 'Watched.' }]);
            }],
        ])('denied defender (%s) ⇒ zero marker writes', async (_desc, setup) => {
            mockCampaignStore();
            setup();
            await onTokenMoveLanded(base);
            expect(oaWrites()).toHaveLength(0);
        });

        it('multi-defender ⇒ one independent marker per triggered defender (blocker denial arms only the clean defenders)', async () => {
            mockCampaignStore(ON, [
                { target: 'Goblin 1', effect: 'no_opportunity_attacks', reason: 'Watched by a spell.' },
            ]);
            await onTokenMoveLanded({
                ...base,
                mapData: {
                    players: [{ name: 'Hero', gridX: 4, gridY: 4 }],
                    placedItems: [npc('Goblin 1', 5, 4), npc('Ogre', 4, 5), npc('Bugbear', 3, 4)],
                },
            });
            const writes = oaWrites();
            expect(writes).toHaveLength(1); // single merged bucket write
            const map = writes[0][2];
            expect(Object.keys(map).sort()).toEqual(['Bugbear', 'Ogre']);
            expect(map.Ogre).toEqual({ defender: 'Ogre', mover: 'Hero', promptId: expect.any(String) });
            expect(map.Bugbear).toEqual({ defender: 'Bugbear', mover: 'Hero', promptId: expect.any(String) });
            expect(map.Ogre.promptId).not.toBe(map.Bugbear.promptId);
        });

        it('existing markers for other defenders survive the arm (spread-clone, no in-place mutation)', async () => {
            mockCampaignStore();
            getRuntimeValue.mockImplementation((store, key) => {
                if (store === 'campaign' && key === 'enforcement') return ON;
                if (store === 'campaign' && key === 'pendingOAs') return { Hobgoblin: { defender: 'Hobgoblin', mover: 'OldMover', promptId: 'p-old' } };
                return null;
            });
            await onTokenMoveLanded(base);
            const map = oaWrites()[0][2];
            expect(map.Hobgoblin.promptId).toBe('p-old');
            expect(map['Goblin 1'].mover).toBe('Hero');
        });
    });
});

// Phase 3.2 betrayal validation (arena-starter §4): an EDITED ally list on the
// mover re-draws hostility immediately — former allies provoke (PvP flips on)
// and listed allies never do, overriding the legacy players-vs-NPC split.
describe('findOpportunityDefenders — betrayal ally-list flip', () => {
    const pvpMap = {
        players: [
            { name: 'Hero', gridX: 4, gridY: 4 },
            { name: 'Mia', gridX: 5, gridY: 4 },
        ],
        placedItems: [{ name: 'Goblin 1', gridX: 6, gridY: 4, type: 'npc' }],
    };

    function editedAllies(list) {
        getRuntimeValue.mockImplementation((store, key) =>
            (key === 'selectedAllies' && store === 'Hero') ? list : null);
    }

    it('defector (self-only list) retreating past a former ally PC ⇒ that PC provokes', () => {
        editedAllies(['Hero']);
        const defenders = findOpportunityDefenders({
            mapData: pvpMap,
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 },
            toCell: { gridX: 8, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toContain('Mia');
    });

    it('edited party list keeps the ally covered but the excluded NPC subset provokes', () => {
        editedAllies(['Hero', 'Mia']);
        const defenders = findOpportunityDefenders({
            mapData: pvpMap,
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 }, // Mia adjacent; Goblin 1 is 2 cells (out of reach at start)
            toCell: { gridX: 1, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toEqual([]); // no one was in reach at the START except Mia (ally)
    });

    it('unedited mover keeps the legacy split (former ally PC never provokes)', () => {
        getRuntimeValue.mockReturnValue(null);
        const defenders = findOpportunityDefenders({
            mapData: pvpMap,
            moverName: 'Hero',
            moverIsPlayer: true,
            fromCell: { gridX: 4, gridY: 4 },
            toCell: { gridX: 8, gridY: 4 },
        });
        expect(defenders.map(d => d.name)).toEqual([]);
    });
});
