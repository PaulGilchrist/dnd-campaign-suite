// @cleaned-by-ai
// CLA-067: Cunning Action verification for 2024 Rogue
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, activeCreatureName: 'TestRogue' })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle, applyBonusActionChoice } from './bonusActionChoiceHandler.js';
import { executeHandler } from '../../index.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'RogueTest',
        level: 3,
        rules: '2024',
        ...overrides,
    };
}

function makeCunningAction(automationOverrides = {}) {
    return {
        name: 'Cunning Action',
        description: 'On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.',
        automation: {
            type: 'bonus_action_choice',
            oncePerTurn: true,
            options: [
                { name: 'Dash', description: 'Double your movement speed until the end of the turn' },
                { name: 'Disengage', description: 'Your movement doesn\'t provoke opportunity attacks until the end of the turn' },
                { name: 'Hide', description: 'Attempt to hide from creatures until the end of the turn' },
            ],
            casting_time: '1 bonus action',
            ...automationOverrides,
        },
    };
}

describe('CLA-067: Cunning Action (2024 Rogue)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockImplementation((_, key) => {
            if (key === '_CunningAction_usedRound') return null;
            return null;
        });
    });

    it('should return bonusActionChoice modal when triggered', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await handle(action, ps, campaignName);
        
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
        expect(result.payload.action.name).toBe('Cunning Action');
        expect(result.payload.options).toHaveLength(3);
    });

    it('should show Dash, Disengage, and Hide options', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await handle(action, ps, campaignName);
        
        const optionNames = result.payload.options.map(o => o.name);
        expect(optionNames).toEqual(['Dash', 'Disengage', 'Hide']);
    });

    it('should apply Dash option and log it', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await applyBonusActionChoice(action, ps, campaignName, 'Dash');
        
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toContain('Dash selected');
        expect(result.payload.description).toContain('Speed doubled 30 → 60 ft');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'RogueTest',
            abilityName: 'Cunning Action',
            description: 'Dash selected',
        });
    });

    it('should apply Disengage option and log it', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await applyBonusActionChoice(action, ps, campaignName, 'Disengage');
        
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toContain('Disengage selected');
        expect(result.payload.description).toContain("doesn't provoke opportunity attacks");
    });

    it('should apply Hide option and log it', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await applyBonusActionChoice(action, ps, campaignName, 'Hide');
        
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toContain('Hide selected');
        expect(result.payload.description).toContain('Dexterity (Stealth) check');
    });

    it('should track once-per-turn usage', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        // First use - should work
        await applyBonusActionChoice(action, ps, campaignName, 'Dash');
        
        // Verify once-per-turn was marked
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'RogueTest',
            '_CunningAction_usedRound',
            expect.anything(),
            campaignName
        );
    });

    it('should block second use on same turn via oncePerTurn check in handle', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        // First use - mark it
        useRuntimeState.getRuntimeValue.mockImplementation((_, key) => {
            if (key === '_CunningAction_usedRound') return 1; // already used this round
            return null;
        });
        
        const result = await handle(action, ps, campaignName);
        
        // Should return a popup saying it's already used
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toContain('once per turn');
    });

    it('should execute via executeHandler', async () => {
        const ps = makePlayerStats();
        const action = makeCunningAction();
        
        const result = await executeHandler(action, ps, campaignName, null, [ps]);
        
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
        expect(result.payload.action.name).toBe('Cunning Action');
        expect(result.payload.options.map(o => o.name)).toEqual(['Dash', 'Disengage', 'Hide']);
    });
});
