// MA-0087: Adult Copper Dragon Multiattack — Slowing Breath "slowed" rider
// clause parse + data locks. 'slowed' is NOT a registered condition (no badge
// consumer), so each clause maps to an EXISTING registered te with a live
// consumer: speed_half, no_reactions, no_action_and_bonus_action. The parse is
// byte-inert (null) for rows without any clause. Also locks the Mind Spike
// (level 4 version) cast shape: save-leg WIS DC 17, authored lv4 = 5d8.
import { describe, it, expect } from 'vitest';
import { parseSlowedClauses } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';

const COPPER = monstersData.find(m => m.index === 'adult-copper-dragon');

describe('MA-0087 parseSlowedClauses', () => {
  it('maps all three Adult Copper Slowing Breath clauses to registered te keys', () => {
    const row = COPPER.actions.find(a => a.name === 'Slowing Breath');
    expect(parseSlowedClauses(row.save_effect)).toEqual({
      effects: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'],
    });
  });

  it('case-insensitive / curly-apostrophe tolerant match', () => {
    expect(parseSlowedClauses('the target can’t take Reactions; its Speed is halved; either an action or a Bonus Action, not both')).toEqual({
      effects: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'],
    });
  });

  it('returns partial clause lists (each clause independent)', () => {
    expect(parseSlowedClauses('Speed is halved until end of turn')).toEqual({ effects: ['speed_half'] });
    expect(parseSlowedClauses('can\'t take Reactions')).toEqual({ effects: ['no_reactions'] });
  });

  it('byte-inert: null for clauseless rows / non-strings', () => {
    expect(parseSlowedClauses('The target is Poisoned.')).toBeNull();
    expect(parseSlowedClauses('takes 12d8 Acid damage. Success: Half damage.')).toBeNull();
    expect(parseSlowedClauses(null)).toBeNull();
    expect(parseSlowedClauses(undefined)).toBeNull();
    expect(parseSlowedClauses(42)).toBeNull();
  });
});

describe('MA-0087 Adult Copper data locks', () => {
  it('Slowing Breath row: DC 18 CON, damageless, dc_success none suppresses half boilerplate', () => {
    const row = COPPER.actions.find(a => a.name === 'Slowing Breath');
    expect(row.save_dc).toBe(18);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBeUndefined();
  });

  it('Spellcasting row exposes Mind Spike (level 4 version) as a markup link', () => {
    const row = COPPER.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(17);
    expect(row.description).toMatch(/<em>Mind Spike<\/em>\s*\(level 4 version\)/);
  });

  it('legendary Mind Jolt row is gated + numeric save-leg (MA-0070 pattern)', () => {
    const row = COPPER.legendary_actions.find(a => a.name === 'Mind Jolt');
    expect(row).toBeTruthy();
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Wisdom');
    expect(row.damage_dice_primary).toBe('5d8');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.dc_success).toBe('half');
  });

  it('spells.json Mind Spike is a WIS save spell with lv4 = 5d8 in damage_at_slot_level', () => {
    const spike = (spells2024.spells || spells2024).find(s => s.name === 'Mind Spike');
    expect(spike.attack_type).toBeNull();
    expect(spike.level).toBe(2);
    expect(spike.dc.dc_type).toBe('WIS');
    expect(spike.dc.dc_success).toBe('half');
    expect(spike.damage.damage_at_slot_level['4']).toBe('5d8');
  });
});
