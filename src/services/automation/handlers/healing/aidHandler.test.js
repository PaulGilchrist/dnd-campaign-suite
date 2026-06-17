import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => {
        if (typeof r === 'number') return r;
        const m = String(r).match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 30;
    }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === '5') return 5;
        if (expr === '2d6+3') return 8;
        return 5;
    }),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

import { handle, applyAid } from './aidHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestCleric',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(automation = {}, spell = {}) {
    return {
        name: 'Aid',
        automation: { type: 'aid', ...automation },
        spell: { level: 2, ...spell },
        spellSlotLevel: 2,
    };
}

// ─── handle ───

describe('aidHandler.handle - additional cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses spell range when automation range is not provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction({}, { range: '60 feet' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.range).toBe('60 feet');
    });

    it('defaults range to 30 feet when neither automation nor spell range is provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction({}, {}), makePlayerStats(), campaignName, mapName);

        expect(result.payload.range).toBe('30 feet');
    });

    it('uses spell level when spellSlotLevel is not provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const action = {
            name: 'Aid',
            automation: { type: 'aid' },
            spell: { level: 3 },
        };

        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.hpIncrease).toBe(5);
    });

    it('uses automation maxTargets when provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction({ maxTargets: 5 }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.maxTargets).toBe(5);
    });

    it('defaults maxTargets to 3 when not in automation', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const action = {
            name: 'Aid',
            automation: { type: 'aid' },
            spell: { level: 2 },
        };

        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expect(result.payload.maxTargets).toBe(3);
    });

    it('includes attackerPos when mapName is provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload).toHaveProperty('attackerPos');
    });

    it('returns aid_target_selection popup type', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.type).toBe('aid_target_selection');
    });

    it('includes automation in payload', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction({ customProp: 'value' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.automation).toEqual({ type: 'aid', customProp: 'value' });
    });
});

// ─── applyAid - additional cases ───

describe('aidHandler.applyAid - additional cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses spellSlotLevel for hpIncrease calculation', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        const action = {
            name: 'Aid',
            automation: { type: 'aid' },
            spell: { level: 2 },
            spellSlotLevel: 3,
        };

        await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'aidHpMaxIncrease',
            5,
            campaignName,
        );
    });

    it('uses spell level as fallback for hpIncrease when spellSlotLevel is not provided', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        const action = {
            name: 'Aid',
            automation: { type: 'aid' },
            spell: { level: 3 },
        };

        await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'aidHpMaxIncrease',
            5,
            campaignName,
        );
    });

    it('uses aidHpMaxIncrease from storage for stacking', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 10;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 30;
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'aidHpMaxIncrease',
            15,
            campaignName,
        );
    });



    it('adds Aid buff when not already present', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [{ name: 'Shield' }];
            return null;
        });

        await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2].length).toBe(2);
        expect(buffsCall[2].find((b) => b.name === 'Aid')).toBeDefined();
    });

    it('includes sourceCharacter in Aid buff', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2][0].sourceCharacter).toBe('TestCleric');
    });

    it('uses spell duration for Aid buff', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        const action = {
            name: 'Aid',
            automation: { type: 'aid' },
            spell: { level: 2, duration: '1 hour' },
        };

        await applyAid(action, makePlayerStats(), campaignName, mapName, ['Ally1']);

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2][0].duration).toBe('1 hour');
    });

    it('returns correct popup description with target count and hpIncrease', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1', 'Ally2', 'Ally3']);

        expect(result.payload.description).toContain('3 target(s)');
        expect(result.payload.description).toContain('+5 HP maximum');
    });

    it('handles currentHitPoints not set (null storedCurrentHp)', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return null;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'aidHpMaxIncrease',
            5,
            campaignName,
        );
    });

    it('calls addExpiration with correct parameters', async () => {
        getRuntimeValue.mockImplementation((target, key) => {
            if (key === 'aidHpMaxIncrease') return 0;
            if (key === 'currentHitPoints') return 10;
            if (key === 'hitPoints') return 20;
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyAid(makeAction(), makePlayerStats(), campaignName, mapName, ['Ally1']);

        expect(addExpiration).toHaveBeenCalledWith(
            'TestCleric',
            'Ally1',
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_aid_buff',
                    buffName: 'Aid',
                    hpKey: 'aidHpMaxIncrease',
                }),
            ]),
            campaignName,
        );
    });
});
