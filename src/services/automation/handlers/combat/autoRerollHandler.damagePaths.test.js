// @maintained-by-ai
// autoRerollHandler — applyMissTurnedHitDamage damage-payload lane (numeric-bonus seam).
//
// Seam map for the autoRerollHandler.test.js quint:
//   autoRerollHandler.test.js             — router dispatch, Guarded Mind, resource costs,
//                                             bardic/psionic die lanes, ally-range routing
//   autoRerollHandler.attackRoll.test.js  — handleAttackRoll popup description full-string
//                                             composition + rerollAttackLeg delegation
//                                             (exactly-once miss→hit damage)
//   autoRerollHandler.damagePaths.test.js (this file) — applyMissTurnedHitDamage payload
//                                             content and rerollAttackLeg damage gating:
//                                             exact applyDamage args, full damage log entry,
//                                             skip-guards (formula-missing, total-0, null-AC,
//                                             still-miss-with-formula), effectiveAc fallback
//   autoRerollHandler.miscPaths.test.js   — handleAbilityCheck / handleSaveRoll /
//                                             consumeResourceCost / findAllyMissedAttack /
//                                             getBardicDieSize internals
//   autoRerollHandler.soul-blades.test.js — Homing Strikes (CLA-320) gates and economy
//
// Deliberately NOT owned here (owned elsewhere — do not absorb): popup full-string
// composition and exactly-once delegation counts (attackRoll lane), ability_use log
// content (attackRoll own / main ally routing), registry internals.
//
// Production traffic: numeric-bonus auto_reroll rows — e.g. the 2024 channel-divinity
// ally row in 2024/classes.json (bonus 10, range 30 ft) drives the ally lane; lastAttack
// events (with effectiveAc/attackName/damageFormula) come from attackPostProcessing's
// storeCampaignLastAttack. Deterministic by construction: bonus is a fixed authored
// number, dice are mocked, Math.random die lanes are not entered. Turn-based: no timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// Re-import after mocking
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

function makeAction(overrides = {}) {
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

function mockLastAttack(attack) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return attack;
        return null;
    });
}

function mockLiveDamage(total) {
    vi.mocked(rollExpression).mockReturnValue({ total, rolls: [total - 2, 2], modifier: 0 });
    const ctx = { creatures: [] };
    vi.mocked(getCombatContext).mockResolvedValue(ctx);
    vi.mocked(applyDamageToTarget).mockReturnValue({ finalDamage: total });
    return ctx;
}

function damageLogEntries() {
    return addEntry.mock.calls.map((c) => c[1]).filter((e) => e.rollType === 'damage');
}

