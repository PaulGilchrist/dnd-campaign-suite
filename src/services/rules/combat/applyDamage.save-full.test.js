// @maintained-by-ai
// MA-0367: dc_success 'full' math — the Infernal Glaive save gates ONLY the
// wound clause, so the attack damage stands FULL on success AND failure, and
// Evasion never halves it (there is no half-damage outcome to halve).
// This lane is the sole driver of the REAL computeDamageAfterSave /
// computeDamageAfterEvasion with dc_success 'full' (#1196): the base lane
// applyDamage.helpers.test.js deliberately skips 'full' (comment at :89) and
// saveProcessing.infernal-wound.test.js MOCKS both helpers (:51-54).
// Generic half/none arithmetic at this seam is owned verbatim by the base
// lane (:88-104 for computeDamageAfterSave, :184-196 for computeDamageAfterEvasion)
// and is deliberately NOT re-driven here.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave, computeDamageAfterEvasion } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const glaive = () => monsters.find(m => m.name === 'Bearded Devil')
  .actions.find(a => a.name === 'Infernal Glaive');

describe('MA-0367 disk row: Bearded Devil Infernal Glaive honestly carries dc_success "full"', () => {
  it('save gates only the wound clause — no half-on-success clause anywhere on the row (#1131 honest canon)', () => {
    const row = glaive();
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('1d10 + 3');
    expect(row.damage_type_primary).toBe('Slashing');
    expect(row.hit_target_effect).toBe('infernal_wound');
    expect(row.dc_success).toBe('full');
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
  });
});

describe('MA-0367 computeDamageAfterSave dc_success "full" (REAL helper, dcSuccess read from disk)', () => {
  it('raw damage lands undiminished on save success AND save failure — the 8 (1d10 + 3) the disk prose states', () => {
    const dcSuccess = glaive().dc_success;
    expect(computeDamageAfterSave(8, true, dcSuccess)).toBe(8);
    expect(computeDamageAfterSave(8, false, dcSuccess)).toBe(8);
  });
});

describe('MA-0367 computeDamageAfterEvasion dc_success "full" (REAL helper, dcSuccess read from disk)', () => {
  it('evasion ACTIVE never halves a full row — success keeps FULL (never 0), failure keeps FULL', () => {
    const dcSuccess = glaive().dc_success;
    expect(computeDamageAfterEvasion(8, true, dcSuccess, true)).toBe(8);
    expect(computeDamageAfterEvasion(8, false, dcSuccess, true)).toBe(8);
  });
});
