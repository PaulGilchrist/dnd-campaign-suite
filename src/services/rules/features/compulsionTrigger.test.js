// @maintained-by-ai
// compulsionTrigger lane — the TRIGGER side of the Compulsion family. Split recorded VERBATIM by
// twin #1347 (compulsionEffect.test.js): 'triggerCompulsion (action rebuild/advantage/DC selection)
// = compulsionTrigger.test.js'. That makes the DC-selection PRODUCER ours: triggerCompulsion
// COMPOSES spellSaveDc here (unlike forwarder lanes) — metaCtx.spellSaveDc || spellAbilities.saveDc
// || 8 + proficiency || 8 + 2 — so the tier chain is pinned with mutually-distinguishable values
// (18 / 15 / 11 / 10) and the rebuilt action envelope is pinned with exact toEqual + identity pins
// (spell and playerStats pass through untouched; envelope name is the literal 'Compulsion').
// Advantage computation (target-in-combat) is trigger-side and ours too: full truth table pinned
// below, incl. never-executed optional-chain branches (null / no-array / empty-array context).
// Immunities note (public/data/spells.json prose, read 2026-10-20): "A target automatically succeeds
// on this saving throw if it can't be charmed" — that adjudication is DOWNSTREAM (confirm lane
// #1347 / NPC auto-roll handler); automation.advantage here is purely the app's
// "target in combat and not the caster" save flag, consumed at compulsionHandler.js:89.
// Not this lane: confirm-lane popup payload bytes (#1347 compulsionEffect.test.js), handler
// auto-roll (compulsionHandler.test.js), concentration clearing (concentrationClearing2.test.js).
// Disk canon cited from twin #1347 rather than re-read/re-asserted: Compulsion = level 4, WIS,
// Concentration up to 1 minute on BOTH rulesets — level 4 justifies the slot-floor default of 4.
// Dead-export watch (grep 2026-10-20): triggerCompulsion has no production caller (live sheet cast
// is spellGates.gateCompulsion → handleCompulsionConfirm → applyCompulsionEffect); pinned as-is
// while still exported. No timers. skipSync n/a — getCombatContext is read-only on this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCompulsion } from './compulsionService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
// DC-tier fixture: spellAbilities.saveDc (15) differs from 8+proficiency (8+4=12) so a broken
// tier fall-through cannot silently land on an adjacent tier's value.
const casterStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15 },
    proficiency: 4,
};
// mirrors disk canon row: level 4 (cited from #1347, not re-read)
const compulsion = { name: 'Compulsion', level: 4 };
const combatWithCaster = {
    creatures: [
        { name: 'Wizard', type: 'player' },
        { name: 'Goblin', type: 'npc' },
    ],
};

const trigger = (spell, metaCtx, stats = casterStats) =>
    triggerCompulsion(spell, metaCtx, stats, campaignName, mapName);

const firedAction = () => {
    expect(executeHandler).toHaveBeenCalledTimes(1);
    return executeHandler.mock.calls[0];
};