describe('autoRerollHandler - own attack miss→hit damage payload (numeric-bonus lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLastAttack(null);
    });

    it('applies own miss→hit damage with exact applyDamage contract and full damage log entry', async () => {
        const stats = makePlayerStats();
        const ctx = mockLiveDamage(10);
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d8', damageType: 'piercing', targetName: 'Orc' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5 } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('2d8');
        expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
        // fix#337S-LIVE(a): unscrambled contract options (applyDamage.js:1023) —
        // campaign slot holds the campaign NAME string, characters slot the array,
        // ignoreResistance floors at FALSE (resistance NOT bypassed), and the attacker
        // name rides attackerName. Pre-fix bytes were {campaignName:[stats],
        // characters:false, ignoreResistance:'TestHero'} — pinned-here honestly until flipped.
        expect(applyDamageToTarget).toHaveBeenCalledWith(ctx, 'Orc', 10, ['piercing'], {
            campaignName: 'test-campaign',
            characters: [stats],
            ignoreResistance: false,
            attackerName: 'TestHero',
        });
        // Full damage-roll log composition (payload of applyMissTurnedHitDamage).
        expect(damageLogEntries()).toEqual([
            {
                type: 'roll',
                characterName: 'TestHero',
                rollType: 'damage',
                name: 'Test Auto Reroll',
                formula: '2d8',
                rolls: [8, 2],
                total: 10,
                modifier: 0,
                damageType: 'piercing',
                targetName: 'Orc',
                finalDamage: 10,
            },
        ]);
    });

    it('AWAIT arm (fix#337S a): no damage log lands before applyDamageToTarget settles; finalDamage is the resolved read', async () => {
        const stats = makePlayerStats();
        mockLiveDamage(10);
        let resolveApply;
        vi.mocked(applyDamageToTarget).mockImplementationOnce(() => new Promise((resolve) => { resolveApply = resolve; }));
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d8', damageType: 'piercing', targetName: 'Orc' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5 } });
        const pending = handle(action, stats, 'test-campaign', 'map');
        for (let i = 0; i < 20 && applyDamageToTarget.mock.calls.length === 0; i++) await Promise.resolve();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        // Un-awaited (pre-fix) the truthy Promise would have logged finalDamage:
        // undefined already — this zero-count while pending kills that byte.
        expect(damageLogEntries()).toHaveLength(0);

        resolveApply({ finalDamage: 7 });
        const result = await pending;
        expect(result.type).toBe('popup');
        expect(damageLogEntries()).toEqual([
            expect.objectContaining({ rollType: 'damage', targetName: 'Orc', total: 10, finalDamage: 7 }),
        ]);
    });

    it('CATCH arm (fix#337S a): applyDamage rejection is caught loud, popup still lands, no damage log', async () => {
        const stats = makePlayerStats();
        mockLiveDamage(10);
        vi.mocked(applyDamageToTarget).mockRejectedValueOnce(new Error('apply boom'));
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d8', damageType: 'piercing', targetName: 'Orc' });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5 } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(spy).toHaveBeenCalledWith('[autoReroll] applyDamageToTarget failed:', expect.any(Error));
        expect(damageLogEntries()).toHaveLength(0);
        spy.mockRestore();
    });

    it('rolls the formula but applies nothing when damage total is 0', async () => {
        mockLiveDamage(0);
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        // Popup still reports the conversion verdict (attack-roll truth, not damage truth).
        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(rollExpression).toHaveBeenCalledWith('2d6');
        // Zero total: bail before context lookup, damage application, and any damage log.
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(damageLogEntries()).toHaveLength(0);
    });

    it('does not roll damage when null AC falls back to the recorded miss verdict', async () => {
        mockLiveDamage(8);
        // No targetAc and no effectiveAc: rerollAttackLeg falls back to
        // attackEvent.hit (false) — the live formula must never touch dice.
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('N/A');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('never rolls damage dice on a still-miss even when a live formula is present', async () => {
        mockLiveDamage(8);
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 2, bonus: 5, targetAc: 20, hit: false, damageFormula: '1d12', damageType: 'slashing', targetName: 'Ogre' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 2 } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(damageLogEntries()).toHaveLength(0);
    });

    it('converts a miss to a hit via effectiveAc when targetAc is absent', async () => {
        const stats = makePlayerStats();
        const ctx = mockLiveDamage(8);
        // targetAc null, effectiveAc 11 within reach of the boosted total:
        // the effectiveAc ?? targetAc fallback in rerollAttackLeg is what
        // makes this apply damage (storeCampaignLastAttack emits effectiveAc).
        mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 1, effectiveAc: 11, hit: false, damageFormula: '1d8', damageType: 'force', targetName: 'Shade' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5 } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(applyDamageToTarget).toHaveBeenCalledWith(ctx, 'Shade', 8, ['force'], {
            campaignName: 'test-campaign',
            characters: [stats],
            ignoreResistance: false,
            attackerName: 'TestHero',
        });
        expect(damageLogEntries()).toHaveLength(1);
        expect(damageLogEntries()[0]).toMatchObject({ characterName: 'TestHero', targetName: 'Shade', formula: '1d8' });
    });
});

describe('autoRerollHandler - ally attack miss→hit damage payload (ranged-boost lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLastAttack(null);
    });

    it('applies ally damage attributed to the ally with default attack log name', async () => {
        const stats = makePlayerStats();
        const ctx = mockLiveDamage(12);
        // Ally event without attackName/name: logName falls back to 'Attack'.
        mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d10', damageType: 'radiant', targetName: 'Demon' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' } });
        const result = await handle(action, stats, 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('2d10');
        expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
        expect(applyDamageToTarget).toHaveBeenCalledWith(ctx, 'Demon', 12, ['radiant'], {
            campaignName: 'test-campaign',
            characters: [stats],
            ignoreResistance: false,
            attackerName: 'Ally',
        });
        // Damage is logged under the ally, not the player who supplied the boost.
        expect(damageLogEntries()).toEqual([
            {
                type: 'roll',
                characterName: 'Ally',
                rollType: 'damage',
                name: 'Attack',
                formula: '2d10',
                rolls: [10, 2],
                total: 12,
                modifier: 0,
                damageType: 'radiant',
                targetName: 'Demon',
                finalDamage: 12,
            },
        ]);
    });

    it('skips ally damage when damageFormula is missing', async () => {
        mockLiveDamage(12);
        mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.type).toBe('popup');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('rolls the ally formula but applies nothing when total is 0', async () => {
        mockLiveDamage(0);
        mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false, damageFormula: '2d6', damageType: 'slashing', targetName: 'Goblin' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 10, range: '30_ft' } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('Miss turned into a hit');
        expect(rollExpression).toHaveBeenCalledWith('2d6');
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(damageLogEntries()).toHaveLength(0);
    });

    it('does not roll ally damage when null AC falls back to the recorded miss verdict', async () => {
        mockLiveDamage(8);
        mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, hit: false, damageFormula: '2d6', targetName: 'Goblin' });

        const action = makeAction({ automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' } });
        const result = await handle(action, makePlayerStats(), 'test-campaign', 'map');

        expect(result.payload.description).toContain('N/A');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
