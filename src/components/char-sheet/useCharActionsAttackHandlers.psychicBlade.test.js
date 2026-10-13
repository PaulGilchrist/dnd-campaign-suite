// CLA-274 Psychic Blades second-blade action-economy gating
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'AasimarTest'),
    getCurrentCombatRound: vi.fn(() => 3),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn().mockResolvedValue({ round: 3, activeCreature: 'AasimarTest' }),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

const campaignName = 'test-campaign';

const actionBlade = {
    name: 'Psychic Blade',
    type: 'Action',
    actionType: 'Action',
    hitBonus: 7,
    damage: '1d6+2',
    damageType: 'Psychic',
    mastery: 'Vex',
    isPsychicBlade: true,
};

const bonusBlade = {
    name: 'Psychic Blade',
    type: 'Bonus Action',
    actionType: 'Bonus Action',
    hitBonus: 7,
    damage: '1d4',
    damageType: 'Psychic',
    mastery: 'Vex',
    isPsychicBlade: true,
};

function createDeps({ attackedRound = null, secondBladeRound = null, currentRound = 3 } = {}) {
    const getRuntimeValue = vi.fn((_name, key) => {
        if (key === '_PsychicBlade_attack_round') return attackedRound;
        if (key === '_PsychicBlade_secondBlade_round') return secondBladeRound;
        if (key === 'activeBuffs') return [];
        return null;
    });
    const setRuntimeValue = vi.fn();
    const setPopupHtml = vi.fn();
    const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 7 }));
    const rollAttack = vi.fn();
    return {
        cannotAct: false,
        buildCtx,
        rollAttack,
        exhaustionPenalty: 0,
        playerName: 'AasimarTest',
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: 'AasimarTest', level: 14, class: { name: 'Rogue' } },
        getRuntimeValue,
        setRuntimeValue,
        setPopupHtml,
        currentRound,
    };
}

async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CLA-274 Psychic Blades second-blade gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentCombatRound).mockReturnValue(3);
    });

    it('refuses the second-blade bonus attack before any Attack action this round', async () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(bonusBlade);
        await flush();

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('manifest'));
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', '_PsychicBlade_secondBlade_round', expect.anything(), campaignName
        );
    });

    it('stamps the attack round when the Attack-action blade row is clicked and still rolls', async () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(actionBlade);
        await flush();

        expect(deps.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', '_PsychicBlade_attack_round', 3, campaignName);
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.rollAttack).toHaveBeenCalledWith('Psychic Blade', 7, expect.anything());
    });

    it('allows the second-blade bonus attack once after a blade attack this round and consumes the latch', async () => {
        const deps = createDeps({ attackedRound: 3 });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(bonusBlade);
        await flush();

        expect(deps.setRuntimeValue).toHaveBeenCalledWith('AasimarTest', '_PsychicBlade_secondBlade_round', 3, campaignName);
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.rollAttack).toHaveBeenCalledWith('Psychic Blade', 7, expect.anything());
    });

    it('refuses a second same-round second-blade attack with a popup and no roll', async () => {
        const deps = createDeps({ attackedRound: 3, secondBladeRound: 3 });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(bonusBlade);
        await flush();

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('already attacked with your second psychic blade'));
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
    });

    it('re-arms the second-blade bonus attack on a fresh round after a new blade attack', async () => {
        vi.mocked(getCurrentCombatRound).mockReturnValue(4);
        const deps = createDeps({ attackedRound: 4, secondBladeRound: 1, currentRound: 4 });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(bonusBlade);
        await flush();

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.rollAttack).toHaveBeenCalledWith('Psychic Blade', 7, expect.anything());
    });

    it('refuses the second-blade bonus attack on a fresh round before the new turn has attacked', async () => {
        vi.mocked(getCurrentCombatRound).mockReturnValue(4);
        const deps = createDeps({ attackedRound: 1, secondBladeRound: null, currentRound: 4 });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(bonusBlade);
        await flush();

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('manifest'));
        expect(deps.rollAttack).not.toHaveBeenCalled();
    });

    it('spends no psionic die or warPriestUses across blade attacks', () => {
        const deps = createDeps({ attackedRound: 3 });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(actionBlade);
        handlers.handleAttackClick(bonusBlade);

        const keys = deps.setRuntimeValue.mock.calls.map((c) => c[1]);
        expect(keys).not.toContain('psionicEnergy');
        expect(keys).not.toContain('warPriestUses');
        expect(keys).toContain('_PsychicBlade_attack_round');
        expect(keys).toContain('_PsychicBlade_secondBlade_round');
    });

    it('leaves non-Psychic-Blade bonus attacks ungated', async () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick({ name: 'Main Gauche', type: 'Bonus Action', hitBonus: 5, damage: '1d4+3' });
        await flush();

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.rollAttack).toHaveBeenCalledWith('Main Gauche', 7, expect.anything());
    });
});
