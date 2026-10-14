import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockSetPopupHtml, mockRollSkillCheck, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

function makeGrv(activeConditions = [], lastAttack = null, activeBuffs = []) {
    return vi.fn((_charKey, key, _cn) => {
        if (key === 'activeConditions') return activeConditions;
        if (key === 'lastAttack') return lastAttack;
        if (key === 'activeBuffs') return activeBuffs;
        return undefined;
    });
}

describe('useCharActionsBaseActions - handleHideAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleHideAction', () => {
        it('should return early without side effects when cannotAct is true', async () => {
            const hooks = createHooks({ cannotAct: true });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(hooks.getRuntimeValue).not.toHaveBeenCalled();
            expect(mockRollSkillCheck).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
            expect(mockAddEntry).not.toHaveBeenCalled();
        });

        it('should show "already hidden" popup and skip check when invisible condition is active', async () => {
            const grv = makeGrv(['invisible']);
            const hooks = createHooks({ getRuntimeValue: grv });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('already hidden'),
            });
            expect(mockAddEntry).not.toHaveBeenCalled();
        });

        it.each([
            { name: 'case-insensitive Invisible', condition: 'Invisible' },
            { name: 'lowercase invisible', condition: 'invisible' },
            { name: 'uppercase INVISIBLE', condition: 'INVISIBLE' },
        ])('should treat "%s" as already hidden', async ({ condition }) => {
            const grv = makeGrv([condition]);
            const hooks = createHooks({ getRuntimeValue: grv });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalled();
        });

        it('should perform stealth check and add invisible condition on success (rollTotal >= DC 15)', async () => {
            const stealthSkill = { name: 'Stealth', bonus: 4 };
            const grv = makeGrv([], { total: 18, d20: 12 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = { ...basePlayerStats, skills: [stealthSkill], skillProficiencies: ['Stealth'] };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
            expect(srw).toHaveBeenCalledWith('TestFighter', 'activeConditions', expect.arrayContaining(['invisible']), campaignName);
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('Hide successful'),
            });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Hide',
            }));
        });

        it('should NOT add invisible condition on failure (rollTotal < DC 15)', async () => {
            const grv = makeGrv([], { total: 10, d20: 8 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalled();
            const conditionCalls = srw.mock.calls.filter(c => c[1] === 'activeConditions');
            expect(conditionCalls.length).toBe(0);
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('Hide failed'),
            });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Hide',
            }));
        });

        it('should add advantage_on_stealth buff on success when not already present', async () => {
            const grv = makeGrv([], { total: 18, d20: 12 }, []);
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            const buffCalls = srw.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffCalls.length).toBeGreaterThanOrEqual(1);
            const lastBuffCall = buffCalls[buffCalls.length - 1];
            const buffs = lastBuffCall[2];
            const stealthBuffs = buffs.filter(b => b && b.effect === 'advantage_on_stealth');
            expect(stealthBuffs.length).toBe(1);
            expect(stealthBuffs[0].name).toBe('Hide');
        });

        it('should NOT duplicate advantage_on_stealth buff when already active', async () => {
            const existingBuff = { name: 'Hide', effect: 'advantage_on_stealth' };
            const grv = makeGrv([], { total: 18, d20: 12 }, [existingBuff]);
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            const buffCalls = srw.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffCalls.length).toBeGreaterThanOrEqual(1);
            const lastBuffCall = buffCalls[buffCalls.length - 1];
            const buffs = lastBuffCall[2];
            const stealthBuffs = buffs.filter(b => b && b.effect === 'advantage_on_stealth');
            expect(stealthBuffs.length).toBe(1);
        });

        it('should add advantage_on_stealth buff alongside existing non-stealth buffs', async () => {
            const existingBuff = { name: 'Bless', effect: 'bless' };
            const grv = makeGrv([], { total: 18, d20: 12 }, [existingBuff]);
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            const buffCalls = srw.mock.calls.filter(c => c[1] === 'activeBuffs');
            const lastBuffCall = buffCalls[buffCalls.length - 1];
            const buffs = lastBuffCall[2];
            expect(buffs).toHaveLength(2);
            expect(buffs.some(b => b.effect === 'advantage_on_stealth')).toBe(true);
            expect(buffs.some(b => b.effect === 'bless')).toBe(true);
        });

        it('should apply passWithoutTraceBonus to stealth bonus when conditionEffects has it', async () => {
            const grv = makeGrv([], { total: 20, d20: 15 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { passWithoutTraceBonus: 10 },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // Base bonus is 0 (no stealth skill found in abilities) + 10 (passWithoutTrace) = 10
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 10, {});
        });

        it('should apply forced disadvantage from conditionEffects.abilityCheckDisadvantage', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { abilityCheckDisadvantage: true },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'disadvantage' });
        });

        it('should apply forced disadvantage from hexAbilityCheckDisadvantage when ability is DEX', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'DEX' },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'disadvantage' });
        });

        it('should NOT apply hexAbilityCheckDisadvantage when ability is not DEX', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'STR' },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        });

        it('should clear forcedMode when both abilityCheckDisadvantage and abilityCheckAdvantage are set', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: {
                    abilityCheckDisadvantage: true,
                    abilityCheckAdvantage: true,
                },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // Code behavior: when disadvantage is set and advantage clears it, forcedMode becomes undefined
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: undefined });
        });

        it('should apply advantage from peerlessAthleteAdvantageSkills for Stealth', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { peerlessAthleteAdvantageSkills: ['Stealth'] },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'advantage' });
        });

        it('should NOT apply peerlessAthleteAdvantageSkills for non-listed skill', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { peerlessAthleteAdvantageSkills: ['Athletics'] },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        });

        it('should apply Skulker feat advantage for 2024 rules', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                rules: '2024',
                feats: ['Skulker'],
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'advantage' });
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('Skulker - Fog of War'),
            });
        });

        it('should NOT apply Skulker advantage for 5e rules', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                rules: '5e',
                feats: ['Skulker'],
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        });

        it('should NOT apply Skulker advantage when feat is missing', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                rules: '2024',
                feats: [],
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        });

        it('should apply exhaustionPenalty reducing stealth bonus', async () => {
            const grv = makeGrv([], { total: 12, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, exhaustionPenalty: 2 });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // Base bonus is 0 (no stealth skill in abilities) - exhaustion 2 = -2
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', -2, {});
        });

        it('should use 0 stealth bonus when character has no stealth skill', async () => {
            const grv = makeGrv([], { total: 10, d20: 8 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                skills: [],
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 0, {});
        });

        it('should apply abilityCheckAdvantage when abilityCheckAdvantageSkill matches Stealth', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Stealth' },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'advantage' });
        });

        it('should NOT apply abilityCheckAdvantage when abilityCheckAdvantageSkill does not match Stealth', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { abilityCheckAdvantage: true, abilityCheckAdvantageSkill: 'Athletics' },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        });

        it('should apply abilityCheckAdvantage when abilityCheckAdvantageSkill is undefined (applies to all)', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: { abilityCheckAdvantage: true },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'advantage' });
        });

        it('should include Skulker description on failure popup', async () => {
            const grv = makeGrv([], { total: 10, d20: 8 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                rules: '2024',
                feats: ['Skulker'],
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('Skulker - Fog of War'),
            });
        });

        it('should include d20 roll value in success popup description', async () => {
            const grv = makeGrv([], { total: 18, d20: 15 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('d20: 15'),
            });
        });

        it('should include d20 roll value in failure popup description', async () => {
            const grv = makeGrv([], { total: 10, d20: 5 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('d20: 5'),
            });
        });

        it('should log ability_use with correct type and abilityName on success', async () => {
            const grv = makeGrv([], { total: 18, d20: 12 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Hide',
                description: expect.stringContaining('Success'),
            });
        });

        it('should log ability_use with correct type and abilityName on failure', async () => {
            const grv = makeGrv([], { total: 10, d20: 8 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Hide',
                description: expect.stringContaining('Failure'),
            });
        });

        it('should apply Jack of All Trades bonus when character has the passive and is not proficient', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                skillProficiencies: [],
                automation: { passives: [{ type: 'jack_of_all_trades' }] },
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // Base bonus is 0 (skill not in abilities) + floor(prof/2) where prof = floor((5-1)/4 + 2) = 3, floor(3/2) = 1 => 1
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 1, {});
        });

        it('should NOT apply Jack of All Trades when character is proficient in Stealth', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const playerStats = {
                ...basePlayerStats,
                skillProficiencies: ['Stealth'],
                automation: { passives: [{ type: 'jack_of_all_trades' }] },
            };
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw, playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // No JotAT bonus since proficient; base is 0 (skill not found in abilities array)
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', 0, {});
        });

        it('should apply combined disadvantage from both abilityCheckDisadvantage and hexAbilityCheckDisadvantage', async () => {
            const grv = makeGrv([], { total: 16, d20: 10 });
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: grv,
                setRuntimeValue: srw,
                conditionEffects: {
                    abilityCheckDisadvantage: true,
                    hexAbilityCheckDisadvantage: true,
                    hexAbilityCheckDisadvantageAbility: 'DEX',
                },
            });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // First sets disadvantage, hex also sets disadvantage => stays disadvantage
            expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), { forcedMode: 'disadvantage' });
        });

        it('should handle nonexistent lastAttack data gracefully (rollTotal undefined => fail)', async () => {
            const grv = makeGrv([], null);
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({ getRuntimeValue: grv, setRuntimeValue: srw });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleHideAction();

            // undefined total < 15 => failure
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Hide',
                description: expect.stringContaining('Hide failed'),
            });
        });
    });
});
