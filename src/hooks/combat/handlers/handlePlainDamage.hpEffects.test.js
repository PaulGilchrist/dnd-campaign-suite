// @maintained-by-ai: 2026-10-14
// Plain-damage lane HP-effect contracts (writePlainHpResults): player currentHitPoints
// writes, hp_change log shape, unconscious boundaries, NPC runtime-write guard.
// Death-save init is covered by useLoggedDiceRollDamage.death-saves.test.js,
// resistance reduction by handlePlainDamage.resistanceReArm.test.js, and
// overchannel self-damage by handleOverchannelSelfDamage.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(() => false),
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(() => 0),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage HP effects', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestFighter' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    // Resolve 'Goblin' in the combat summary and pin the applied damage outcome.
    function stubTarget({ type, maxHp, finalDamage, newHp }) {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type, ac: 12, currentHp: maxHp, maxHp }],
        });
        getRuntimeValue.mockImplementation((_key, prop) => (prop === 'hitPoints' ? maxHp : null));
        applyDamageToTarget.mockReturnValue({ finalDamage, newHp, damageReduced: false });
    }

    function attack({ total = 10, rolls = [7], modifier = 3 } = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Longsword', formula: '1d8+3', total, rolls, modifier,
            context: { targetName: 'Goblin', damageType: 'slashing' },
        });
    }

    const hpEntry = () => addEntry.mock.calls.find((c) => c[1]?.type === 'hp_change')?.[1];
    const runtimeWrites = (prop) => setRuntimeValue.mock.calls.filter((c) => c[1] === prop).map((c) => [c[0], c[2], c[3]]);

    it('player dropped to 0 HP: logs unconscious hp_change and writes currentHitPoints', async () => {
        stubTarget({ type: 'player', maxHp: 10, finalDamage: 10, newHp: 0 });
        await attack();

        expect(hpEntry()).toMatchObject({
            targetName: 'Goblin', delta: -10, currentHp: 0, maxHp: 10,
            isHealing: false, isUnconscious: true,
        });
        expect(runtimeWrites('currentHitPoints')).toEqual([['Goblin', 0, 'test-campaign']]);
    });

    it('player driven below 0 HP: logs negative currentHp as unconscious', async () => {
        stubTarget({ type: 'player', maxHp: 10, finalDamage: 15, newHp: -5 });
        await attack({ total: 15, rolls: [8, 4] });

        expect(hpEntry()).toMatchObject({ delta: -15, currentHp: -5, isUnconscious: true });
        expect(runtimeWrites('currentHitPoints')).toEqual([['Goblin', -5, 'test-campaign']]);
    });

    it('player surviving above 0 HP: logs conscious hp_change and writes new HP', async () => {
        stubTarget({ type: 'player', maxHp: 20, finalDamage: 6, newHp: 14 });
        await attack({ total: 6, rolls: [3] });

        expect(hpEntry()).toMatchObject({ delta: -6, currentHp: 14, isUnconscious: false });
        expect(runtimeWrites('currentHitPoints')).toEqual([['Goblin', 14, 'test-campaign']]);
    });

    it('NPC dropped to 0 HP: logs unconscious hp_change with no runtime HP writes', async () => {
        stubTarget({ type: 'npc', maxHp: 10, finalDamage: 10, newHp: 0 });
        await attack();

        expect(hpEntry()).toMatchObject({ delta: -10, currentHp: 0, maxHp: 10, isUnconscious: true });
        expect(runtimeWrites('currentHitPoints')).toHaveLength(0);
    });
});
