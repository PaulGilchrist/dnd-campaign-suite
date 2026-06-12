import { vi } from 'vitest';

export const mockPlayerStats = {
  name: 'Test Character',
  rules: '5e (default)',
  spellAbilities: {
    toHit: 5,
    modifier: 3,
    saveDc: 13,
    cantrips_known: 3,
    prepared_spells: 5,
    maxPreparedSpells: 5,
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spells: [
      {
        name: 'Fireball',
        level: 3,
        casting_time: '1 action',
        range: '150 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: {
               '3': '8d6',
               },
          damage_type: 'Fire',
          },
        prepared: 'Prepared',
          },
        {
        name: 'Magic Missile',
        level: 1,
        casting_time: '1 action',
        range: '120 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: {
               '1': '1d4+1',
               },
          damage_type: 'Force',
          },
        prepared: 'Always',
          },
        {
        name: 'Light',
        level: 0,
        casting_time: '1 action',
        range: 'Touch',
        duration: '10 minutes',
        components: ['V', 'M'],
        prepared: 'Always',
      },
         ],
       },
};

export const mockPlayerStats2024 = {
  name: 'Test Character',
  rules: '2024',
  spellAbilities: {
    toHit: 5,
    modifier: 3,
    saveDc: 13,
    cantrips_known: 3,
    prepared_spells: 5,
    maxPreparedSpells: 5,
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spells: [
      {
        name: 'Fireball',
        level: 3,
        casting_time: '1 action',
        range: '150 feet',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: {
               '3': '8d6',
               },
          damage_type: 'Fire',
          },
        prepared: 'Prepared',
          },
        {
        name: 'Magic Missile',
        level: 1,
        casting_time: '1 action',
        range: '120 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: {
               '1': '1d4+1',
               },
          damage_type: 'Force',
          },
        prepared: 'Always',
          },
        {
        name: 'Light',
        level: 0,
        casting_time: '1 action',
        range: 'Touch',
        duration: '10 minutes',
        components: ['V', 'M'],
        prepared: 'Always',
      },
         ],
       },
};

export const mockHandleTogglePreparedSpells = vi.fn();
export const mockGateMetamagic = vi.fn();
export const mockGateUpcast = vi.fn(() => false);
export const mockGetCantripAutoLevel = vi.fn(() => null);
