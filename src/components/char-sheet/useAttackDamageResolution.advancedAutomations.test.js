// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Lane: hook seam for advanced automations riding the REAL pipeline
// (buildPipelineForAction is NOT mocked). This lane pins that
// resolveAttackDamage dispatches cantrip damage riders (cantripBonuses
// step) into the rollDamage payload with the ' + N [Cantrip]' suffix.
// Formula/normalizer math canon: normalizeAutoDamage.test.js.
// Other damage_bonus triggers (monk/GWM/Frenzy): .automationDamage.test.js.

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 4 },
    ],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const potentSpellcastingAction = {
    type: 'damage_bonus',
    trigger: 'weapon_attack_hit',
    options: ['Potent Spellcasting (Cantrip)'],
    name: 'Potent Spellcasting',
};

const cantripAttack = () => ({
    name: 'Fire Bolt',
    damage: '1d10',
    damageType: 'Fire',
    weaponType: 'ranged',
    properties: [],
});

function statsWithRider(overrides = {}) {
    return {
        ...mockPlayerStats,
        automation: {
            actions: [potentSpellcastingAction],
            passives: [],
        },
        spellAbilities: {
            spells: [{ name: 'Fire Bolt', level: 0 }],
        },
        ...overrides,
    };
}

describe('useAttackDamageResolution - advanced automations (cantrip damage riders)', () => {
    const modalState = {};
    const deps = {
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        modalState,
        setModalState: vi.fn((updates) => {
            if (typeof updates === 'function') {
                return updates(modalState);
            }
            Object.assign(modalState, updates);
        }),
    };

    function ResolveWith(playerStats) {
        const { resolveAttackDamage } = useAttackDamageResolution({
            ...deps,
            playerStats,
        });
        return resolveAttackDamage(cantripAttack());
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        // Honest: real evaluateAutoExpression returns falsy for falsy
        // expressions (no tempHpExpression => no temp-HP grant path fires).
        evaluateAutoExpression.mockImplementation((expr) => (expr ? 5 : expr));
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
    });

    it('routes Potent Spellcasting cantrip bonus to rollDamage as + 4 [Cantrip]', async () => {
        await ResolveWith(statsWithRider());
        await new Promise((r) => setTimeout(r, 0)); // flush buildCtxSync .then chain

        expect(deps.rollDamage).toHaveBeenCalledTimes(1);
        expect(deps.rollDamage).toHaveBeenCalledWith({
            name: 'Fire Bolt',
            formula: '1d10 [fire] + 4 [Cantrip]',
            total: 9, // base roll 5 + Wisdom 4
            rolls: [5],
            modifier: 0,
            context: expect.any(Object),
        });
        // No tempHpExpression on this rider — the temp-HP grant path must not fire.
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'tempHp', expect.anything(), 'test-campaign');
    });

    it.each([
        { case: 'rider action is absent', stats: () => ({ ...mockPlayerStats }) },
        { case: 'spellAbilities is missing (not detected as cantrip)', stats: () => statsWithRider({ spellAbilities: undefined }) },
        { case: 'Wisdom modifier is negative (clamped to 0)', stats: () => statsWithRider({ abilities: [{ name: 'Wisdom', bonus: -2 }] }) },
    ])('does not add cantrip bonus when $case', async ({ stats }) => {
        await ResolveWith(stats());
        await new Promise((r) => setTimeout(r, 0));

        expect(deps.rollDamage).toHaveBeenCalledTimes(1);
        const payload = deps.rollDamage.mock.calls[0][0];
        expect(payload.name).toBe('Fire Bolt');
        expect(payload.formula).toBe('1d10 [fire]'); // base roll only — no bonus leaked
        expect(payload.total).toBe(5);
    });
});
