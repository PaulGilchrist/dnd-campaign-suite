// @maintained-by-ai: 2026-10-16
// Press/write side of the Sanctuary lane. handle() is the automation/index.js
// registry entry for type 'sanctuary' (targetEffects write + expiration anchor,
// manifest-verified live 2026-10-08); endSanctuary() is the self-break removal,
// live at useLoggedDiceRollAttack.js:52, contextBuilder-sync.js:57 and
// spellCastService/execution/index.js:575.
// The WIS-save prompt consumption seam is owned by
// hooks/combat/handlers/handleSanctuarySave.test.js (distinct module, inline
// te lookup — never imports this handler's queries).
// isSanctuaryActive / getSanctuaryTarget have no direct production caller
// (re-export only via automation/index.js:635) — one minimal pin each.
// Breaks at event seams only: rounds: undefined, expireOnCreatureName anchor —
// never a minutes×N clock (no-timers policy; '1 minute' is combat-scoped).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import {
    handle,
    isSanctuaryActive,
    endSanctuary,
    getSanctuaryTarget,
} from './sanctuaryHandler.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'Cleric1';
const targetName = 'Rogue1';

function makeAction(automation = {}, metaCtx = {}) {
    return {
        name: 'Sanctuary',
        automation: { type: 'sanctuary', ...automation },
        metaCtx,
    };
}

// The setRuntimeValue('campaign', 'targetEffects', ...) write, or undefined.
const effectWrite = () =>
    setRuntimeValue.mock.calls.findLast(c => c[0] === 'campaign' && c[1] === 'targetEffects');

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── handle ───

describe('sanctuaryHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes the sanctuary targetEffect with the exact runtime call shape', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);

        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
        // 4-arg write: ('campaign', 'targetEffects', list, campaignName).
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
            target: targetName,
            effect: 'sanctuary',
            source: casterName,
            duration: '1 minute',
            saveDc: 13,
        }], campaignName);
    });

    it('falls back to 8 + proficiency when spellAbilities.saveDc is missing (with console.error)', async () => {
        getRuntimeValue.mockReturnValue([]);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await handle(makeAction({}, { targetName }), { name: casterName, proficiency: 3 }, campaignName, null);

        expect(effectWrite()[2][0].saveDc).toBe(11);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('replaces an existing sanctuary from the same caster on the same target', async () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName, duration: '1 minute', saveDc: 10 },
        ]);

        await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 15 } }, campaignName, null);

        const written = effectWrite()[2];
        expect(written).toHaveLength(1);
        expect(written[0].saveDc).toBe(15);
    });

    it('pushes alongside a sanctuary on the same target from a different caster', async () => {
        // Same target, different source — isolates the source leg of the
        // replace-key (a missing metaCtx would hit the target leg instead).
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: 'Cleric2', duration: '1 minute', saveDc: 12 },
        ]);

        await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 15 } }, campaignName, null);

        const written = effectWrite()[2];
        expect(written).toHaveLength(2);
        expect(written[0].source).toBe('Cleric2');
        expect(written[1].source).toBe(casterName);
        expect(written[1].saveDc).toBe(15);
    });

    it('returns popup with exact automation_info contract and mechanics description', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sanctuary');
        expect(result.payload.targetName).toBe(targetName);
        expect(result.payload.automationType).toBe('sanctuary');
        expect(result.payload.description).toBe(
            'Sanctuary activated on Rogue1 — creatures targeting Rogue1 with attacks or damaging spells must succeed on a WIS save or lose the attack/spell. Spell ends if Rogue1 attacks, casts a spell, or deals damage.'
        );
    });

    it('resolves targetName from metaCtx, falling back to Unknown', async () => {
        getRuntimeValue.mockReturnValue([]);

        const named = await handle(makeAction({}, { targetName: 'Barbarian1' }), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);
        expect(named.payload.targetName).toBe('Barbarian1');
        expect(named.payload.description).toContain('Barbarian1');

        const fallback = await handle(makeAction(), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);
        expect(fallback.payload.targetName).toBe('Unknown');
        expect(effectWrite()[2][0].target).toBe('Unknown');
    });

    it('logs an ability_use entry with the exact cast description', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Sanctuary',
            description: 'Cleric1 casts Sanctuary on Rogue1. Creatures targeting Rogue1 with attacks or damaging spells must succeed on a WIS save or lose the attack/spell.',
            timestamp: expect.any(Number),
        }));
    });

    it('anchors expiration on the warded target with no round clock', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction({}, { targetName }), { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: casterName,
            targetName,
            effects: [{ type: 'remove_target_effect', effectKey: 'sanctuary', source: casterName }],
            campaignName,
            rounds: undefined,
            expireOnCreatureName: targetName,
        });
    });

    it('handles missing or empty automation without crashing', async () => {
        getRuntimeValue.mockReturnValue([]);

        const missing = await handle({ name: 'Sanctuary' }, { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);
        const empty = await handle({ name: 'Sanctuary', automation: {} }, { name: casterName, spellAbilities: { saveDc: 13 } }, campaignName, null);

        expect(missing.type).toBe('popup');
        expect(missing.payload.automationType).toBeUndefined();
        expect(missing.payload.automation).toEqual({});
        expect(empty.type).toBe('popup');
        expect(empty.payload.automationType).toBeUndefined();
    });
});

