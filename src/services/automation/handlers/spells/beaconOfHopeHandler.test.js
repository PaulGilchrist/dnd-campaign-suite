// @maintained-by-ai
// beaconOfHopeHandler lane contract — Beacon of Hope (automation registry 'beacon_of_hope:' @ index.js:608).
// Live dispatch: spellCastService/execution/triggerSpells.js → beaconOfHopeService.triggerBeaconOfHope →
// executeHandler → handle(). handle() side effects: one resolveMapPositions + one getCombatContext read;
// ZERO state writes here — the concentration 'beacon_of_hope' targetEffect is written by
// applyBeaconOfHopeEffect on the confirm lane (duration is a concentration latch, never a clock).
// Live apply caller: useSimpleSpellHandlers.js:299 via the
// pendingBeaconOfHope picker gate (spellGates.js:426 → CreatureTargetPopups.jsx:59 →
// handleBeaconOfHopeConfirm). (confirmBeaconOfHope forwarder excised #1338 — zero callers.) Metamagic confirm-payload delegation is pinned in
// useSpellMetamagicFlow/confirm-payloads.test.js — not re-pinned here.
// VESTIGIAL OUTPUT FLAG (bane/enhanceAbility SP-039 precedent): 'beacon_of_hope_target_selection'
// currently has ZERO renderer consumers — the live picker is the pendingBeaconOfHope gate above.
// These exact-key pins preserve the dispatch contract should the popup lane be rewired; kept
// full-payload toEqual, not toHaveProperty walks.
// Downstream consumers of the written targetEffects rows (own lanes, not tested here):
// SavePromptModal WIS-advantage gate, automationPassives, conditionEffects/.Compute badges,
// concentrationService drain by te.caster, restRules short/long clear, useInitiativeEffects clear.
// Honest quirks pinned: the apply popup and logs always report the REQUESTED target count
// ('${targetNames.length} of ${targetNames.length}', 'N creature(s) affected'), never the fresh-added
// count; the cast log is skipped only when ALL targets were duplicates (reasons.length === 0).
// Log spellLevel reads action.spell?.level || 3 — spellSlotLevel is deliberately NOT consulted
// on the log side (handle() payload slotLevel does consult it); pinned below.
// bless mirror seam (#1877): bless/bane lanes closed; this lane keeps the merge-not-replace
// makeAction shape (automation overrides land INSIDE the { type: 'beacon_of_hope' } base).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => parseInt(r.replace(' feet', ''), 10) || 30),
}));

import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as targetEffectDefs from '../../../combat/conditions/targetEffectDefinitions.js';
import * as targetResolver from '../../common/targetResolver.js';
import { handle, applyBeaconOfHopeEffect } from './beaconOfHopeHandler.js';

const campaignName = 'TestCampaign';
const casterName = 'Cleric1';

function makePlayerStats(overrides = {}) {
    // handle() consumes only playerStats.name (map-position seam); apply() reads .name too.
    return { name: casterName, ...overrides };
}

function makeAction(overrides = {}) {
    // Merge-not-replace: automation overrides land INSIDE the { type: 'beacon_of_hope' } base.
    return {
        name: 'Beacon of Hope',
        automation: { type: 'beacon_of_hope', ...overrides.automation },
        spell: { range: '30 feet', level: 3, casting_time: '1 action', ...overrides.spell },
        spellSlotLevel: overrides.spellSlotLevel,
    };
}

const baseCombatContext = {
    creatures: [{ name: 'Goblin' }, { name: 'Orc' }],
};

function beaconEntry(target, label = 'Beacon of Hope') {
    // Full written-row shape per handler L103-110: reasons[0] mirrors the entry identity fields.
    return {
        target,
        effect: 'beacon_of_hope',
        label,
        caster: casterName,
        duration: 'concentration',
        reasons: [
            {
                name: label,
                caster: casterName,
                timestamp: expect.any(Number),
                duration: 'concentration',
            },
        ],
    };
}

