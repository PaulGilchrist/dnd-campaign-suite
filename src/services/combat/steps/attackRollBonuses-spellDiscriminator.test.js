// SP-112: weapon-only damage_bonus riders gated to WEAPON attacks.
// buildWeaponHitBonusesStep fired Blessed Strikes / Divine Strike on SPELL
// attacks (Spiritual Weapon got a stray "+2d8 [radiant]" appended to its
// "1d8 + 3 [force]" and the radiant was mislabeled Force in hp_change).
// A spell attack (autoDamageSchool / attack.attackType==='spell' /
// attack.school / attack.weaponType==='spell' / isWeaponAttack===false) must
// collect NO weapon damage_bonus, stamp no _Divine_Strike_usedRound, and never
// open the damage-type modal. Mirrors combatSuperiorityQueries.js
// (`weapon_attack_hit && !isWeaponAttack → skip`) and the FT-071 spell token.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWeaponHitBonusesStep } from './attackRollBonuses.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 8, rolls: [5, 3], modifier: 0 })),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));
vi.mock('../automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn((expr) => expr),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Divine Strike (Improved Blessed Strikes lv14 upgrade form) — the exact rider
// the app data attaches to the Life Cleric. damageType has ' or ' so a WEAPON
// hit would normally open the damage-type modal + append radiant.
const divineStrike = {
    name: 'Improved Blessed Strikes',
    type: 'damage_bonus',
    trigger: 'weapon_attack_hit',
    damageExpression: '2d8',
    damageType: 'Necrotic or Radiant',
    oncePerTurn: true,
    options: ['Divine Strike', 'Potent Spellcasting'],
    upgrades: 'Blessed Strikes',
};

function makeCtx(overrides = {}) {
    return {
        campaignName: 'test-campaign',
        playerStats: {
            name: 'Divine_Cleric',
            automation: { actions: [divineStrike], passives: [] },
        },
        attack: { name: 'Mace', weaponType: 'weapon', damageType: 'Bludgeoning' },
        formula: '1d8 + 3',
        total: 7,
        rolls: [4],
        ...overrides,
    };
}

describe('SP-112: weaponHitBonuses spell-attack discriminator', () => {
    let step;

    beforeEach(() => {
        vi.clearAllMocks();
        step = buildWeaponHitBonusesStep();
        // Divine Strike chosen so the rider WOULD fire on a weapon hit.
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === '_Blessed_Strikes_option') return 'Divine Strike';
            if (prop === '_Improved_Blessed_Strikes_usedRound') return null;
            return null;
        });
    });

    it('still applies the Divine Strike rider to a genuine WEAPON attack (control)', async () => {
        const result = await step.handler(makeCtx());

        // Weapon attack → rider fires (modal for 'Necrotic or Radiant').
        expect(result.modal).toBeTruthy();
        expect(result.modal.type).toBe('damageTypeChoice');
    });

    it('does NOT fire Divine Strike on a Spiritual Weapon SPELL attack (autoDamageSchool)', async () => {
        const ctx = makeCtx({ autoDamageSchool: 'Evocation' });
        const result = await step.handler(ctx);

        expect(result.modal).toBeUndefined();
        expect(result.data.formula).toBe('1d8 + 3');
        expect(result.data.total).toBe(7);
        expect(result.data.formula).not.toContain('radiant');
        expect(result.data.formula).not.toContain('2d8');
        // No once-per-turn stamp for a spell attack.
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Divine_Cleric', '_Improved_Blessed_Strikes_usedRound', expect.anything(), 'test-campaign',
        );
    });

    it('does NOT fire on a spell attack flagged via attackType:school/weaponType/isWeaponAttack===false', async () => {
        const variants = [
            { attack: { name: 'Spiritual Weapon: Move & Attack', attackType: 'spell', school: 'Evocation' } },
            { attack: { name: 'Spiritual Weapon', weaponType: 'spell' } },
            { attack: { name: 'Spiritual Weapon', isWeaponAttack: false } },
            { attack: { name: 'Spiritual Weapon', school: 'Evocation' } },
        ];
        for (const v of variants) {
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((key, prop) => (prop === '_Blessed_Strikes_option' ? 'Divine Strike' : null));
            const result = await step.handler(makeCtx(v));
            expect(result.modal).toBeUndefined();
            expect(result.data.formula).toBe('1d8 + 3');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        }
    });
});