// ─── isSanctuaryActive ───
// Public API surface (re-exported via automation/index.js); no direct
// production caller — minimal pins for the target+effect+source predicate.

describe('isSanctuaryActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true only when target+effect+source all match', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: targetName, effect: 'bless', source: casterName },
        ]);

        expect(isSanctuaryActive(targetName, casterName, campaignName)).toBe(true);
    });

    it('returns false for each unmatched criterion and an empty or null store', () => {
        const mismatches = [
            [{ target: 'Goblin', effect: 'sanctuary', source: casterName }],
            [{ target: targetName, effect: 'sanctuary', source: 'Cleric2' }],
            [{ target: targetName, effect: 'shield', source: casterName }],
            [],
            null,
        ];
        for (const store of mismatches) {
            getRuntimeValue.mockReturnValue(store);
            expect(isSanctuaryActive(targetName, casterName, campaignName)).toBe(false);
        }
    });
});

// ─── endSanctuary ───

describe('endSanctuary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('filters exactly the matching target+effect+source triple before writing (filter-first)', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: targetName, effect: 'sanctuary', source: 'Cleric2' },
            { target: targetName, effect: 'bless', source: 'Cleric2' },
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        const written = effectWrite()[2];
        expect(written).toHaveLength(3);
        expect(written.some(te => te.effect === 'sanctuary' && te.source === casterName)).toBe(false);
        expect(written.some(te => te.effect === 'sanctuary' && te.source === 'Cleric2')).toBe(true);
        expect(written.some(te => te.effect === 'bless')).toBe(true);
        expect(written.some(te => te.effect === 'faerie_fire')).toBe(true);
    });

    it('returns null and writes nothing when there is no match', () => {
        for (const store of [null, [], [{ target: 'Goblin', effect: 'sanctuary', source: 'Cleric2' }]]) {
            getRuntimeValue.mockReturnValue(store);
            expect(endSanctuary(casterName, targetName, campaignName, 'test')).toBeNull();
        }
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup with exact removal description', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        const result = endSanctuary(casterName, targetName, campaignName, 'Target dealt damage');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sanctuary');
        expect(result.payload.targetName).toBe(targetName);
        expect(result.payload.description).toBe('Rogue1 is no longer warded by Sanctuary. Target dealt damage');
    });

    it('logs a condition-removed entry with the break reason as note', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: targetName,
            condition: 'Sanctuary',
            reason: 'Sanctuary ended',
            note: 'Target attacked',
            timestamp: expect.any(Number),
        }));
    });

    it('writes the filtered list through the campaign-scoped runtime key', () => {
        getRuntimeValue.mockReturnValue([
            { target: targetName, effect: 'sanctuary', source: casterName },
        ]);

        endSanctuary(casterName, targetName, campaignName, 'Target attacked');

        const call = effectWrite();
        expect(call[2]).toEqual([]);
        expect(call[3]).toBe(campaignName);
        // NOTE: the handler passes a 5th arg (true) but the production
        // setRuntimeValue signature takes 4 params — it is inert; do not
        // grow a "sync flag" contract on it.
    });
});

// ─── getSanctuaryTarget ───
// Public API surface (re-exported via automation/index.js); no direct
// production caller — minimal pins for the caster's first sanctuary target.

describe('getSanctuaryTarget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the first sanctuary target for the caster among noise', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'faerie_fire', source: casterName },
            { target: targetName, effect: 'sanctuary', source: casterName },
            { target: 'Orc', effect: 'sanctuary', source: casterName },
        ]);

        expect(getSanctuaryTarget(casterName, campaignName)).toBe(targetName);
    });

    it('returns null when the caster has no sanctuary or the store is null', () => {
        for (const store of [null, [], [{ target: targetName, effect: 'shield', source: casterName }], [{ target: targetName, effect: 'sanctuary', source: 'Cleric2' }]]) {
            getRuntimeValue.mockReturnValue(store);
            expect(getSanctuaryTarget(casterName, campaignName)).toBeNull();
        }
    });
});
