// MA-0104: Adult Gold Dragon Banish authored failed-save demiplane-transport
// clause — parse arms the banished_demiplane te producer in saveProcessing
// (MA-0073 parse shape). Distinct te from the PC spell `banishment`.
import { describe, it, expect } from 'vitest';
import { parseBanishTransportClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const gold = () => monstersData.find(m => m.name === 'Adult Gold Dragon');

describe('MA-0104 parseBanishTransportClause', () => {
  it('matches the authored Adult Gold Dragon Banish save_effect', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Banish');
    expect(parseBanishTransportClause(row.save_effect)).toEqual({ effect: 'banished_demiplane' });
  });

  it('matches the Ancient Gold Dragon Banish row too', () => {
    const row = monstersData.find(m => m.name === 'Ancient Gold Dragon')
      .legendary_actions.find(a => a.name === 'Banish');
    expect(parseBanishTransportClause(row.save_effect)).toEqual({ effect: 'banished_demiplane' });
  });

  it('case-insensitive match', () => {
    expect(parseBanishTransportClause('Transported to a Harmless Demiplane until the start of the dragon’s next turn')).toEqual({ effect: 'banished_demiplane' });
  });

  it('does not match the Soul Tome trapping clause (different wording)', () => {
    const row = monstersData.find(m => m.name === 'Death kiss');
    const soulTome = (row?.actions || []).find(a => /Soul Tome/.test(a.save_effect || ''));
    expect(parseBanishTransportClause(soulTome?.save_effect)).toBeNull();
    expect(parseBanishTransportClause('The target is trapped in a demiplane inside the Soul Tome.')).toBeNull();
  });

  it('returns null for rows without the clause / non-strings', () => {
    expect(parseBanishTransportClause('Target is Poisoned.')).toBeNull();
    expect(parseBanishTransportClause('Speed is halved until end of turn')).toBeNull();
    expect(parseBanishTransportClause(null)).toBeNull();
    expect(parseBanishTransportClause(undefined)).toBeNull();
    expect(parseBanishTransportClause(42)).toBeNull();
  });
});

describe('MA-0104 monsters.json data lock: Adult Gold Dragon Banish row', () => {
  it('keeps DC 21 Charisma, 3d6 Force, dc_success none, and the transport clause text', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Banish');
    expect(row.save_dc).toBe(21);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.save_effect).toMatch(/transported to a harmless demiplane until the start of the dragon's next turn/i);
    expect(row.save_effect).toMatch(/reappearance placement GM-enforced/i);
    expect(row.description).toMatch(/banished_demiplane te granted on a failed save/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
  });
});
