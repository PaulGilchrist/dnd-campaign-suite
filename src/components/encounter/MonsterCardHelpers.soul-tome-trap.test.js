// MA-0298: Arcanaloth Banishing Claw (Requires Soul Tome) — soul tome trap
// clause parse + data lock. The parser matches RAW "trapped in a demiplane"
// ONLY (byte-truthful: RAW never says "transported to a harmless demiplane");
// the MA-0104 parseBanishTransportClause stays byte-inert here and vice versa.
import { describe, it, expect } from 'vitest';
import { parseSoulTomeTrapClause, parseBanishTransportClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const arcanaloth = () => monstersData.find(m => /arcanaloth/i.test(m.name));
const banishingClaw = () => arcanaloth().actions[2];

describe('MA-0298 parseSoulTomeTrapClause', () => {
  it('matches the authored Arcanaloth Banishing Claw save_effect', () => {
    expect(parseSoulTomeTrapClause(banishingClaw().save_effect)).toEqual({ effect: 'banished_demiplane', soulTome: true });
  });

  it('matches the RAW "trapped in a demiplane" phrase case-insensitively', () => {
    expect(parseSoulTomeTrapClause('The Target Is Trapped In A Demiplane Inside The Soul Tome.')).toEqual({ effect: 'banished_demiplane', soulTome: true });
  });

  it('does NOT match the MA-0104 Banish transport wording (distinct clause)', () => {
    expect(parseSoulTomeTrapClause('transported to a harmless demiplane until the start of the dragon\'s next turn')).toBeNull();
  });

  it('is byte-inert for rows without the clause / non-strings', () => {
    expect(parseSoulTomeTrapClause('Target is Poisoned.')).toBeNull();
    expect(parseSoulTomeTrapClause(null)).toBeNull();
    expect(parseSoulTomeTrapClause(undefined)).toBeNull();
    expect(parseSoulTomeTrapClause(42)).toBeNull();
  });

  it('MA-0104 regression: parseBanishTransportClause still never matches the Soul Tome RAW wording', () => {
    expect(parseBanishTransportClause(banishingClaw().save_effect)).toBeNull();
  });
});

describe('MA-0298 monsters.json data lock: Arcanaloth Banishing Claw row', () => {
  it('authors dc_success "none" — the CHA save gates ONLY the trap; hit damage is unconditional and unhalved on a success (MV-20 leak fix)', () => {
    const row = banishingClaw();
    expect(row.name).toBe('Banishing Claw (Requires Soul Tome)');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
  });

  it('keeps the full attack + combo damage numerics byte-intact', () => {
    const row = banishingClaw();
    expect(row.attack_bonus).toBe(9);
    expect(row.damage_dice_primary).toBe('2d4 + 5');
    expect(row.damage_type_primary).toBe('Slashing');
    expect(row.damage_dice_secondary).toBe('3d12');
    expect(row.damage_type_secondary).toBe('Psychic');
  });

  it('carries RAW byte-truth "trapped in a demiplane" + Incapacitated in description AND save_effect (never rewritten to "transported")', () => {
    const row = banishingClaw();
    expect(row.description).toMatch(/trapped in a demiplane inside the Soul Tome/i);
    expect(row.save_effect).toMatch(/trapped in a demiplane inside the Soul Tome/i);
    expect(row.save_effect).toMatch(/Incapacitated/i);
    expect(row.save_effect).not.toMatch(/transported to a harmless demiplane/i);
  });

  it('authors MA-0048 repeat_save as an OBJECT carrying save_type Charisma (MA-0147 booleans-kill-the-seam rule)', () => {
    const row = banishingClaw();
    expect(typeof row.repeat_save).toBe('object');
    expect(row.repeat_save).not.toBeNull();
    expect(row.repeat_save.save_type).toBe('Charisma');
  });
});
