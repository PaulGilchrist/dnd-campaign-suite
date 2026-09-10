// MN-020: poller/rider prompt legs rebuild their own action — the raw 'ability'
// save token + STR/DEX saveAbility must survive the rebuild so the save resolves
// 8 + STR/DEX mod + PB (DC 17 for a STR +3 PB +6 host), never DC 10/14.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAttackRiderPrompt, getManeuversForRules } from './combatSuperiorityQueries.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'prone', saveType: 'STR', saveAbility: 'STR', damageBonus: true, sizeLimit: 'large_or_smaller', dieExpression: 'superiority_die' },
    ]),
}));

const CAMPAIGN = 'test-campaign';

// Raw specialActions row mirroring the BM major automation.
const stats = () => ({
    name: 'EvasiveFighter',
    rules: '2024',
    specialActions: [{
        name: 'Combat Superiority',
        type: 'combat_superiority',
        automation: { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'], dieExpression: 'superiority_die' },
    }],
});

describe('MN-020 handleAttackRiderPrompt — save spec passthrough', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true, weaponType: 'melee', targetName: 'Knight 1' } };
            if (key === 'BattleMasterManeuvers_selection') return ['Trip Attack'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
    });

    it('rebuilds the action automation with the "ability" token, not a number', async () => {
        await getManeuversForRules('2024');
        const result = await handleAttackRiderPrompt({}, stats(), CAMPAIGN, null);

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.saveDc).toBe('ability');
        expect(result.payload.action.automation.saveAbility).toEqual(['STR', 'DEX']);
        expect(result.payload.action.automation.dieExpression).toBe('superiority_die');
    });

    it('falls back to the "ability" token when attackContext carries no saveDc', async () => {
        await getManeuversForRules('2024');
        const result = await handleAttackRiderPrompt({}, stats(), CAMPAIGN, null);

        expect(result.payload.saveDc).toBe('ability');
    });
});
