// @maintained-by-ai
// Base Hide lane for handleHideAction (useCharActionsBaseActions): cannotAct gate,
// already-hidden refusal (case-insensitive), the success/failure channel with
// byte-exact popup/log canon and Invisible + advantage_on_stealth stamping
// (+ dedupe/preserve), checkContext channel resolution (dis/hex/advantage/peerless
// precedence, Skulker gate), Stealth bonus arithmetic (exhaustion, Pass Without
// Trace, Jack of All Trades, listed-bonus-minus-penalty matrix), and Skulker
// fog-of-war copy on both legs.
// Naturally Stealthy trait branches are owned by
// useCharActionsHideAction.naturallyStealthy.test.js; Hide/Dodge button click
// wiring is owned by CharActions.baseActionsHide.test.jsx — not restated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockSetPopupHtml, mockRollSkillCheck, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

// Fresh channels stub per test (no fixture aliasing between mounts).
function grv({ conditions = [], lastAttack = null, buffs = [] } = {}) {
    return vi.fn((_charKey, key) => {
        if (key === 'activeConditions') return conditions;
        if (key === 'lastAttack') return lastAttack;
        if (key === 'activeBuffs') return buffs;
        return undefined;
    });
}

// Base abilities layout with a listed Stealth skill total on the Dexterity entry
// (the channel findStealthSkill reads: abilities[].skills[].bonus).
function stealthAbilities(bonus) {
    return [
        { name: 'Strength', bonus: 4, skills: [] },
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus }] },
        { name: 'Wisdom', bonus: 1, skills: [] },
        { name: 'Constitution', bonus: 3, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
    ];
}