// ─── handle ───

describe('handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
        targetResolver.resolveMapPositions.mockResolvedValue({});
    });

    it.each([{ ctx: null }, { ctx: undefined }])(
        'returns the automation_info popup when combat context is $ctx',
        async ({ ctx }) => {
            damageUtils.getCombatContext.mockResolvedValue(ctx);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'main-map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Beacon of Hope',
                    description: 'No combat context found. Cannot apply Beacon of Hope.',
                },
            });
        },
    );

    it('returns the beacon_of_hope_target_selection popup with the exact full payload', async () => {
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 5, y: 10 } });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'main-map');

        expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(campaignName, 'main-map', casterName);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'beacon_of_hope_target_selection',
                name: 'Beacon of Hope',
                creatureTargets: ['Goblin', 'Orc'],
                range: '30 feet',
                rangeFt: 30,
                slotLevel: 3,
                attackerPos: { x: 5, y: 10 },
                automation: { type: 'beacon_of_hope' },
            },
        });
    });

    it('pins the range fallback chain automation > spell > "30 feet" default', async () => {
        const automationResult = await handle(
            makeAction({ automation: { range: '60 feet', customField: 'value' } }),
            makePlayerStats(),
            campaignName,
            null,
        );
        expect(automationResult.payload.range).toBe('60 feet');
        expect(automationResult.payload.rangeFt).toBe(60);
        expect(automationResult.payload.automation).toEqual({ type: 'beacon_of_hope', range: '60 feet', customField: 'value' });

        const spellResult = await handle(
            makeAction({ spell: { range: '45 feet' } }),
            makePlayerStats(),
            campaignName,
            null,
        );
        expect(spellResult.payload.range).toBe('45 feet');
        expect(spellResult.payload.rangeFt).toBe(45);

        const defaultResult = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(defaultResult.payload.range).toBe('30 feet');
        expect(defaultResult.payload.rangeFt).toBe(30);

        // rangeToFeet seam is fed the resolved string, in order.
        expect(rangeValidation.rangeToFeet.mock.calls.map((c) => c[0])).toEqual(['60 feet', '45 feet', '30 feet']);
    });

    it('pins the slot-level chain spellSlotLevel > spell.level > 3', async () => {
        let result = await handle(makeAction({ spellSlotLevel: 5 }), makePlayerStats(), campaignName, null);
        expect(result.payload.slotLevel).toBe(5);

        result = await handle(makeAction({ spell: { level: 4 } }), makePlayerStats(), campaignName, null);
        expect(result.payload.slotLevel).toBe(4);

        result = await handle({ name: 'Beacon of Hope' }, makePlayerStats(), campaignName, null);
        expect(result.payload.slotLevel).toBe(3);
    });

    it('defaults missing automation/spell and reports null attackerPos without a mapName', async () => {
        const result = await handle({ name: 'Beacon of Hope' }, makePlayerStats(), campaignName, null);

        expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
        expect(result.payload).toEqual({
            type: 'beacon_of_hope_target_selection',
            name: 'Beacon of Hope',
            creatureTargets: ['Goblin', 'Orc'],
            range: '30 feet',
            rangeFt: 30,
            slotLevel: 3,
            attackerPos: null,
            automation: {},
        });
    });
});

// ─── applyBeaconOfHopeEffect ───

