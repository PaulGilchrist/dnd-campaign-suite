// MA-1436: breathAoeShape emanation hoist — the Satyr Revelmaster Fey Melody
// row authors range:"60-foot Emanation" while its description mentions "line of
// sight"; pre-fix the prose /\bline\b/ scrape won first and opened a fake
// "60-ft Line" picker (live repro fingerprint). Post-fix the RANGE-field
// emanation check is hoisted BEFORE the prose shape scrape (census: no other
// emanation-range row carries prose cone/line/radius/sphere tokens), and the
// MA-0875/MA-0031 prose legs keep their adjudicated outputs byte-identical.
import { describe, it, expect } from 'vitest';
import { breathAoeShape } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');

describe('MA-1436 breathAoeShape — authored emanation beats prose shape tokens', () => {
  it('Fey Melody parses a 60-ft Radius emanation picker, never a Line', () => {
    expect(/line of sight/i.test(FEY_MELODY.description)).toBe(true);
    expect(breathAoeShape(FEY_MELODY, null)).toEqual({ shape: 'Radius', feet: 60, rangeGateFt: 60 });
  });

  it('byte-inertia: prose Cone rows without an emanation range still parse Cone', () => {
    expect(breathAoeShape({ save_dc: 15, range: 'Self', description: '30-foot Cone of poison.' }, null)).toMatchObject({ shape: 'Cone', feet: 30 });
  });

  it('byte-inertia: prose Line rows without a range field still parse Line', () => {
    expect(breathAoeShape({ save_dc: 15, range: '', description: 'A 60-foot line of lightning.' }, null)).toMatchObject({ shape: 'Line', feet: 60 });
  });

  it('byte-inertia: no DC, no shape — DC0 decoy stays picker-inert', () => {
    expect(breathAoeShape({ save_dc: 0, range: '60-foot Emanation', description: 'Spores.' }, null)).toBeNull();
  });
});
