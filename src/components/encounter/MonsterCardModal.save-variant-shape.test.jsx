// @maintained-by-ai
// MA-1436/MA-1878: breathAoeShape SHAPE lane (pure function, real disk rows,
// zero mocks) — authored emanation RANGE vs prose shape scrape vs the MA-1878
// LOS-sanitize double guard.
// MA-1436: the Satyr Revelmaster Fey Melody row authors range:"60-foot
// Emanation" while its description mentions "line of sight"; pre-fix the prose
// /\bline\b/ scrape won first and opened a fake "60-ft Line" picker (live repro
// fingerprint). Post-fix the RANGE-field emanation check is hoisted BEFORE the
// prose shape scrape, pinned here WITH its disk census (every authored
// emanation-range row on monsters.json parses an exact Radius picker; Fey
// Melody is the SOLE prose-token row, so the hoist is byte-inert elsewhere).
// MA-1878: prose scrape runs LOS-sanitized ONLY on VARIANT rows that also
// author a NUMERIC origin range — "line of sight" is a targeting condition, not
// an area shape (Demogorgon Gaze → null, no fake Line); every other row shape
// stays byte-identical (Tarrasque FP / Young Green Dragon Wall of Thorns).
//
// Owner lanes cited — coverage NOT duplicated here:
// - parseSaveVariantChooser arm/inert truth table + Fey Melody row disk lock:
//   MonsterCardHelpers.save-variant-chooser.test.js (#743 parse owner).
// - legendaryDelegateChooserAction inherit branches: ma1881-...-gaze-inherit
//   .test.js (#743); chip→chooser→latch flow: ma1881-...-gaze.test.jsx (#744).
// - Gaze te-bearing POSITIVE + save-context threading: saveProcessing
//   .ma1878-demogorgon-gaze.test.js (consumer DATA lock — never calls
//   breathAoeShape directly, so the Gaze→null shape pin is owned HERE).
// - Math.max Line-width leg: MonsterCardModal.lair-lightning-arcs.test.jsx;
//   zone-beats-cylinder: whirlwind-zone.test.jsx; Cube→radius: ma0875-cube
//   -shape.test.jsx; DC0 emanation FLOW (not parse): demilich-howl-emanation
//   .test.jsx (:13 defers parse units to this file).
import { describe, it, expect } from 'vitest';
import { breathAoeShape } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');

// Census rows (real disk, #760/#761): every authored "N-foot Emanation" RANGE row.
const EMANATION_ROWS = ['actions', 'legendary_actions', 'lair_actions', 'bonus_actions', 'reactions'].flatMap(k =>
  monstersData.flatMap(m => (Array.isArray(m[k]) ? m[k] : []).filter(a => a && /^\d+-foot emanation$/i.test(String(a.range || '')))));

describe('MA-1436 breathAoeShape — authored emanation beats prose shape tokens', () => {
  it('Fey Melody parses a 60-ft Radius emanation picker, never a Line', () => {
    expect(/line of sight/i.test(FEY_MELODY.description)).toBe(true);
    expect(breathAoeShape(FEY_MELODY, null)).toEqual({ shape: 'Radius', feet: 60, rangeGateFt: 60 });
  });

  it('census: all 21 disk emanation-range rows parse exact Radius pickers (DC0 rows picker-inert); Fey Melody is the SOLE prose shape-token row, so the hoist is byte-inert elsewhere', () => {
    expect(EMANATION_ROWS).toHaveLength(21);
    expect(EMANATION_ROWS.filter(a => /\b(cone|line|radius|sphere)\b/i.test(String(a.description))).map(a => a.name)).toEqual(['Fey Melody']);
    for (const row of EMANATION_ROWS) {
      const feet = Number(String(row.range).match(/^(\d+)/)[1]);
      const armed = row.save_dc != null && Number(row.save_dc) > 0;
      expect(breathAoeShape(row, null), row.name).toEqual(armed ? { shape: 'Radius', feet, rangeGateFt: feet } : null);
    }
  });

  it('byte-inertia: prose Cone rows without an emanation range still parse an exact 30-ft Cone picker', () => {
    expect(breathAoeShape({ save_dc: 15, range: 'Self', description: '30-foot Cone of poison.' }, null)).toEqual({ shape: 'Cone', feet: 30, rangeGateFt: 30 });
  });

  it('byte-inertia: no DC, no shape — DC0 decoy stays picker-inert', () => {
    expect(breathAoeShape({ save_dc: 0, range: '60-foot Emanation', description: 'Spores.' }, null)).toBeNull();
  });
});

describe('MA-1878 breathAoeShape — LOS sanitize double guard (variants && numeric range)', () => {
  it('guard-armed row whose only shape word is "line of sight" parses NULL — Demogorgon Gaze is an inline single-target sighted save, no fake Line', () => {
    const gaze = monstersData.find(m => m.index === 'demogorgon').actions.find(a => a.name === 'Gaze');
    expect(/line of sight/i.test(gaze.description)).toBe(true);
    expect(gaze.range).toBe('120 feet');
    expect(gaze.variants.length).toBeGreaterThan(1);
    expect(breathAoeShape(gaze, null)).toBeNull();
  });

  it('byte-inertia: rows NOT arming the guard keep their adjudicated prose Line picker — Tarrasque Frightful Presence (range absent) + Young Green Dragon Wall of Thorns (no variants, MA-1785 pin; "blocks line of sight" there IS the wall area)', () => {
    const fp = monstersData.find(m => m.index === 'tarrasque').actions.find(a => a.name === 'Frightful Presence');
    expect(fp.range ?? null).toBeNull();
    expect(fp.variants ?? null).toBeNull();
    expect(breathAoeShape(fp, null)).toEqual({ shape: 'Line', feet: 120, rangeGateFt: 120 });
    const wall = monstersData.find(m => m.index === 'young-green-dragon').lair_actions.find(a => a.name === 'Wall of Thorns');
    expect(wall.variants ?? null).toBeNull();
    expect(/line of sight/i.test(wall.description)).toBe(true);
    expect(breathAoeShape(wall, null)).toEqual({ shape: 'Line', feet: 120, rangeGateFt: 120 });
  });

  it('guard-armed row whose prose ALSO names a real area keeps it — sanitize removes the "line of sight" phrase, not the "line of lightning" shape word', () => {
    const armed = { save_dc: 15, range: '120 feet', variants: [{ key: 'a', label: 'A', te: 'confusion' }, { key: 'b', label: 'B', conditions: ['prone'] }], description: 'A 90-foot line of lightning; the target cannot break line of sight.' };
    expect(breathAoeShape(armed, null)).toEqual({ shape: 'Line', feet: 90, rangeGateFt: 90 });
  });
});
