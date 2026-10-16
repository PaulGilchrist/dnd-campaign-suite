// @maintained-by-ai
// Unit contract for the Boon of Fate handler (registered in automation/index.js
// as modify_d20_roll; applyBoonFateChoice consumed by BoonFateModal.jsx, which
// mocks this handler in its own lane). Pins the handle early-exit popup branches
// (used flag, missing lastAttack, missing attacker, out of range, roll failed)
// with no-side-effect guards, the boonFateChoice modal payload composition, and
// roll-type/event-label classification. applyBoonFateChoice pins the
// boonOfFateUsed latch and DELEGATION to reactionBonus.applyD20Modifier only —
// modifier/log/description internals are canonical in reactionBonusHandler.test.js;
// rest resets of the latch flag live in restRules-*.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyBoonFateChoice } from './boonOfFateHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as reactionBonus from './reactionBonusHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../dice/diceRoller.js');
vi.mock('../../../rules/combat/rangeCheck.js');
vi.mock('./reactionBonusHandler.js', () => ({
    applyD20Modifier: vi.fn(),
}));

const PLAYER_NAME = 'TestFighter';
const CAMPAIGN = 'TestCampaign';

const ACTION = {
    name: 'Improve Fate',
    automation: { type: 'modify_d20_roll', modifier: '2d4', range: '60 ft', canBeBonusOrPenalty: true, recharge: 'initiative_or_short_or_long_rest', casting_time: '1 reaction' },
};

const PLAYER_STATS = { name: PLAYER_NAME, level: 20, class: { name: 'Fighter' } };

const LAST_ATTACK = {
    d20: 8,
    bonus: 5,
    targetAc: 15,
    hit: false,
    attackerName: 'Goblin',
    targetName: 'Player',
    rollType: 'attack',
    saveDc: undefined,
    saveResult: undefined,
};

// Strict exact-key table: only the two read sites the handler is allowed to use.
// Owner-scoped so a refactor that moves a read off its expected key breaks here.
function mockRuntime(store) {
    runtimeState.getRuntimeValue.mockImplementation((characterKey, key) => store[`${characterKey}|${key}`]);
}

function defaultRuntime(overrides = {}) {
    mockRuntime({
        [`${PLAYER_NAME}|boonOfFateUsed`]: false,
        'campaign|lastAttack': LAST_ATTACK,
        ...overrides,
    });
}