describe('triggerCompulsion (action rebuild / DC producer / advantage)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // explicit re-seed of factory behavior destroyed by resetAllMocks
        executeHandler.mockResolvedValue({ type: 'popup' });
        getCombatContext.mockResolvedValue(combatWithCaster);
    });

    // Name gate: exact, case-folded equality against 'compulsion'. Near-miss names are REAL disk
    // rows from public/data/spells.json (Compelled Duel / Command / Charm Person all live there).
    it.each([
        ['Compulsion', true],
        ['cOmPuLsIoN', true],
        ['Compelled Duel', false],
        ['Command', false],
        ['Charm Person', false],
        ['', false],
        [undefined, false],
        [null, false],
    ])('gate %s for spell name "%s"', async (name, expected) => {
        const result = await trigger({ name, level: 4 }, {});
        if (expected) {
            const [action] = firedAction();
            // envelope name is rebuilt as the literal — never input casing
            expect(action.name).toBe('Compulsion');
            expect(result).toEqual({ type: 'popup' });
        } else {
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            // guard short-circuits BEFORE any combat-context fetch
            expect(getCombatContext).not.toHaveBeenCalled();
        }
    });

    // The producer keystone: one exact-envelope pin per distinct chain/tier/branch. Values are
    // mutually distinguishable so every tier swap and every advantage flip fails the toEqual.
    const envelopeCase = (label, {
        spell = compulsion,
        metaCtx = { targetName: 'Goblin' },
        stats = casterStats,
        combat = combatWithCaster,
        automation,
        spellSlotLevel,
    }) => ({ label, spell, metaCtx, stats, combat, automation, spellSlotLevel });

    const envelopeCases = [
        envelopeCase('DC 18 / slot 5: metaCtx overrides both tiers; in-combat non-caster target → advantage true', {
            metaCtx: { targetName: 'Goblin', spellSaveDc: 18, slotLevel: 5 },
            automation: { saveDc: 18, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 5,
        }),
        envelopeCase('DC tier 2: metaCtx silent → spellAbilities.saveDc (15)', {
            automation: { saveDc: 15, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 4,
        }),
        envelopeCase('DC tier 3: no spellAbilities → 8 + proficiency (3) = 11', {
            stats: { name: 'Wizard', proficiency: 3 },
            automation: { saveDc: 11, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 4,
        }),
        envelopeCase('DC floor: empty stats → 8 + default proficiency 2 = 10', {
            stats: {},
            automation: { saveDc: 10, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 4,
        }),
        envelopeCase('slot tier: spell.level (6, upcast) when metaCtx.slotLevel absent', {
            spell: { name: 'Compulsion', level: 6 },
            automation: { saveDc: 15, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 6,
        }),
        envelopeCase('slot floor: no level anywhere → disk-canon default 4', {
            spell: { name: 'Compulsion' },
            automation: { saveDc: 15, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 4,
        }),
        envelopeCase('advantage truth table T-F: explicit target is the caster', {
            metaCtx: { targetName: 'Wizard' },
            automation: { saveDc: 15, targetName: 'Wizard', advantage: false },
            spellSlotLevel: 4,
        }),
        envelopeCase('advantage truth table F: target not in combat roster', {
            metaCtx: { targetName: 'Ogre' },
            automation: { saveDc: 15, targetName: 'Ogre', advantage: false },
            spellSlotLevel: 4,
        }),
        envelopeCase('advantage truth table: combat context null', {
            combat: null,
            automation: { saveDc: 15, targetName: 'Goblin', advantage: false },
            spellSlotLevel: 4,
        }),
        envelopeCase('advantage truth table: context without creatures array', {
            combat: {},
            automation: { saveDc: 15, targetName: 'Goblin', advantage: false },
            spellSlotLevel: 4,
        }),
        envelopeCase('advantage truth table: empty creatures array', {
            combat: { creatures: [] },
            automation: { saveDc: 15, targetName: 'Goblin', advantage: false },
            spellSlotLevel: 4,
        }),
        envelopeCase('auto-select: nullish metaCtx → first creature, in-combat non-caster → advantage true', {
            metaCtx: undefined,
            automation: { saveDc: 15, targetName: 'Goblin', advantage: true },
            spellSlotLevel: 4,
        }),
        envelopeCase('auto-select picks the caster when caster is first creature → advantage false', {
            metaCtx: {},
            combat: { creatures: [{ name: 'Wizard', type: 'player' }] },
            automation: { saveDc: 15, targetName: 'Wizard', advantage: false },
            spellSlotLevel: 4,
        }),
    ];

    it.each(envelopeCases)('$label', async ({ spell, metaCtx, stats, combat, automation, spellSlotLevel }) => {
        getCombatContext.mockResolvedValue(combat);

        await trigger(spell, metaCtx, stats);

        const [action, passedStats, passedCampaign, passedMap] = firedAction();
        // exact envelope: any extra/missing field on action or automation fails here
        expect(action).toEqual({
            name: 'Compulsion',
            automation: { type: 'compulsion', ...automation },
            spell,
            spellSlotLevel,
        });
        // identity pins: spell and stats travel untouched, positional passthrough unchanged
        expect(action.spell).toBe(spell);
        expect(passedStats).toBe(stats);
        expect(passedCampaign).toBe(campaignName);
        expect(passedMap).toBe(mapName);
    });

    it.each([
        ['null combat context', null],
        ['context without creatures array', {}],
        ['empty creatures array', { creatures: [] }],
    ])('no target selected (%s): info popup, handler never fired', async (_label, combat) => {
        getCombatContext.mockResolvedValue(combat);

        const result = await trigger(compulsion, {});

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Compulsion',
                description: 'No target selected for Compulsion.',
            },
        });
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it.each([
        ['handler verdict object', { type: 'popup', payload: { marker: 'from-handler' } }],
        // no fabricated fallback popup when the handler legitimately returns null
        ['null handler verdict', null],
    ])('returns the handler verdict by identity: %s', async (_label, handlerResult) => {
        executeHandler.mockResolvedValue(handlerResult);

        const result = await trigger(compulsion, { targetName: 'Goblin' });

        expect(result).toBe(handlerResult);
    });

    it('handler rejection yields the failed-execute popup and a prefixed console.error', async () => {
        const err = new Error('Handler exploded');
        executeHandler.mockRejectedValue(err);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

        try {
            const result = await trigger(compulsion, { targetName: 'Goblin' });

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: 'Failed to execute Compulsion.',
                },
            });
            expect(spy).toHaveBeenCalledWith('[compulsionService] Failed to execute Compulsion handler:', err);
            // catch-arm survival proof: the popup return is this lane's only post-catch output,
            // and it completes despite the handler rejection (asserted above).
        } finally {
            spy.mockRestore();
        }
    });
});
