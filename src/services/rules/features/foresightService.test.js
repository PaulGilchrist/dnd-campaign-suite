// @maintained-by-ai
/**
 * foresightService lane — the TRIGGER-STAMP OWNER (foresightService.js L3-77).
 *
 * Owner boundary: this file pins ONLY what triggerForesight composes/stamps that
 * no other lane exercises for real:
 *  - name gate (lowercase-compare vs REAL near-miss disk names)
 *  - target resolution via metaCtx?.targetName || stats.name (falsy triples)
 *  - exact runtime-store envelope: buff write on the TARGET (source stays the
 *    CASTER), 4-key te stamp set on 'campaign', exact read arity/order
 *  - SP-052 null-store coercion (cleared campaign store must NOT throw — the
 *    old throw leaked the lv9 slot after prepareSpellCast)
 *  - popup automation_info envelope
 *
 * NOT this lane (cited, not re-pinned):
 *  - caller envelopes into triggerForesight: useSimpleSpellHandlers.foresight-sp052.test.js,
 *    automation/handlers/spells/foresightHandler.test.js
 *  - foresight te CONSUMPTION (attacker disadvantage): automation/contextBuilder-sync.foresight-dis.test.js;
 *    advantage computation: conditions/conditionEffects*.test.js; registry defs: targetEffectDefinitions.test.js
 *  - buff/expiry semantics: restRules-longRest-special.test.js (foresight multi-key SURVIVOR row,
 *    #1319 converged-store purge — cite, don't re-pin)
 *
 * Ruleset posture: the service stamps identical literals for BOTH rulesets and never
 * reads disk; the disk-canon block below proves hardcode-vs-disk PARITY for both rows
 * (family #1365 class). No clocks: durations are static labels (disk says 8 hours,
 * concentration FALSE both rulesets, no save/dc — RAW), never a countdown.
 * skipSync: N/A — standalone setRuntimeValue POST lane, not setRuntimeObject SSE echo.
 * console.error: none in this service — the preflight catch is the caller's lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerForesight } from './foresightService.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

const mockGetRuntimeValue = vi.fn();
const mockSetRuntimeValue = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
    setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Wizard' };

const findSpell = (data, name) => (data.spells || data).find(s => s.name === name);

// Exact stamp constants — one canonical shape per concept, referenced everywhere.
const BUFF = { name: 'Foresight', effect: 'foresight', duration: '8 hours', source: 'Wizard' };
const TE_KEYS = ['foresight', 'advantage_attacks', 'advantage_saves', 'advantage_abilities'];
const teStamps = (target) => TE_KEYS.map(effect => ({ target, source: 'Wizard', effect, duration: '8_hours' }));
const popupFor = (target) => ({
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Foresight',
        automationType: 'foresight',
        description: `${target} has <b>Advantage on D20 Tests</b> (attacks, saves, ability checks), and other creatures have <b>Disadvantage on attack rolls</b> against them for 8 hours.`,
    },
});

// Argument-keyed store fake (deterministic; unknown read keys are a test failure).
function fakeStore(buffs, effects) {
    mockGetRuntimeValue.mockImplementation((key, key2) => {
        if (key2 === 'activeBuffs') return buffs;
        if (key === 'campaign' && key2 === 'targetEffects') return effects;
        throw new Error(`unexpected getRuntimeValue("${key}", "${key2}")`);
    });
}

describe('foresightService — triggerForesight stamps', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('disk canon (both rulesets) — why the literals', () => {
        it.each([
            ['5e', spells5e],
            ['2024', spells2024],
        ])('%s: lv9 Touch, concentration FALSE, 8 hours, no save/dc — automation identical cross-ruleset', (_label, data) => {
            const fs = findSpell(data, 'Foresight');
            expect(fs.level).toBe(9);
            expect(fs.range).toBe('Touch');
            expect(fs.duration).toBe('8 hours');
            expect(fs.concentration).toBe(false);
            expect(fs.automation).toEqual({ type: 'foresight', duration: '8 hours' });
            // RAW no save — disk rows carry no save/dc fields at all.
            expect(fs).not.toHaveProperty('save');
            expect(fs).not.toHaveProperty('dc');
            expect(fs.automation.saveDc).toBeUndefined();
            // near-miss REAL disk names backing the negative-gate rows below
            expect(findSpell(data, 'True Seeing')).toBeTruthy();
            expect(findSpell(data, 'Clairvoyance')).toBeTruthy();
            // hardcode-vs-disk parity premise: both rulesets agree byte-for-byte
            expect(findSpell(spells5e, 'Foresight').automation).toEqual(findSpell(spells2024, 'Foresight').automation);
        });

        it('stamped literals match disk automation in BOTH rulesets (te uses the registry "_" variant)', async () => {
            const disk = [findSpell(spells5e, 'Foresight'), findSpell(spells2024, 'Foresight')];
            fakeStore(undefined, undefined);

            await triggerForesight({ name: 'Foresight' }, {}, playerStats, campaignName, mapName);

            const buffs = mockSetRuntimeValue.mock.calls[0][2];
            const effects = mockSetRuntimeValue.mock.calls[1][2];
            for (const auto of disk.map(s => s.automation)) {
                expect(buffs[0].duration).toBe(auto.duration);        // '8 hours' verbatim
                expect(buffs[0].effect).toBe(auto.type);                // 'foresight'
                for (const te of effects) expect(te.duration).toBe(auto.duration.replace(' ', '_'));
            }
        });
    });

    describe('name gate', () => {
        it.each([
            ['foresight', true],
            ['FORESIGHT', true],
            ['True Seeing', false],
            ['Clairvoyance', false],
            ['Fire Bolt', false],
            [undefined, false],
        ])('spell name %s → %s', async (spellName, expectHit) => {
            if (expectHit) fakeStore(undefined, undefined);

            const result = await triggerForesight(
                { name: spellName },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            if (expectHit) {
                expect(result).toEqual(popupFor('Wizard'));
                expect(mockSetRuntimeValue).toHaveBeenCalledTimes(2);
            } else {
                expect(result).toBeNull();
                expect(mockGetRuntimeValue).not.toHaveBeenCalled();
                expect(mockSetRuntimeValue).not.toHaveBeenCalled();
            }
        });
    });

    it('full cast envelope — exact reads, buff re-stamp (target ≠ caster), 4-key te set, popup', async () => {
        const bless = { name: 'Bless', effect: 'bless', duration: '1 minute', source: 'Cleric' };
        const otherCasterForesight = { target: 'Other', source: 'OtherCaster', effect: 'foresight', duration: '8_hours' };
        const wizardUnrelated = { target: 'Fighter', source: 'Wizard', effect: 'some_other_effect', duration: '1_hour' };
        fakeStore([bless, { ...BUFF, source: 'Cleric' }], [
            ...teStamps('OldTarget'),        // same caster, previous target — must end early
            otherCasterForesight,             // other casters untouched
            wizardUnrelated,                  // same caster, unrelated effect preserved
        ]);
        const metaCtx = { targetName: 'Fighter' };

        const result = await triggerForesight({ name: 'foresight' }, metaCtx, playerStats, campaignName, mapName);

        // reads: buff on TARGET, te on 'campaign' with EXACT 2-arg arity (SP-052 convention)
        expect(mockGetRuntimeValue).toHaveBeenCalledTimes(2);
        expect(mockGetRuntimeValue.mock.calls[0]).toEqual(['Fighter', 'activeBuffs', campaignName]);
        expect(mockGetRuntimeValue.mock.calls[1]).toEqual(['campaign', 'targetEffects']);

        // buff write: Bless preserved, Foresight deduped and re-stamped, source stays the CASTER
        expect(mockSetRuntimeValue.mock.calls[0]).toEqual(['Fighter', 'activeBuffs', [bless, BUFF], campaignName]);
        // te write: prior-target set dropped, unrelated kept, 4 exact stamps appended in order
        expect(mockSetRuntimeValue.mock.calls[1]).toEqual(['campaign', 'targetEffects', [otherCasterForesight, wizardUnrelated, ...teStamps('Fighter')], campaignName]);
        expect(metaCtx).toEqual({ targetName: 'Fighter' }); // not mutated
        expect(result).toEqual(popupFor('Fighter'));
    });

    it.each([
        ['null metaCtx', null],
        ['undefined metaCtx', undefined],
        ['missing targetName', {}],
        ['empty-string targetName', { targetName: '' }],
    ])('target falls back to stats.name when %s', async (_desc, metaCtx) => {
        fakeStore(undefined, undefined);

        const result = await triggerForesight({ name: 'Foresight' }, metaCtx, playerStats, campaignName, mapName);

        expect(mockSetRuntimeValue.mock.calls[0]).toEqual(['Wizard', 'activeBuffs', [BUFF], campaignName]);
        expect(mockSetRuntimeValue.mock.calls[1]).toEqual(['campaign', 'targetEffects', teStamps('Wizard'), campaignName]);
        expect(result).toEqual(popupFor('Wizard'));
    });

    it.each([
        ['SP-052: null stores (admin clear / first cast) do NOT throw — stamps land on the selected target', { targetName: 'ElfTest' }, null, null],
        ['non-array garbage stores coerce to empty', {}, { not: 'an-array' }, 'stale'],
    ])('%s', async (_desc, metaCtx, buffs, effects) => {
        fakeStore(buffs, effects);

        const target = metaCtx.targetName || 'Wizard';
        await expect(triggerForesight({ name: 'Foresight' }, metaCtx, playerStats, campaignName, mapName))
            .resolves.toEqual(popupFor(target));

        expect(mockSetRuntimeValue.mock.calls[0]).toEqual([target, 'activeBuffs', [BUFF], campaignName]);
        expect(mockSetRuntimeValue.mock.calls[1]).toEqual(['campaign', 'targetEffects', teStamps(target), campaignName]);
    });
});
