// @maintained-by-ai
// MA-0503: Cockatrice Regent Petrifying Bite — row-unique lock ONLY (the fewest
// tests that still guard this disk row): actions[1] byte-shape (DC 14, attack +7,
// 2d8+4 Piercing, dc_success:"full" + staged_petrify 24 hours) and
// parseStagedPetrifyClause arming generically on the DC-14 row's structured key,
// with the talons legacy-null (no key, no save_dc) cited by cockatrice-bite.test.jsx:12.
// Trimmed per #584: buildSaveOptions/buildAbilitySaveRollContext transport is generic
// — owned by cockatrice-bite.test.jsx (DC-11 twin, MA-0501); computeDamageAfterSave
// full/half math owned by applyDamage.save-full.test.js (MA-0367 :10-19); 'half'
// default owned by MonsterCard.ma1971-wing-defense.test.jsx:71; saveType 'con' map
// + clauseless dcSuccess null owned by ma1578-tarrasque-swallow:127 /
// ma1071-pincer DC0 gate:82. Staged ladder owned by cockatricePetrifyService.test.js
// (:69 stage-1 Restrained-only, :167 turn-END Petrified 14400-round clock,
// :284-:331 DC-15 Gorgon twin proves row-dc is a pass-through parameter —
// DC-14 rides the same seam, no regent-specific ladder behavior).
import { describe, it, expect } from 'vitest';
import { parseStagedPetrifyClause } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const regent = (monstersData.monsters || monstersData).find(m => m.name === 'Cockatrice Regent');
const bite = regent.actions[1];
const talons = regent.actions[2];

describe('MA-0503 cockatrice-regent Petrifying Bite row lock', () => {
  it('authored data lock: dc_success full + staged_petrify 24 hours on actions[1]', () => {
    expect(bite.name).toBe('Petrifying Bite');
    expect(bite.attack_bonus).toBe(7);
    expect(bite.save_dc).toBe(14);
    expect(bite.save_type).toBe('Constitution');
    expect(bite.dc_success).toBe('full');
    expect(bite.staged_petrify).toEqual({ petrified_hours: 24 });
    expect(bite.damage_dice_primary).toBe('2d8 + 4');
    expect(bite.damage_type_primary).toBe('Piercing');
  });

  it('parseStagedPetrifyClause arms the DC-14 row via the generic structured key; talons stay null', () => {
    expect(parseStagedPetrifyClause(bite)).toEqual({ petrifiedRounds: 14400 });
    expect(talons.name).toBe('Talons');
    expect(parseStagedPetrifyClause(talons)).toBeNull();
  });
});