describe('useCharActionsBaseActions — handleHideAction (base Hide lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('cannotAct gate refuses without reading state, rolling, popping, writing, or logging', async () => {
        const hooks = createHooks({ cannotAct: true });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(hooks.getRuntimeValue).not.toHaveBeenCalled();
        expect(hooks.setRuntimeValue).not.toHaveBeenCalled();
        expect(mockRollSkillCheck).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it.each([
        { name: 'exact lowercase', condition: 'invisible' },
        { name: 'uppercase (case-insensitive match)', condition: 'INVISIBLE' },
    ])('refuses with the already-hidden popup when the condition is $name — no roll, write, or log', async ({ condition }) => {
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({ getRuntimeValue: grv({ conditions: [condition] }), setRuntimeValue: srw });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).not.toHaveBeenCalled();
        expect(srw).not.toHaveBeenCalled();
        expect(mockAddEntry).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Hide',
            description: 'You are already hidden (Invisible condition active).',
        });
    });

    // Success fixture sits exactly on DC 15 to pin the >= boundary.
    it.each([
        {
            name: 'success on the DC 15 boundary',
            lastAttack: { total: 15, d20: 13 },
            stamps: true,
            popup: 'Hide successful! (d20: 13 + 0 = 15) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.',
            log: 'Stealth check: 15 (d20: 13 + 0) vs DC 15 — Success. Gained Invisible condition and advantage on Stealth checks.',
        },
        {
            name: 'failure below DC 15',
            lastAttack: { total: 10, d20: 8 },
            stamps: false,
            popup: 'Hide failed! (d20: 8 + 0 = 10) You remain visible.',
            log: 'Stealth check: 10 (d20: 8 + 0) vs DC 15 — Failure. Did not gain the Invisible condition.',
        },
        {
            name: 'missing lastAttack data reads as a failure',
            lastAttack: null,
            stamps: false,
            popup: 'Hide failed! (d20: ? + 0 = undefined) You remain visible.',
            log: 'Stealth check: undefined (d20: ? + 0) vs DC 15 — Failure. Did not gain the Invisible condition.',
        },
    ])('rolls Stealth once and reports on $name', async ({ lastAttack, stamps, popup, log }) => {
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({ getRuntimeValue: grv({ lastAttack }), setRuntimeValue: srw });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 0, {});
        const conditionWrites = srw.mock.calls.filter(c => c[1] === 'activeConditions');
        const buffWrites = srw.mock.calls.filter(c => c[1] === 'activeBuffs');
        if (stamps) {
            expect(conditionWrites).toEqual([['TestFighter', 'activeConditions', ['invisible'], campaignName]]);
            expect(buffWrites).toEqual([['TestFighter', 'activeBuffs', [{ name: 'Hide', effect: 'advantage_on_stealth' }], campaignName]]);
        } else {
            expect(conditionWrites).toEqual([]);
            expect(buffWrites).toEqual([]);
        }
        expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Hide', description: popup });
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Hide',
            description: log,
        });
    });

    // Fresh-append on empty buffs is pinned by the canonical success row above;
    // these rows cover the two remaining activeBuffs branches on a success roll.
    it.each([
        {
            name: 'unrelated buffs are preserved and Hide is appended',
            buffs: [{ name: 'Bless', effect: 'bless' }],
            expected: [{ name: 'Bless', effect: 'bless' }, { name: 'Hide', effect: 'advantage_on_stealth' }],
        },
        {
            name: 'an existing advantage_on_stealth buff is not duplicated',
            buffs: [{ name: 'Hide', effect: 'advantage_on_stealth' }],
            expected: [{ name: 'Hide', effect: 'advantage_on_stealth' }],
        },
    ])('writes activeBuffs exactly once with byte-exact contents when $name', async ({ buffs, expected }) => {
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({ getRuntimeValue: grv({ lastAttack: { total: 18, d20: 12 }, buffs }), setRuntimeValue: srw });
        await useCharActionsBaseActions(hooks).handleHideAction();

        const buffWrites = srw.mock.calls.filter(c => c[1] === 'activeBuffs');
        expect(buffWrites).toEqual([['TestFighter', 'activeBuffs', expected, campaignName]]);
    });

    // resolveStealthCheckContext channels: every conditionEffects/feats channel,
    // one row per guard branch; bonus is 0 throughout (base sheet, no exhaustion).
    it.each([
        { name: 'abilityCheckDisadvantage forces disadvantage', ce: { abilityCheckDisadvantage: true }, ctx: { forcedMode: 'disadvantage' } },
        { name: 'hexAbilityCheckDisadvantage on DEX forces disadvantage', ce: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'DEX' }, ctx: { forcedMode: 'disadvantage' } },
        { name: 'hexAbilityCheckDisadvantage on STR is ignored', ce: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'STR' }, ctx: {} },
        { name: 'skill-scoped abilityCheckAdvantage matches Stealth', ce: { abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Stealth' }, ctx: { forcedMode: 'advantage' } },
        { name: 'skill-scoped abilityCheckAdvantage for Athletics is ignored', ce: { abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Athletics' }, ctx: {} },
        { name: 'abilityCheckAdvantage without a skill applies to Stealth', ce: { abilityCheckAdvantage: true }, ctx: { forcedMode: 'advantage' } },
        { name: 'peerlessAthleteAdvantageSkills matches Stealth', ce: { peerlessAthleteAdvantageSkills: ['Stealth'] }, ctx: { forcedMode: 'advantage' } },
        { name: 'peerlessAthleteAdvantageSkills without Stealth is ignored', ce: { peerlessAthleteAdvantageSkills: ['Athletics'] }, ctx: {} },
        { name: 'advantage cancels disadvantage to neutral', ce: { abilityCheckDisadvantage: true, abilityCheckAdvantage: true }, ctx: { forcedMode: undefined } },
        { name: 'Skulker advantage requires 2024 rules (5e ignored)', stats: { rules: '5e', feats: ['Skulker'] }, ctx: {} },
        { name: '2024 without the Skulker feat rolls plain', stats: { rules: '2024', feats: [] }, ctx: {} },
    ])('resolves checkContext $name', async ({ ce, stats, ctx }) => {
        const hooks = createHooks({
            getRuntimeValue: grv({ lastAttack: { total: 18, d20: 12 } }),
            ...(ce ? { conditionEffects: ce } : {}),
            ...(stats ? { playerStats: { ...basePlayerStats, ...stats } } : {}),
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 0, ctx);
    });

    it.each([
        {
            name: 'success',
            lastAttack: { total: 18, d20: 12 },
            popup: 'Hide successful! (Advantage from Skulker - Fog of War) (d20: 12 + 0 = 18) You gain the Invisible condition and advantage on Dexterity (Stealth) checks until you attack, take damage, or use Lesser Restoration to remove the condition.',
            log: 'Stealth check: 18 (Advantage from Skulker - Fog of War) (d20: 12 + 0) vs DC 15 — Success. Gained Invisible condition and advantage on Stealth checks.',
        },
        {
            name: 'failure',
            lastAttack: { total: 10, d20: 8 },
            popup: 'Hide failed! (Advantage from Skulker - Fog of War) (d20: 8 + 0 = 10) You remain visible.',
            log: 'Stealth check: 10 (Advantage from Skulker - Fog of War) (d20: 8 + 0) vs DC 15 — Failure. Did not gain the Invisible condition.',
        },
    ])('cites Skulker - Fog of War byte-exact in popup and log on $name', async ({ lastAttack, popup, log }) => {
        const hooks = createHooks({
            getRuntimeValue: grv({ lastAttack }),
            playerStats: { ...basePlayerStats, rules: '2024', feats: ['Skulker'] },
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 0, { forcedMode: 'advantage' });
        expect(mockSetPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Hide', description: popup });
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Hide',
            description: log,
        });
    });

    it.each([
        { name: 'exhaustion penalty subtracts from the bonus', exhaustionPenalty: 2, expected: -2 },
        { name: 'Pass Without Trace adds its bonus', ce: { passWithoutTraceBonus: 10 }, expected: 10 },
        { name: 'Jack of All Trades adds half proficiency when not proficient', stats: { skillProficiencies: [], automation: { passives: [{ type: 'jack_of_all_trades' }] } }, expected: 1 },
        { name: 'Jack of All Trades is skipped when proficient', stats: { skillProficiencies: ['Stealth'], automation: { passives: [{ type: 'jack_of_all_trades' }] } }, expected: 0 },
    ])('computes the Stealth bonus: $name', async ({ exhaustionPenalty, ce, stats, expected }) => {
        const hooks = createHooks({
            getRuntimeValue: grv({ lastAttack: { total: 18, d20: 12 } }),
            exhaustionPenalty: exhaustionPenalty ?? 0,
            ...(ce ? { conditionEffects: ce } : {}),
            ...(stats ? { playerStats: { ...basePlayerStats, ...stats } } : {}),
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expected, {});
    });

    // Exhaustion x listed-bonus combination matrix (2024 PHB Exhaustion: "When you
    // make a D20 Test, the roll is reduced by 2 times your Exhaustion level",
    // public/data/conditions.json; penalty produced at CharSheet.conditionEffects.js:277
    // `exhausted = 2 * exhaustionLevel`). The exhaustionPenalty term must apply in
    // EVERY branch — including when a listed abilities[].skills Stealth bonus exists
    // (canonical combine mirrored from computeGrappleCheckBonus's `checkBonus -=
    // exhaustionPenalty` after listed-or-fallback selection). basePlayerStats carries
    // NO abilities[].skills Stealth entry, so every row above is bonus-absent; these
    // rows are mutually distinguishable across (listed bonus, penalty):
    // both-present, bonus-zero, bonus-negative, penalty-dominant, and
    // listed-bonus-intact control.
    it.each([
        { name: 'listed bonus minus penalty (5 - 2)', listed: 5, exhaustionPenalty: 2, expected: 3 },
        { name: 'listed bonus intact at zero penalty (5 - 0)', listed: 5, exhaustionPenalty: 0, expected: 5 },
        { name: 'listed ZERO bonus still pays the penalty (0 - 2)', listed: 0, exhaustionPenalty: 2, expected: -2 },
        { name: 'listed ZERO bonus at zero penalty stays zero (0 - 0)', listed: 0, exhaustionPenalty: 0, expected: 0 },
        { name: 'listed negative bonus stacks with the penalty (-1 - 2)', listed: -1, exhaustionPenalty: 2, expected: -3 },
        { name: 'penalty outweighs listed bonus into negative territory (2 - 4)', listed: 2, exhaustionPenalty: 4, expected: -2 },
        { name: 'listed high bonus at max penalty (11 - 12)', listed: 11, exhaustionPenalty: 12, expected: -1 },
        { name: 'bonus absent and penalty absent is zero (no listed skill)', listed: null, exhaustionPenalty: 0, expected: 0 },
    ])(
        'listed Stealth bonus and exhaustion penalty combine: $name',
        async ({ listed, exhaustionPenalty, expected }) => {
            const stats = listed === null
                ? { ...basePlayerStats, abilities: basePlayerStats.abilities.map(a => ({ ...a, skills: [] })), skills: [] }
                : { ...basePlayerStats, abilities: stealthAbilities(listed) };
            const hooks = createHooks({
                getRuntimeValue: grv({ lastAttack: { total: 18, d20: 12 } }),
                playerStats: stats,
                exhaustionPenalty,
            });
            await useCharActionsBaseActions(hooks).handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expected, {});
        }
    );

    // Sign-convention byte pin: a negative combined modifier flows into the popup/log
    // template unchanged ('+ -2'), preserving the existing display shape.
    it('renders the combined negative modifier byte-exact in popup and log (2 - 4 = -2)', async () => {
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({
            getRuntimeValue: grv({ lastAttack: { total: 11, d20: 13 } }),
            setRuntimeValue: srw,
            playerStats: { ...basePlayerStats, abilities: stealthAbilities(2) },
            exhaustionPenalty: 4,
        });
        await useCharActionsBaseActions(hooks).handleHideAction();

        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', -2, {});
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Hide',
            description: 'Hide failed! (d20: 13 + -2 = 11) You remain visible.',
        });
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Hide',
            description: 'Stealth check: 11 (d20: 13 + -2) vs DC 15 — Failure. Did not gain the Invisible condition.',
        });
    });
});