describe('boonOfFateHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 6 });
        rangeCheck.isWithinRange.mockResolvedValue(true);
        defaultRuntime();
    });

    it('returns used popup and rolls nothing when the boon flag is already set', async () => {
        defaultRuntime({ [`${PLAYER_NAME}|boonOfFateUsed`]: true });

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Improve Fate');
        expect(result.payload.description).toContain('no uses remaining');
        expect(result.payload.description).toContain('Initiative or Short or Long Rest');
        expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('returns popup and skips range check when no recent D20 test exists', async () => {
        defaultRuntime({ 'campaign|lastAttack': null });

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent D20 test found');
        expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('returns popup when lastAttack has no attackerName', async () => {
        defaultRuntime({ 'campaign|lastAttack': { d20: 8, bonus: 5, attackerName: null } });

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No attacker found');
        expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('returns popup and skips the roll when attacker is out of range', async () => {
        rangeCheck.isWithinRange.mockResolvedValue(false);

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('out of range');
        expect(result.payload.description).toContain('Goblin');
        expect(result.payload.description).toContain('60 ft');
        expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(PLAYER_NAME, 'Goblin', 60);
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('returns popup when the 2d4 roll fails', async () => {
        diceRoller.rollExpression.mockReturnValue(null);

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Roll failed');
        expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4');
    });

    it('returns boonFateChoice modal with full payload for a successful attack invocation', async () => {
        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('boonFateChoice');
        expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(PLAYER_NAME, 'Goblin', 60);
        expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d4');
        expect(result.payload).toEqual({
            action: ACTION,
            playerStats: PLAYER_STATS,
            campaignName: CAMPAIGN,
            roll2d4: { total: 6 },
            lastAttack: LAST_ATTACK,
            attackerName: 'Goblin',
            eventLabel: 'Attack by Goblin',
            hitStatus: 'Miss',
            saveStatus: null,
            isAttack: true,
            isSave: false,
            isCheck: false,
        });
    });

    it.each([
        {
            label: 'save roll',
            lastAttack: { d20: 10, bonus: 3, saveDc: 14, saveResult: 'failure', saveType: 'constitution', attackerName: 'Dragon', targetName: 'Player', rollType: 'save' },
            eventLabel: 'CONSTITUTION by Dragon',
            isAttack: false,
            isSave: true,
            isCheck: false,
            hitStatus: null,
            saveStatus: 'Failure',
        },
        {
            label: 'attack carrying an embedded save',
            lastAttack: { d20: 10, bonus: 3, targetAc: 15, saveDc: 12, saveResult: 'failure', attackerName: 'Dragon', targetName: 'Player', rollType: 'attack' },
            eventLabel: 'Attack by Dragon',
            isAttack: true,
            isSave: true,
            isCheck: false,
            hitStatus: 'Miss',
            saveStatus: 'Success',
        },
        {
            label: 'named ability check',
            lastAttack: { d20: 10, bonus: 3, checkName: 'Perception', attackerName: 'Dragon', targetName: 'Player', rollType: 'check' },
            eventLabel: 'Perception by Dragon',
            isAttack: false,
            isSave: false,
            isCheck: true,
            hitStatus: null,
            saveStatus: null,
        },
        {
            label: 'skill roll without a checkName',
            lastAttack: { d20: 2, bonus: 1, attackerName: 'Dragon', targetName: 'Player', rollType: 'skill' },
            eventLabel: 'Ability check by Dragon',
            isAttack: false,
            isSave: false,
            isCheck: true,
            hitStatus: null,
            saveStatus: null,
        },
    ])('classifies $label', async ({ lastAttack, eventLabel, isAttack, isSave, isCheck, hitStatus, saveStatus }) => {
        defaultRuntime({ 'campaign|lastAttack': lastAttack });

        const result = await handle(ACTION, PLAYER_STATS, CAMPAIGN);

        expect(result.modalName).toBe('boonFateChoice');
        expect(result.payload.eventLabel).toBe(eventLabel);
        expect(result.payload.isAttack).toBe(isAttack);
        expect(result.payload.isSave).toBe(isSave);
        expect(result.payload.isCheck).toBe(isCheck);
        expect(result.payload.hitStatus).toBe(hitStatus);
        expect(result.payload.saveStatus).toBe(saveStatus);
    });
});

describe('boonOfFateHandler.applyBoonFateChoice', () => {
    const DELEGATED = { type: 'popup', payload: { type: 'automation_info', name: 'Improve Fate' } };
    let callOrder;

    beforeEach(() => {
        vi.clearAllMocks();
        callOrder = [];
        runtimeState.setRuntimeValue.mockImplementation(async () => { callOrder.push('latch'); });
        reactionBonus.applyD20Modifier.mockImplementation(() => { callOrder.push('delegate'); return DELEGATED; });
    });

    it('latches boonOfFateUsed before delegating and passes the delegated result through', async () => {
        const result = await applyBoonFateChoice({
            action: ACTION,
            playerStats: PLAYER_STATS,
            campaignName: CAMPAIGN,
            roll2d4: { total: 6 },
            lastAttack: LAST_ATTACK,
            mode: 'bonus',
        });

        expect(callOrder).toEqual(['latch', 'delegate']);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER_NAME, 'boonOfFateUsed', true, CAMPAIGN);
        expect(result).toBe(DELEGATED);
    });

    it.each([
        { label: 'object roll as bonus', action: ACTION, roll2d4: { total: 6 }, mode: 'bonus', diceValue: 6, featureName: 'Improve Fate' },
        { label: 'plain number as penalty', action: ACTION, roll2d4: 4, mode: 'penalty', diceValue: 4, featureName: 'Improve Fate' },
        { label: 'unnamed action falls back to Improve Fate', action: { automation: ACTION.automation }, roll2d4: { total: 2 }, mode: 'bonus', diceValue: 2, featureName: 'Improve Fate' },
    ])('delegates $label to applyD20Modifier with exact args', async ({ action, roll2d4, mode, diceValue, featureName }) => {
        await applyBoonFateChoice({
            action,
            playerStats: PLAYER_STATS,
            campaignName: CAMPAIGN,
            roll2d4,
            lastAttack: LAST_ATTACK,
            mode,
        });

        expect(reactionBonus.applyD20Modifier).toHaveBeenCalledWith({
            action,
            playerName: PLAYER_NAME,
            campaignName: CAMPAIGN,
            diceValue,
            lastAttack: LAST_ATTACK,
            mode,
            options: {
                featureName,
                onSpent: expect.any(Function),
            },
        });
    });
});
