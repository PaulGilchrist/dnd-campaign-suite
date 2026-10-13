import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'DraconicDragon'),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn().mockResolvedValue({ round: 1, activeCreature: 'DraconicDragon' }),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

import { addEntry } from '../../services/ui/logService.js';

const campaignName = 'test-campaign';

const lv9Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike',
    featureLevel: 9,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
    ],
};

const lv13Rider = {
    type: 'attack_rider',
    name: 'Improved Brutal Strike',
    featureLevel: 13,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
        { name: 'Staggering Blow', effect: 'disadvantage_on_next_save', noOpportunityAttacks: true },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
};

const recklessSpecialAction = {
    name: 'Reckless Attack',
    effect: 'advantage_attacks_advantage_against',
    trigger: 'first_attack_of_turn',
};

function createDeps(overrides = {}) {
    const {
        passives = [],
        specialActions = [recklessSpecialAction],
        getRuntimeValue = vi.fn(() => null),
        setRuntimeValue = vi.fn(),
        buildCtx = vi.fn(() => Promise.resolve({})),
        rollAttack = vi.fn(),
        setModalState = vi.fn(),
    } = overrides;

    return {
        cannotAct: false,
        buildCtx,
        rollAttack,
        exhaustionPenalty: 0,
        playerName: 'DraconicDragon',
        campaignName,
        setModalState,
        specialActions,
        passives,
        playerStats: { name: 'DraconicDragon', level: 13 },
        getRuntimeValue,
        setRuntimeValue,
    };
}

describe('CLA-182: Improved Brutal Strike picker at lv13', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('offers all four options when lv9 and lv13 riders tie on dice count', () => {
        const deps = createDeps({ passives: [lv9Rider, lv13Rider] });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick({ name: 'Longsword', hitBonus: 8 });

        expect(deps.setModalState).toHaveBeenCalledWith(expect.objectContaining({
            recklessAttackModal: expect.objectContaining({
                mode: 'full',
                hasBrutalStrike: true,
            }),
        }));
        const modal = deps.setModalState.mock.calls[0][0].recklessAttackModal;
        expect(modal.brutalStrikeOptions.map(o => o.name)).toEqual([
            'Forceful Blow', 'Hamstring Blow', 'Staggering Blow', 'Sundering Blow',
        ]);
        expect(modal.riderName).toBe('Improved Brutal Strike');
    });

    it('still picks lv17 rider on higher dice count', () => {
        const lv17Rider = { ...lv13Rider, name: 'Brutal Strike (Level 17)', featureLevel: 17, damageExpression: '2d10', maxEffects: 2 };
        const deps = createDeps({ passives: [lv9Rider, lv13Rider, lv17Rider] });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick({ name: 'Longsword', hitBonus: 8 });

        const modal = deps.setModalState.mock.calls[0][0].recklessAttackModal;
        expect(modal.maxEffects).toBe(2);
        expect(modal.riderName).toBe('Brutal Strike (Level 17)');
    });

    it('logs the improved rider name when confirming brutal strike', async () => {
        const deps = createDeps({ passives: [lv9Rider, lv13Rider] });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleRecklessAttackConfirm(
            { name: 'Longsword', hitBonus: 8 },
            { useBrutalStrike: true, effectChoices: ['Staggering Blow'], riderName: 'Improved Brutal Strike' }
        );
        await Promise.resolve();

        const brutalLog = addEntry.mock.calls.map(c => c[1]).find(e => e?.type === 'ability_use' && /Staggering Blow/.test(e.description || ''));
        expect(brutalLog).toBeDefined();
        expect(brutalLog.abilityName).toBe('Improved Brutal Strike');
        expect(brutalLog.description).toContain('uses Improved Brutal Strike on Longsword');
    });

    it('falls back to Brutal Strike log name when riderName absent', async () => {
        const deps = createDeps({ passives: [lv9Rider] });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleBrutalStrikeConfirm(
            { useBrutalStrike: true, effectChoices: ['Forceful Blow'] },
            { name: 'Longsword', hitBonus: 8 }
        );
        await Promise.resolve();

        const brutalLog = addEntry.mock.calls.map(c => c[1]).find(e => e?.type === 'ability_use' && /Forceful Blow/.test(e.description || ''));
        expect(brutalLog).toBeDefined();
        expect(brutalLog.abilityName).toBe('Brutal Strike');
    });
});
