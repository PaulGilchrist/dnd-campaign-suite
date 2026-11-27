// @maintained-by-ai 2026-11-26
// Lane status (backlog aoe-overlay-lane-disposition, 2026-11-05): LIVE — producer
// live-proved as the PC sheet cast of a non-AoE damage save spell with an
// `overlay-<id>` target armed on the caster's initiative card (CharSpells
// SP-097 getTargetInfo fallback → savePath handleSingleTargetSave context
// .targetName → useLoggedDiceRollDamage.js:136 'overlay-' branch). The CY code
// census ("zero live producers / orphan lane") was disproven; do NOT delete.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn((expr) => {
        const match = expr.match(/^(\d+)d(\d+)\+(\d+)/);
        if (match) return parseInt(match[1]) + parseInt(match[3]);
        return 0;
    }),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    getSoulstitchProtectedCreatures: vi.fn(() => []),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
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
    getHolyAuraTargets: vi.fn(),
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

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { clearSoulstitchStamp, hasSoulstitchProtection, readAoeContext } from './loggedDiceRollUtils.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../../services/rules/combat/aoeService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { getAllyList } from '../../hooks/useAllySelection.js';

const FROZEN_NOW = 1731600000000;

describe('AoE overlay path', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } },
        ],
        charactersRef: { current: [{ name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } }] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultOverlayCtx = {
        overlay: { label: 'Fireball Zone', shape: 'circle', radius: 20 },
        players: [{ name: 'Ally1' }],
        npcs: [{ name: 'Goblin' }],
    };

    const defaultCombatSummary = {
        creatures: [
            { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
            { name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 },
        ],
    };

    const goblinAffected = { creature: { name: 'Goblin', type: 'npc', ac: 12 } };
    const allyAffected = { creature: { name: 'Ally1', type: 'player', ac: 14 } };

    const damageOpts = (attackerName) => ({
        campaignName: 'test-campaign',
        characters: deps.characters,
        ignoreResistance: false,
        attackerName,
    });

    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        readAoeContext.mockResolvedValue(defaultOverlayCtx);
        getAffectedCreatures.mockReturnValue([goblinAffected]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);
        hasSoulstitchProtection.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
    });

    const saveCtx = { saveDc: 15, saveType: 'DEX', dcSuccess: 'half' };

    function cast(overrides = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0,
            context: { targetName: 'overlay-1', damageType: 'fire', ...overrides },
        });
    }

    function affectedNpcAndPlayer() {
        getAffectedCreatures.mockReturnValue([goblinAffected, allyAffected]);
    }

    it('routes overlay- targets to the AoE handler, extracting the overlay id and logging the full aoe-damage row', async () => {
        await cast({ targetName: 'overlay-42', ...saveCtx });

        expect(readAoeContext).toHaveBeenCalledTimes(1);
        expect(readAoeContext).toHaveBeenCalledWith('test-campaign', '42');
        expect(getAffectedCreatures).toHaveBeenCalledWith(
            defaultOverlayCtx.overlay,
            defaultOverlayCtx.players,
            defaultOverlayCtx.npcs,
            defaultCombatSummary
        );
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.logEntry).toHaveBeenCalledWith({
            type: 'aoe-damage',
            characterName: 'TestWizard',
            rollType: 'aoe-damage',
            name: 'Fireball',
            formula: '8d6',
            rolls: [3, 4, 5, 2, 3, 3],
            total: 20,
            modifier: 0,
            damageType: 'fire',
            targetName: 'Fireball Zone',
            affectedCount: 1,
            npcResults: [],
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'half',
            gwfApplied: false,
            gwfOriginalRolls: null,
            gwfDisplayRolls: [3, 4, 5, 2, 3, 3],
        });
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['overlay context', () => readAoeContext.mockResolvedValue(null)],
        ['combat summary', () => loadCombatSummary.mockResolvedValue(null)],
    ])('does nothing when %s is missing', async (_label, breakDeps) => {
        breakDeps();

        await cast(saveCtx);

        expect(getAffectedCreatures).not.toHaveBeenCalled();
        expect(processAoeNpcs).not.toHaveBeenCalled();
        expect(sendAoePlayerSaves).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('non-save AoE applies full damage to every affected creature in order and ends invisibility only once damage lands', async () => {
        affectedNpcAndPlayer();
        // Ally1 ends up undamaged: invisibility must end from the Goblin hit alone.
        applyDamageToTarget.mockImplementation((_summary, creatureName) => (
            creatureName === 'Ally1'
                ? { finalDamage: 0, newHp: 20, damageReduced: true }
                : { finalDamage: 10, newHp: 5, damageReduced: false }
        ));

        await cast();

        expect(applyDamageToTarget.mock.calls).toEqual([
            [defaultCombatSummary, 'Goblin', 20, ['fire'], damageOpts('TestWizard')],
            [defaultCombatSummary, 'Ally1', 20, ['fire'], damageOpts('TestWizard')],
        ]);
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        expect(sendAoePlayerSaves).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'aoe-damage',
            affectedCount: 2,
            npcResults: ['Goblin', 'Ally1'],
        }));
    });

    it('stamps the full production lastAttack shape for the coverspell rollback lane', async () => {
        await cast(saveCtx);

        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', {
            attackerName: 'TestWizard',
            targetName: 'Fireball Zone',
            rollType: 'aoe-damage',
            saveType: 'DEX',
            saveDc: 15,
            damageFormula: '8d6',
            damageName: 'Fireball',
            damageType: 'fire',
            rawDamage: 20,
            primaryDamage: 20,
            primaryDamageType: 'fire',
            actualDamage: 20,
            damageApplied: true,
            statusEffects: null,
            affectedTargets: ['Goblin'],
            timestamp: FROZEN_NOW,
        }, 'test-campaign');
    });

    it('context attackerName overrides the caster across the save-NPC handoff and lastAttack', async () => {
        await cast({ ...saveCtx, attackerName: 'Ally2' });

        expect(processAoeNpcs).toHaveBeenCalledWith({
            combatSummary: defaultCombatSummary,
            affected: [goblinAffected],
            rawDamage: 20,
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            campaignName: 'test-campaign',
            attackerName: 'Ally2',
            characters: deps.characters,
            heightenTarget: null,
            mapData: { players: defaultOverlayCtx.players, placedItems: defaultOverlayCtx.npcs },
        });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({ attackerName: 'Ally2' }),
            'test-campaign'
        );
    });

    it('queues player save prompts with the full pendingSave shape when players are affected', async () => {
        affectedNpcAndPlayer();
        sendAoePlayerSaves.mockReturnValue([{ promptId: 'save-1', targetName: 'Ally1' }]);

        await cast(saveCtx);

        expect(sendAoePlayerSaves).toHaveBeenCalledWith({
            affected: [allyAffected],
            rawDamage: 20,
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            campaignName: 'test-campaign',
            spellName: 'Fireball',
            attackerName: 'TestWizard',
            formula: '8d6',
            heightenTarget: null,
            mapData: { players: defaultOverlayCtx.players, placedItems: defaultOverlayCtx.npcs },
        });
        expect(deps.pendingSaves).toEqual({
            'save-1': {
                targetName: 'Ally1',
                rawDamage: 20,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                damageType: 'fire',
                attackerName: 'TestWizard',
                name: 'Fireball',
                formula: '8d6',
                modifier: 0,
                rolls: [3, 4, 5, 2, 3, 3],
                campaignName: 'test-campaign',
                setPopupHtml: deps.setPopupHtml,
                isAoe: true,
                isCantrip: false,
                overchannelActive: false,
                overchannelUseCount: 0,
                overchannelSpellLevel: 1,
            },
        });
    });

    it('soulstitch-protected players take zero damage, get no prompt, and the stamp is cleared after the cast', async () => {
        affectedNpcAndPlayer();
        hasSoulstitchProtection.mockReturnValue(true);

        await cast(saveCtx);

        expect(hasSoulstitchProtection).toHaveBeenCalledWith('Ally1', 'TestWizard', 'test-campaign');
        expect(sendAoePlayerSaves).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
        // Only the protected ally is touched, at zero damage; the NPC lane
        // went through processAoeNpcs (mocked empty), never applyDamageToTarget.
        expect(applyDamageToTarget.mock.calls).toEqual([
            [defaultCombatSummary, 'Ally1', 0, ['fire'], damageOpts('TestWizard')],
        ]);
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('(Soulstitch)'));
        expect(clearSoulstitchStamp).toHaveBeenCalledWith('TestWizard', 'test-campaign');
    });

    it.each([
        ['shape as fallback when no label', { shape: 'cone', radius: 30 }, 'cone'],
        ['generic AoE when neither label nor shape', { radius: 15 }, 'AoE'],
    ])('labels the zone and popup %s', async (_label, overlay, expected) => {
        readAoeContext.mockResolvedValue({ overlay, players: [], npcs: [{ name: 'Goblin' }] });

        await cast();

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ targetName: expected }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(`${expected} — Fireball`));
    });

    it('careful spell exempts listed allies: careful NPCs and players take zero damage and get no prompt', async () => {
        getAllyList.mockReturnValue(['CarefulGoblin', 'Ally1']);
        const carefulGoblinAffected = { creature: { name: 'CarefulGoblin', type: 'npc', ac: 12 } };
        getAffectedCreatures.mockReturnValue([goblinAffected, carefulGoblinAffected, allyAffected]);

        await cast({ ...saveCtx, metamagicCareful: true });

        expect(getAllyList).toHaveBeenCalledTimes(1);
        expect(getAllyList).toHaveBeenCalledWith('TestWizard');
        // Only the non-ally NPC goes through the save pipeline.
        expect(processAoeNpcs).toHaveBeenCalledWith(expect.objectContaining({
            affected: [goblinAffected],
            attackerName: 'TestWizard',
        }));
        // Careful NPC first (save branch), then careful player — both at zero.
        expect(applyDamageToTarget.mock.calls).toEqual([
            [defaultCombatSummary, 'CarefulGoblin', 0, ['fire'], damageOpts('TestWizard')],
            [defaultCombatSummary, 'Ally1', 0, ['fire'], damageOpts('TestWizard')],
        ]);
        expect(sendAoePlayerSaves).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            affectedCount: 3,
            npcResults: ['CarefulGoblin', 'Ally1'],
        }));
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('(Careful Spell)'));
    });
});
