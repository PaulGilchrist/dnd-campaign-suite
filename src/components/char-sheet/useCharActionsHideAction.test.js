// @maintained-by-ai
// Base Hide lane for handleHideAction (useCharActionsBaseActions): cannotAct gate,
// already-hidden refusal (case-insensitive), the success/failure channel with
// byte-exact popup/log canon and Invisible + advantage_on_stealth stamping
// (+ dedupe/preserve), checkContext channel resolution (dis/hex/advantage/peerless
// precedence, Skulker gate), Stealth bonus arithmetic (exhaustion, Pass Without
// Trace, Jack of All Trades), and Skulker fog-of-war copy on both legs.
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
});
