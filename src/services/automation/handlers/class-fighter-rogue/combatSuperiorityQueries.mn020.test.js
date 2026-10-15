// @maintained-by-ai: 2026-10-15
// MN-020: poller/rider prompt legs rebuild their own action — the raw 'ability'
// save token + STR/DEX saveAbility must survive the rebuild so the save resolves
// 8 + STR/DEX mod + PB (DC 17 for a STR +3 PB +6 host), never DC 10/14.
//
// Ownership (this file = sole query/prompt-side token-passthrough owner):
//   - handleAttackRiderPrompt payload rebuild carries the character row's raw
//     saveDc/saveAbility/dieExpression tokens (explicit, defaulted, and the
//     attackContext-precedence branch on payload.saveDc/saveType).
//   - The downstream DC math on those tokens (buildSaveDc → 17, never baked
//     14/10) lives in executeAttackRider.mn020.test.js; ByTrigger offer gate
//     in combatSuperiorityQueries.mn018.test.js; shared-query/live chooser
//     lanes in combatSuperiorityQueries.mn014.test.js; handler barrel routing
//     and the selection-modal payload in combatSuperiorityHandler*.test.js.
//
// Trim notes (2026-10-15): collapsed the two former tests — the second
// ('falls back to the "ability" token when attackContext carries no saveDc')
// ran identical input to the first and pinned payload.saveDc derived from the
// same characterSuperioritySaveSpec() call, without ever exercising the real
// '|| ability' fallback. Replaced with the true no-spec default branch and
// added the attackContext-precedence branch (context saveDc wins at the top
// level while the rebuilt action automation keeps the raw row tokens).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAttackRiderPrompt } from './combatSuperiorityQueries.js';
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
const stats = (automation = { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'], dieExpression: 'superiority_die' }) => ({
    name: 'EvasiveFighter',
    rules: '2024',
    specialActions: [{
        name: 'Combat Superiority',
        type: 'combat_superiority',
        automation,
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
        const result = await handleAttackRiderPrompt({}, stats(), CAMPAIGN, null);

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.saveDc).toBe('ability');
        expect(result.payload.action.automation.saveAbility).toEqual(['STR', 'DEX']);
        expect(result.payload.action.automation.dieExpression).toBe('superiority_die');
        // Top-level payload defaults from the same row spec (context carries neither).
        expect(result.payload.saveDc).toBe('ability');
        expect(result.payload.saveType).toBeNull();
    });

    it('defaults to the "ability" token and STR/DEX when the row carries no save spec', async () => {
        const result = await handleAttackRiderPrompt({}, stats({ type: 'combat_superiority', dieExpression: 'superiority_die' }), CAMPAIGN, null);

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.saveDc).toBe('ability');
        expect(result.payload.action.automation.saveAbility).toEqual(['STR', 'DEX']);
        expect(result.payload.saveDc).toBe('ability');
    });

    it('attackContext saveDc/saveType win at the top level while the rebuilt automation keeps the raw row tokens', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true, weaponType: 'melee', targetName: 'Knight 1', saveDc: 15, saveType: 'STR' } };
            if (key === 'BattleMasterManeuvers_selection') return ['Trip Attack'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });

        const result = await handleAttackRiderPrompt({}, stats(), CAMPAIGN, null);

        expect(result.payload.saveDc).toBe(15);
        expect(result.payload.saveType).toBe('STR');
        expect(result.payload.action.automation.saveDc).toBe('ability');
        expect(result.payload.action.automation.saveAbility).toEqual(['STR', 'DEX']);
    });
});
