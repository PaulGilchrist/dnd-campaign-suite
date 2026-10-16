// blindnessDeafnessHandler lane contract — save-or-suck modal-opener (automation registry
// 'blindness_deafness' @ index.js:526; modalName routed via useSpellCastExecutor.js:132 →
// BlindnessDeafnessModal, rendered at CharActionModals.jsx:161). Pure payload builder:
// ZERO state writes, ZERO te writes here — the CON-save, addCondition, blindnessDeafness_<cond>
// runtime keys and expirations all live in the modal's apply lane (own lane, pinned by
// BlindnessDeafnessModal.*.test.jsx which mocks this handler). No clock anywhere: the CON
// save prompt waits indefinitely via the modal. Turn-based seam only.
// NOT part of the *_target_selection vestigial tally (bane/beacon/bless/multiTarget): this
// emits type:'modal' whose renderer consumer chain is live end-to-end, and getEffectOptions
// is consumed live by BlindnessDeafnessModal.jsx — exact-table pins here preserve the
// {key,label,condition} shape the modal feeds into addCondition + effectKey composition.
// payload field set is the modal's props contract — keep the golden-path toEqual exact.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

import { handle, getEffectOptions } from './blindnessDeafnessHandler.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const mapName = 'dungeon-level-1';

function makePlayerStats(overrides = {}) {
    // handle() consumes only playerStats.name (buildSaveDc is mocked; map lookup is by name).
    return { name: casterName, ...overrides };
}

function makeAction(overrides = {}) {
    // Merge-not-replace: automation overrides land INSIDE the automation base object.
    return {
        name: 'Blindness/Deafness',
        ...overrides,
        automation: { type: 'blindness_deafness', saveDc: 15, ...overrides.automation },
    };
}

describe('getEffectOptions', () => {
    it('returns the exact blinded/deafened options table the modal consumes', () => {
        expect(getEffectOptions()).toEqual([
            { key: 'blinded', label: 'Blinded', condition: 'blinded' },
            { key: 'deafened', label: 'Deafened', condition: 'deafened' },
        ]);
    });
});

describe('blindnessDeafnessHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildSaveDc.mockReturnValue(15);
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }],
            players: [{ name: casterName, gridX: 5, gridY: 10 }],
        });
        rangeToFeet.mockReturnValue(120);
        loadMapData.mockResolvedValue(null);
    });

    it('returns the blindnessDeafness modal with the exact full payload and feeds its seams', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const cs = {
            creatures: [
                { name: 'Goblin', currentHp: 5, maxHp: 7 },
                { name: 'Orc', currentHp: 15, maxHp: 22 },
            ],
            players: [{ name: casterName, gridX: 1, gridY: 2 }],
            placedItems: [{ name: 'Crate' }],
        };
        getCombatContext.mockResolvedValue(cs);
        const errorSpy = vi.spyOn(console, 'error');

        const result = await handle(action, playerStats, campaignName, null);

        expect(buildSaveDc).toHaveBeenCalledWith({ type: 'blindness_deafness', saveDc: 15 }, playerStats);
        expect(getCombatContext).toHaveBeenCalledWith(campaignName);
        expect(result).toEqual({
            type: 'modal',
            modalName: 'blindnessDeafness',
            payload: {
                combatSummary: cs,
                attackerName: casterName,
                attackerPos: null,
                saveDc: 15,
                campaignName,
                mapData: null,
                featureName: 'Blindness/Deafness',
                rangeFeet: 120,
            },
        });
        // valid DC: no error logging (handler logs only on null/default-10, below)
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it.each([{ dc: null }, { dc: 10 } ])(
        'logs console.error when saveDc computes to $dc but still opens the modal carrying it',
        async ({ dc }) => {
            buildSaveDc.mockReturnValue(dc);
            const errorSpy = vi.spyOn(console, 'error');

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Could not compute spell save DC'),
            );
            expect(result.type).toBe('modal');
            expect(result.payload.saveDc).toBe(dc);
            errorSpy.mockRestore();
        },
    );

    it('pins the rangeFeet chain: rangeToFeet(automation.range), defaulting to 120', async () => {
        rangeToFeet.mockReturnValue(60);
        let result = await handle(makeAction({ automation: { range: '60ft' } }), makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(60);

        rangeToFeet.mockReturnValue(150);
        result = await handle(makeAction({ automation: { range: '150ft' } }), makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(150);

        rangeToFeet.mockReturnValue(null);
        result = await handle(makeAction({ automation: { range: '5ft' } }), makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(120); // null/0 → rules default

        result = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(result.payload.rangeFeet).toBe(120); // missing range → same default

        // seam is fed automation.range verbatim, in call order
        expect(rangeToFeet.mock.calls.map(c => c[0])).toEqual(['60ft', '150ft', '5ft', undefined]);
    });

    it('resolves attackerPos by caster name from the map and passes mapData through', async () => {
        const mockMapData = {
            name: mapName,
            players: [
                { name: 'OtherPlayer', gridX: 3, gridY: 7 },
                { name: casterName, gridX: 10, gridY: 20 },
            ],
            tiles: [],
        };
        loadMapData.mockResolvedValue(mockMapData);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(loadMapData).toHaveBeenCalledWith(campaignName, mapName);
        expect(result.payload.attackerPos).toEqual({ gridX: 10, gridY: 20 });
        expect(result.payload.mapData).toBe(mockMapData);
    });

    it.each([{ map: null }, { map: '' } ])(
        'leaves attackerPos/mapData null and skips loadMapData without a mapName ($map)',
        async ({ map }) => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, map);

            expect(loadMapData).not.toHaveBeenCalled();
            expect(result.payload.attackerPos).toBeNull();
            expect(result.payload.mapData).toBeNull();
        },
    );

    it('reports null attackerPos but still ships mapData when the caster is not on the map', async () => {
        loadMapData.mockResolvedValue({ players: [{ name: 'OtherPlayer', gridX: 3, gridY: 7 }] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toBeNull();
        expect(result.payload.mapData).toEqual({ players: [{ name: 'OtherPlayer', gridX: 3, gridY: 7 }] });
    });

    it('degrades to null attackerPos/mapData when the map load rejects (warns, never throws)', async () => {
        loadMapData.mockRejectedValueOnce(new Error('map not found'));
        const warnSpy = vi.spyOn(console, 'warn');

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toBeNull();
        expect(result.payload.mapData).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Attacker position unavailable'),
            expect.any(Error),
        );
        warnSpy.mockRestore();
    });

    it('fails fast with a TypeError when the action has no automation, before any combat read', async () => {
        await expect(
            handle({ name: 'Blindness/Deafness' }, makePlayerStats(), campaignName, null),
        ).rejects.toThrow(TypeError);

        // Ordering proof: the auto.range read throws before getCombatContext is touched.
        expect(getCombatContext).not.toHaveBeenCalled();
    });
});
