// SP-128: Expeditious Retreat Dash Bonus Action grant lane — speed doubling
// (speed_boost), once-per-turn latch, own-turn gate, refusal logs, and
// lifecycle gating on the persisted grant flag.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './expeditiousRetreatDashHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 4),
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const CAMPAIGN_NAME = 'test-campaign';

function makeAction() {
    return {
        name: 'Dash (Expeditious Retreat)',
        description: 'Take the Dash action — Speed doubles until end of turn.',
        automation: { type: 'expeditious_retreat_dash', action: 'bonus_action', casting_time: '1 bonus action' },
    };
}

function makePlayerStats(overrides = {}) {
    return { name: 'AberrantSorcerer', speed: 30, ...overrides };
}

const CS = { round: 4, activeCreatureName: 'AberrantSorcerer' };

// Grant-active world: flag stamped, own turn, latch unused.
function grantActive(_name, key) {
    if (key === 'expeditiousRetreatActive') return true;
    if (key === '_Expeditious_Retreat_dash_usedRound') return null;
    return null;
}

describe('expeditiousRetreatDashHandler (SP-128)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCombatContext).mockResolvedValue(CS);
        vi.mocked(getRuntimeValue).mockImplementation(grantActive);
        vi.mocked(getCurrentCombatRound).mockReturnValue(4);
    });

    it('grants Dash: stamps speed_boost doubling (speedBonus = base) + once-per-turn latch + dash_bonus log', async () => {
        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/Speed doubled 30 → 60 ft/);

        const buffWrite = vi.mocked(setRuntimeValue).mock.calls.find(c => c[1] === 'activeBuffs');
        expect(buffWrite).toBeTruthy();
        const buff = buffWrite[2].find(b => b.effect === 'speed_boost');
        expect(buff.speedBonus).toBe(30); // +base = doubled
        expect(buff.name).toBe('Dash (Expeditious Retreat)');
        expect(buff.duration).toBe('until_end_of_turn');

        expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', '_Expeditious_Retreat_dash_usedRound', 4, CAMPAIGN_NAME);

        // One name-scoped remove_active_buff clock anchored on caster's next turn.
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: 'AberrantSorcerer',
            targetName: 'AberrantSorcerer',
            expireOnCreatureName: 'AberrantSorcerer',
        }));
        const anchor = vi.mocked(addExpiration).mock.calls[0][0];
        expect(anchor.effects[0]).toEqual({ type: 'remove_active_buff', buffName: 'Dash (Expeditious Retreat)' });

        const dashLog = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.automationType === 'dash_bonus');
        expect(dashLog).toBeTruthy();
        expect(dashLog.characterName).toBe('AberrantSorcerer');
    });

    it('latch is awaited BEFORE the buff write / popup returns (serializes second click)', async () => {
        await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);
        const latchIdx = vi.mocked(setRuntimeValue).mock.calls.findIndex(c => c[1] === '_Expeditious_Retreat_dash_usedRound');
        const buffIdx = vi.mocked(setRuntimeValue).mock.calls.findIndex(c => c[1] === 'activeBuffs');
        expect(latchIdx).toBeGreaterThanOrEqual(0);
        expect(buffIdx).toBeGreaterThanOrEqual(0);
        expect(latchIdx).toBeLessThan(buffIdx);
    });

    it('refuses a second same-turn click: expeditious_retreat_dash_refused log + popup, zero new writes', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === 'expeditiousRetreatActive') return true;
            if (key === '_Expeditious_Retreat_dash_usedRound') return 4;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/Once per turn/);
        const refusal = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.automationType === 'expeditious_retreat_dash_refused');
        expect(refusal).toBeTruthy();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('re-arms after round wrap (latch round differs from current)', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === 'expeditiousRetreatActive') return true;
            if (key === '_Expeditious_Retreat_dash_usedRound') return 3;
            return null;
        });
        vi.mocked(getCurrentCombatRound).mockReturnValue(4);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', '_Expeditious_Retreat_dash_usedRound', 4, CAMPAIGN_NAME);
    });

    it('refuses when the spell grant is gone (flag cleared on concentration break)', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === 'expeditiousRetreatActive') return null;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/not active/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        const refusal = vi.mocked(addEntry).mock.calls.map(c => c[1]).find(e => e.automationType === 'expeditious_retreat_dash_refused');
        expect(refusal).toBeTruthy();
    });

    it('refuses when it is not your turn (__initiative__ owner differs)', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === 'expeditiousRetreatActive') return true;
            if (key === '_Expeditious_Retreat_dash_usedRound') return null;
            if (key === 'lastAppliedTurnStartCreature') return '4:Bandit';
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/Bandit's turn/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses outside combat context (no speed buff stamped)', async () => {
        vi.mocked(getCombatContext).mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/No combat context/);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('defaults speed to 30 when playerStats.speed is missing', async () => {
        const result = await handle(makeAction(), makePlayerStats({ speed: undefined }), CAMPAIGN_NAME);

        expect(result.payload.description).toMatch(/Speed doubled 30 → 60 ft/);
        const buff = vi.mocked(setRuntimeValue).mock.calls.find(c => c[1] === 'activeBuffs')[2].find(b => b.effect === 'speed_boost');
        expect(buff.speedBonus).toBe(30);
    });
});
