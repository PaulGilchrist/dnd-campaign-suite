// MA-1894: Fenrir "Winter's Howl (Costs 2 Actions)" save core adjudicated
// honestly (DC 24 CON, saveResult machine-stamped) but applied NOTHING on
// fail — the primary Frightened payload was prose-only in `description`,
// never authored as `save_effect`, so extractConditionsFromSaveEffect was
// blind and applyFailedSaveConditions early-returned (MA-0090 stranded
// save-shell). One-field DATA fix: canonical "The target has the Frightened
// condition until the end of its next turn." (§346 save-lane word-scan;
// Archlich Dread Word MA-1855 byte-twin, live-verified rounds:2 clock via
// until_end_of_next_turn). LA cost 2 rides the MA-1883 legendaryActionCost
// "(Costs N Actions)" parse — no engine change here. Victim pitfall:
// ElderPaladin's Aura of Courage strips Frightened (saveProcessing.js:1081)
// — Bandit is the clean frightened-canvas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const FENRIR = monsters.find((m) => m.index === 'fenrir');
const HOWL = FENRIR.legendary_actions.find((a) => a.name.startsWith("Winter's Howl"));

describe('MA-1894 disk fingerprint: Winter\'s Howl Frightened payload authored', () => {
  it('save_effect carries the canonical Frightened clause (word-scan live)', () => {
    expect(HOWL.save_effect).toBe('The target has the Frightened condition until the end of its next turn.');
    expect(extractConditionsFromSaveEffect(HOWL.save_effect)).toEqual(['frightened']);
  });

  it('save core byte-unchanged (live-verified exact): DC 24 CON, damageless', () => {
    expect(HOWL.save_dc).toBe(24);
    expect(HOWL.save_type).toBe('Constitution');
    expect(HOWL.damage_dice_primary).toBeUndefined();
    expect(HOWL.dc_success).toBeUndefined(); // damageless — nothing to halve
    expect(HOWL.description).toBe(
      "Constitution Saving Throw: DC 24, each creature within 60 ft. The target also has the Frightened condition until the end of its next turn."
    );
  });

  it('LA cost 2 rides the MA-1883 parse (Costs 2 Actions)', () => {
    expect(legendaryActionCost(HOWL)).toBe(2);
  });
});
