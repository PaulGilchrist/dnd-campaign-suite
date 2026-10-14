import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { sacredWeapon } from './sacredWeapon.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Paladin1' },
    attack: {},
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('sacredWeapon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    describe('weapon type checks', () => {
      it('returns true when weaponType is melee and passives exist', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(true);
      });

      it('returns true when weaponType is unarmed and passives exist', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(true);
      });

      it('returns true when weaponType is melee and passives array exists (even if empty)', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: {
            automation: {
              passives: [],
            },
          },
        });

        // Empty array is truthy, so condition returns true
        expect(sacredWeapon.condition(ctx)).toBe(true);
      });

      it('returns true when weaponType is unarmed and passives array exists (even if empty)', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: {
            automation: {
              passives: [],
            },
          },
        });

        // Empty array is truthy, so condition returns true
        expect(sacredWeapon.condition(ctx)).toBe(true);
      });

      it('returns false when weaponType is ranged even with passives', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'ranged' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when weaponType is thrown even with passives', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'thrown' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when weaponType is missing even with passives', () => {
        const ctx = makeCtx({
          attack: {},
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });
    });

    describe('passives checks', () => {
      it('returns false when automation is missing', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: {},
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when automation.passives is missing', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: {
            automation: {},
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('throws when playerStats is null (no null check in code)', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: null,
        });

        expect(() => sacredWeapon.condition(ctx)).toThrow(TypeError);
      });

      it('returns false when attack is null', () => {
        const ctx = makeCtx({
          attack: null,
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when attack is undefined', () => {
        const ctx = makeCtx({
          attack: undefined,
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when attack.weaponType is undefined', () => {
        const ctx = makeCtx({
          attack: { weaponType: undefined },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns false when attack.weaponType is empty string', () => {
        const ctx = makeCtx({
          attack: { weaponType: '' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(false);
      });

      it('returns true when passives has other effects but Sacred Weapon is present', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: {
            automation: {
              passives: [
                { name: 'Divine Sense', effect: 'divine_sense' },
                { name: 'Lay on Hands', effect: 'lay_on_hands' },
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
        });

        expect(sacredWeapon.condition(ctx)).toBe(true);
      });
    });
  });

  describe('handler', () => {
    describe('early returns — no Sacred Weapon passive', () => {
      it('returns null when automation.passives is empty', async () => {
        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toBe(null);
      });

      it('returns null when no passive matches Sacred Weapon', async () => {
        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Divine Sense', effect: 'divine_sense' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toBe(null);
      });

      it('returns null when passive has wrong effect', async () => {
        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'wrong_effect' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toBe(null);
      });

      it('returns null when automation.passives is null', async () => {
        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: null,
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toBe(null);
      });
    });

    describe('early returns — no active buff found', () => {
      it('returns prevData when activeBuffs is empty', async () => {
        getRuntimeValue.mockReturnValue([]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when activeBuffs is null', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when no buff matches Sacred Weapon', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Other Buff', effect: 'other' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('successful application — no damage type choice', () => {
      it('returns prevData when buff exists but has no damageTypeChoice', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when buff has damageTypeChoice as null', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: null },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when buff has damageTypeChoice as empty string', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: '' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('successful application — damage type choice applied', () => {
      it('applies damageTypeChoice to attack.damageType when weapon is melee', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('Radiant');
      });

      it('applies damageTypeChoice when weapon is unarmed', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Psychic' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'unarmed' },
        });

        const prevData = { formula: '1d4+2', total: 6 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('Psychic');
      });

      it('overwrites existing damageType on attack', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee', damageType: 'slashing' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('Radiant');
      });

      it('does not modify attack.damageType when no damageTypeChoice on buff', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee', damageType: 'piercing' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('piercing');
      });

      it('preserves other attack properties', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee', damageType: 'slashing', ability: 'str' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('Radiant');
        expect(ctx.attack.ability).toBe('str');
      });
    });

    describe('handler with multiple buffs', () => {
      it('finds Sacred Weapon among other buffs', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Divine Shield', effect: 'divine_shield' },
          { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'Radiant' },
          { name: 'Bless', effect: 'bless' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
        expect(ctx.attack.damageType).toBe('Radiant');
      });

      it('handles when Sacred Weapon buff has different name casing', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'sacred weapon', effect: 'sacred_weapon' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await sacredWeapon.handler(ctx, prevData);

        // Should return prevData because name 'sacred weapon' != 'Sacred Weapon'
        expect(result).toEqual({ data: prevData });
      });
    });

    describe('handler with minimal prevData', () => {
      it('returns prevData when it is an empty object', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = {};
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when it has only formula', async () => {
        getRuntimeValue.mockReturnValue([
          { name: 'Sacred Weapon', effect: 'sacred_weapon' },
        ]);

        const ctx = makeCtx({
          playerStats: {
            name: 'Paladin1',
            automation: {
              passives: [
                { name: 'Sacred Weapon', effect: 'sacred_weapon' },
              ],
            },
          },
          attack: { weaponType: 'melee' },
        });

        const prevData = { formula: '1d8+3' };
        const result = await sacredWeapon.handler(ctx, prevData);

        expect(result).toEqual({ data: prevData });
      });
    });
  });
});