describe('applyBeaconOfHopeEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        targetEffectDefs.getEffectDefinition.mockReturnValue({ label: 'Beacon of Hope' });
        runtimeState.getRuntimeValue.mockReturnValue([]);
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty array', []],
        ['a non-array string', 'Goblin'],
    ])('returns null and writes nothing when targetNames is %s', async (_label, targetNames) => {
        const result = await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            targetNames,
        );

        expect(result).toBeNull();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('writes the exact full targetEffects rows and returns the exact popup payload', async () => {
        const result = await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin', 'Orc'],
        );

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
        expect(targetEffectDefs.getEffectDefinition).toHaveBeenCalledWith('beacon_of_hope');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [beaconEntry('Goblin'), beaconEntry('Orc')],
            campaignName,
            true, // skipSync=true — server-first write, no SSE echo re-POST
        );
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Beacon of Hope',
                description: '2 of 2 target(s) affected by Beacon of Hope.',
            },
        });
    });

    it('dedupes same-target beacon_of_hope while preserving unrelated existing rows verbatim', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', label: 'Faerie Fire' },
            { target: 'Goblin', effect: 'beacon_of_hope', label: 'Old Beacon' },
        ]);

        await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin', 'Orc'],
        );

        // Exact write: both existing rows kept untouched (same field sets), ONE new Orc row.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Goblin', effect: 'faerie_fire', label: 'Faerie Fire' },
                { target: 'Goblin', effect: 'beacon_of_hope', label: 'Old Beacon' },
                beaconEntry('Orc'),
            ],
            campaignName,
            true,
        );
    });

    it.each([
        [{ label: 'Custom Beacon Label' }, 'Custom Beacon Label'],
        [null, 'Beacon of Hope'],
    ])('sources the row label from the registry definition %j (fallback when absent)', async (def, label) => {
        targetEffectDefs.getEffectDefinition.mockReturnValue(def);

        await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin'],
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [beaconEntry('Goblin', label)],
            campaignName,
            true,
        );
    });

    it('logs the cast entry and summary entry with full strings and fields', async () => {
        const { addEntry } = await import('../../../ui/logService.js');

        await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin', 'Orc'],
        );

        expect(addEntry).toHaveBeenCalledTimes(2);
        const [campaignArg, castEntry] = addEntry.mock.calls[0];
        expect(campaignArg).toBe(campaignName);
        expect(castEntry).toEqual({
            type: 'spell',
            characterName: casterName,
            targetName: 'Goblin',
            targets: ['Goblin', 'Orc'],
            spellName: 'Beacon of Hope',
            spellLevel: 3,
            castingTime: '1 action',
            description: 'Cleric1 casts Beacon of Hope on Goblin, Orc. Targets gain advantage on WIS saves and death saves, and regain maximum HP from healing.',
            timestamp: expect.any(Number),
        });
        const [, summaryEntry] = addEntry.mock.calls[1];
        expect(summaryEntry.description).toBe('Beacon of Hope cast: 2 creature(s) affected.');
        expect(summaryEntry.spellName).toBe('Beacon of Hope');
    });

    it('reads spell.level for the log spellLevel — spellSlotLevel is ignored on the log side', async () => {
        const { addEntry } = await import('../../../ui/logService.js');

        await applyBeaconOfHopeEffect(
            makeAction({ spell: { level: 5, casting_time: '1 bonus action' } }),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin'],
        );
        expect(addEntry.mock.calls[0][1].spellLevel).toBe(5);
        expect(addEntry.mock.calls[0][1].castingTime).toBe('1 bonus action');

        // Minimal action: spell-level default 3 and casting_time default '1 action';
        // spellSlotLevel: 5 with no spell object still logs level 3 (quirk pinned).
        addEntry.mockClear();
        await applyBeaconOfHopeEffect(
            { name: 'Beacon of Hope', spellSlotLevel: 5 },
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin'],
        );
        expect(addEntry.mock.calls[0][1].spellLevel).toBe(3);
        expect(addEntry.mock.calls[0][1].castingTime).toBe('1 action');
    });

    it('writes nothing and logs nothing when every target already has beacon_of_hope, still returning the N-of-N popup', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'beacon_of_hope' },
            { target: 'Orc', effect: 'beacon_of_hope' },
        ]);
        const { addEntry } = await import('../../../ui/logService.js');

        const result = await applyBeaconOfHopeEffect(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Goblin', 'Orc'],
        );

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        // Quirk: the popup always reports requested counts, even with zero fresh effects.
        expect(result.payload.description).toBe('2 of 2 target(s) affected by Beacon of Hope.');
    });
});
