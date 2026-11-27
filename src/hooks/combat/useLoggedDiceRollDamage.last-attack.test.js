// @maintained-by-ai 2026-11-26
// Wrapper-lane lastAttack seam for createLogDamageAndShow — only the stamping
// paths not owned elsewhere. Plain-damage store/merge and the skip guards
// (rolls/damageType absent) are authority in handlers/handlePlainDamage.test.js
// (same wrapper entry point); sanctuary prompt mechanics live in
// useLoggedDiceRollDamage.sanctuary.test.js; the shield-immunity popup
// contract lives in useLoggedDiceRollDamage.shield-immunity.test.js.
// Kept here: the auto-miss stamp (handleAutoMiss, untested elsewhere),
// early-return paths that must NOT stamp (sanctuary block, magic missile
// immunity), and stamping when the target is absent from the combat summary.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { isMagicMissileImmune } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// Minimal mocks — only what the main function and its direct handler chain need.
vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    deleteRuntimeKey: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    isMagicMissileImmune: vi.fn(),
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

// All other dependencies are mocked with no-op functions so imports resolve.
vi.mock('../../services/dice/diceRoller.js', () => ({
    formatDamageFormula: vi.fn((f) => f),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { getName: vi.fn((n) => n || 'Unknown'), guid: vi.fn(() => 'test-guid') },
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('./handlers/handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

describe('useLoggedDiceRollDamage — lastAttack persistence (wrapper lane)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const FROZEN_NOW = 1731600000000;

    const fireBolt = (context) => ({
        name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [5], modifier: 0, context,
    });
    const lastAttackWrites = () =>
        setRuntimeValue.mock.calls.filter((call) => call[0] === 'campaign' && call[1] === 'lastAttack');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

        // Plain-damage defaults; individual tests opt into their seam.
        getRuntimeValue.mockImplementation(() => null);
        isMagicMissileImmune.mockReturnValue(false);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    // -----------------------------------------------------------------------
    // handleAutoMiss stamps lastAttack so counterspell/riposte lanes can
    // see the miss — the only coverage of that stamp anywhere.
    // -----------------------------------------------------------------------
    it('auto-miss stamps lastAttack with the full production auto-miss shape', async () => {
        await createLogDamageAndShow(deps)(fireBolt({
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'fire',
            isAutoMiss: true,
        }));

        // Full-shape census: buildAutoMissLastAttack's 15 fields, frozen timestamp.
        expect(lastAttackWrites()).toEqual([
            ['campaign', 'lastAttack', {
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                rollType: 'auto-miss',
                damageFormula: '1d10',
                damageName: 'Fire Bolt',
                damageType: 'fire',
                rawDamage: 0,
                primaryDamage: 0,
                primaryDamageType: 'fire',
                actualDamage: 0,
                damageApplied: false,
                statusEffects: null,
                affectedTargets: ['Goblin'],
                rangeReason: undefined,
                timestamp: FROZEN_NOW,
            }, 'test-campaign'],
        ]);
        // The auto-miss return short-circuits the wrapper — no plain-damage
        // re-stamp downstream.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // Wrapper returns before any handler runs when sanctuary blocks the
    // attack — nothing may stamp lastAttack. (Prompt mechanics are owned
    // by useLoggedDiceRollDamage.sanctuary.test.js.)
    // -----------------------------------------------------------------------
    it('sanctuary block returns early without writing lastAttack', async () => {
        getRuntimeValue.mockImplementation((key, subKey) => {
            if (key === 'campaign' && subKey === 'targetEffects') {
                return [{ effect: 'sanctuary', target: 'Goblin', source: 'Healer', saveDc: 13 }];
            }
            return key === 'campaign' ? {} : null;
        });

        const promise = createLogDamageAndShow(deps)(fireBolt({
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 13,
            saveType: 'WIS',
        }));

        // The save-result listener registers synchronously inside
        // handleSanctuarySave and utils.guid is mocked to 'test-guid',
        // so the failed save can be dispatched immediately — no polling.
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: 'test-guid', success: false, roll: 8, bonus: 0, rawRolls: [8] },
        }));
        await promise;

        // Sentinel: the block took effect (automation_info popup), yet nothing stamped.
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'automation_info', name: 'Sanctuary' })
        );
        expect(lastAttackWrites()).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Magic-missile immunity short-circuits the wrapper before handlers —
    // popup/log contract is owned by shield-immunity lane; here only the
    // no-stamp guarantee.
    // -----------------------------------------------------------------------
    it('magic missile immunity short-circuits without writing lastAttack', async () => {
        isMagicMissileImmune.mockReturnValue(true);

        await createLogDamageAndShow(deps)({
            name: 'Magic Missile', formula: '1d4+1', total: 5, rolls: [4, 1], modifier: 0, context: {
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                damageType: 'force',
            },
        });

        expect(isMagicMissileImmune).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        // Sentinel that the immunity branch actually ran (log row is written):
        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({ note: 'Shield: Immune to Magic Missile' })
        );
        // ... yet the short-circuit means no damage application and no stamp.
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(lastAttackWrites()).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // A target missing from the combat summary must not block the stamp —
    // downstream lanes (executeManeuver, spellThief) key on this record.
    // -----------------------------------------------------------------------
    it('stamps lastAttack even when the target is not in combat summary', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'OtherCreature', type: 'npc', currentHp: 10, maxHp: 10 }],
        });

        await createLogDamageAndShow(deps)(fireBolt({
            attackerName: 'TestFighter',
            targetName: 'NonExistent',
            damageType: 'fire',
            attackName: 'Fire Bolt',
        }));

        // The write survives the missing roster entry: targetName/attackName
        // come from context, damage fields carry the raw adjusted total (no
        // apply ran), and affectedTargets falls back to [] because there is
        // no resolved target to name.
        expect(lastAttackWrites()).toEqual([
            ['campaign', 'lastAttack', {
                attackerName: 'TestFighter',
                targetName: 'NonExistent',
                attackName: 'Fire Bolt',
                rolls: [5],
                rawDamage: 5,
                primaryDamage: 5,
                primaryDamageType: 'fire',
                damageTypes: ['fire'],
                actualDamage: 5,
                damageApplied: true,
                statusEffects: null,
                affectedTargets: [],
            }, 'test-campaign'],
        ]);
    });
});
