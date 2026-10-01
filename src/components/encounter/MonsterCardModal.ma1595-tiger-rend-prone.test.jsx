// @improved-by-ai
// MA-1595: Tiger "Rend" — prose carries "If the target is a Large or smaller
// creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so buildHitConditionClause returned null and the rider was
// structurally inert (MA-1555 Swarm-of-Grasping-Hands / MA-1541 Thunderbolt
// prose-only lane). One-field DATA fix: hit_conditions:["prone"] after
// damage_type_primary (MA-1555/MA-1541 byte-shape). Size gate stays the
// family-wide Large-or-smaller consumer gate (§1116): "Large or smaller" RAW
// matches byte-identically here; NO size_gate field invented (zero consumers).
// Locks: disk row shape + key placement + base byte legs, clause arms prone,
// HIT grants prone + meta.source + "Rend (escape DC —)" condition log
// (handlePlainDamage.applyHitClauseConditions :553), MISS/clause-absent
// writes nothing, MA-1555 / MA-1534 / winter-wolf siblings byte-intact.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
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

vi.mock('../../hooks/combat/loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: '', group: '' })),
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
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

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../../hooks/combat/useLoggedDiceRollDamage.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TIGER = monsters.find((m) => m.index === 'tiger');
const REND = TIGER.actions[0];
const NIMBLE = TIGER.bonus_actions.find((a) => a.name === 'Nimble Escape');
const GRASPING = monsters.find((m) => m.index === 'swarm-of-crawling-claws').actions.find((a) => a.name === 'Swarm of Grasping Hands');
const BOULDER = monsters.find((m) => m.index === 'stone-giant').actions.find((a) => a.name === 'Boulder');
const WINTER_BITE = monsters.find((m) => m.index === 'winter-wolf').actions.find((a) => a.name === 'Bite');

describe('MA-1595 disk fingerprint: tiger Rend hit_conditions fix', () => {
    it('tiger actions[0] is Rend with hit_conditions ["prone"] after damage_type_primary (MA-1555/MA-1541 byte-shape)', () => {
        expect(REND.name).toBe('Rend');
        expect(REND.hit_conditions).toEqual(['prone']);
        const keys = Object.keys(REND);
        expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
        expect(keys[keys.length - 1]).toBe('hit_conditions');
    });

    it('base byte legs locked: +5, reach 5 ft., 2d6 + 3 Slashing, exact description', () => {
        expect(REND.attack_bonus).toBe(5);
        expect(REND.reach).toBe('5 ft.');
        expect(REND.damage_dice_primary).toBe('2d6 + 3');
        expect(REND.damage_type_primary).toBe('Slashing');
        expect(REND.description).toBe(
            'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
        );
    });

    it('no save lane, no escape DC, no hit_target_effect, NO invented size_gate (§1116 residual)', () => {
        expect(REND.save_dc).toBeUndefined();
        expect(REND.save_type).toBeUndefined();
        expect(REND.save_effect).toBeUndefined();
        expect(REND.escape_dc).toBeUndefined();
        expect(REND.hit_target_effect).toBeUndefined();
        expect(REND.hit_choice).toBeUndefined();
        expect(REND.size_gate).toBeUndefined();
    });

    it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
        const clause = buildHitConditionClause(REND);
        expect(clause).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Rend',
            targetEffect: null,
        });
    });

    it('siblings byte-locked: MA-1555 grasping-hands, MA-1534 boulder, winter-wolf bite', () => {
        expect(GRASPING.attack_bonus).toBe(4);
        expect(GRASPING.damage_dice_primary).toBe('4d8 + 2');
        expect(GRASPING.damage_type_primary).toBe('Necrotic');
        expect(GRASPING.conditional_damage).toEqual({ dice: '2d8', modifier: 2, damage_type: 'Necrotic', condition: 'Bloodied' });
        expect(GRASPING.hit_conditions).toEqual(['prone']);
        expect(BOULDER.attack_bonus).toBe(9);
        expect(BOULDER.damage_dice_primary).toBe('2d8 + 6');
        expect(BOULDER.hit_conditions).toEqual(['prone']);
        expect(WINTER_BITE.attack_bonus).toBe(6);
        expect(WINTER_BITE.damage_dice_primary).toBe('2d6 + 4');
        // MA-1723 fixed same lane: winter-wolf Bite now carries hit_conditions ["prone"].
        expect(WINTER_BITE.hit_conditions).toEqual(['prone']);
        expect(NIMBLE.description).toBe('The tiger takes the Disengage or Hide action.');
        expect(Object.keys(NIMBLE)).toEqual(['name', 'description']);
    });

    it('attack half stays live: one "+5" chip arms Rend', () => {
        expect(attackRowMissingToHit(REND)).toBe(false);
        const onAttack = vi.fn();
        const { container } = render(
            <MonsterAction
                action={REND}
                index={0}
                attackerCannotAct={false}
                onAttack={onAttack}
                onDamage={vi.fn()}
                onSaveRoll={vi.fn()}
                onSpellCast={vi.fn()}
                reactionUsesUsed={{}}
                onGatedReaction={vi.fn()}
            />
        );
        const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
        expect(chips).toEqual(['+5']);
        fireEvent.click(container.querySelector('.mc-dice-link'));
        expect(onAttack).toHaveBeenCalledWith('Rend', 5, expect.objectContaining({ name: 'Rend' }));
    });
});

describe('MA-1595 tiger Rend prone grant leg (handlePlainDamage, MA-1555 mirror)', () => {
    const deps = {
        characterName: 'Tiger 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Tiger 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 989, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium or Small', ac: 12, currentHp: 989, maxHp: 989 }],
        });
    });

    function hitContext(extra = {}) {
        return {
            targetName: 'Bandit 1',
            damageType: 'Slashing',
            attackerName: 'Tiger 1',
            hitClause: buildHitConditionClause(REND),
            ...extra,
        };
    }

    it('grants Prone to the Medium victim on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: hitContext() });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bandit 1',
            'activeConditions',
            expect.arrayContaining(['prone']),
            'test-campaign'
        );
    });

    it('stamps the tiger into activeConditionMeta source with no escape DC', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: hitContext() });

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2].prone.source).toBe('Tiger 1');
        expect(metaCall[2].prone.dc).toBeUndefined();
    });

    it('logs a condition-applied entry naming Rend', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: hitContext() });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Rend (escape DC —)',
        }));
    });

    it('does not duplicate Prone already active on the target', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Bandit 1' && prop === 'activeConditions') return ['prone'];
            return null;
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: hitContext() });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall[2].filter(c => String(c).toLowerCase() === 'prone')).toHaveLength(1);
    });

    it('writes nothing when the clause is absent (miss flow never carries hitClause)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({
            name: 'Rend', formula: '2d6 + 3', total: 10, rolls: [1, 2], modifier: 3,
            context: { targetName: 'Bandit 1', damageType: 'Slashing', attackerName: 'Tiger 1' },
        });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});
