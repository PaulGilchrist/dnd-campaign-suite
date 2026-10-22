// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  #1471 + fix#107 TWIN CLOSE-OUT — modalSpells.js handleSilence    */
/*  (POST-FIX :247-:316; pre-fix :231-:268) SIZE/RANGE PARSING,      */
/*  REAL unit, injected fake                                           */
/*                                                                     */
/*  Boundary: noformula-modals owns the silenceTargetSelection hub   */
/*  PAYLOAD bytes (its :428 disk-coincident-constants row) and        */
/*  silenceService.test.js owns the #1413 zone lane. THIS face is    */
/*  modalSpells' OWN range/aoe parsing in isolation — the fix#107    */
/*  residual twin (ledger :1199: 'modalSpells.js:234-239 handleSilence*/
/*  — same numeric-size-crash + plural-120 old-regex pair as fixed    */
/*  #1413(a/b); twin fix at its lane turn').                         */
/*                                                                     */
/*  LAW (fix#107, mirrored bytes in modalSpells.js — silenceService's*/
/*  FEET_TOKEN_RE/MILE_TOKEN_RE/RADIUS_TOKEN_RE helpers are           */
/*  module-private there, not importable): numeric-first size (5e     */
/*  disk: area_of_effect.size is NUMBER on ALL 89 aoe rows — the old */
/*  aoeSize.match(/(\d+)-foot-radius/) threw TypeError on it), plural */
/*  feet/miles token set (old /(\d+)-?foot/ matched ZERO plural       */
/*  forms), LOUD-refuse garbage to the documented Silence RAW         */
/*  defaults 120ft range / 20ft sphere (no-fallbacks law — the gate   */
/*  is name === 'silence', so any unmatched token here is             */
/*  out-of-contract input and must be heard, not swallowed).         */
/*                                                                     */
/*  FIXTURES: REAL disk rows pulled live (preflight catch): 5e        */
/*  spells.json Silence range '120 feet' + size NUMBER 20; 2024      */
/*  spells.json Silence size STRING '20-foot-radius'. Off-disk        */
/*  tokens ('60 feet', 'Self', size 0/'10-foot Emanation'/junk) are  */
/*  DOCUMENTED SYNTHETIC contract probes — the ledger itself cites    */
/*  plural-120 and numeric-size as the crash class; honest strings.  */
/*                                                                     */
/*  NAMELESS-ENVELOPE SYMMETRY (#1471 guard-first law): handleSilence*/
/*  :232 carries the `spell.name &&` guard; the row pins it declines  */
/*  {} with NO throw — the same law that mends the heal gate :10.    */
/*                                                                     */
/*  MOCK ROSTER vs REAL import list (#1440): modalSpells.js imports  */
/*  exactly {handle} from shapechangeHandler (:1) and {getCombatContext*/
/*  } from damageUtils (:2) — both mocked direct-path (#1475/76);     */
/*  neither is used by this arm (censused times(0)); the unit under   */
/*  test stays REAL. Campaign locked 'test-campaign'. NO-CLOCK:       */
/*  parsing is instantaneous; no timers, no state.                    */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../../../../public/data/spells.json';
import spells2024 from '../../../../../../public/data/2024/spells.json';

vi.mock('../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
  handle: vi.fn(),
}));
vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handleSilence } from './modalSpells.js';
import { handle as shapechangeStub } from '../../../../automation/handlers/spells/shapechangeHandler.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';

/* Preflight: REAL disk bytes or the lane refuses to run. */
const disk5e = spells5e.find(s => s.name === 'Silence');
const disk2024 = spells2024.find(s => s.name === 'Silence');
if (!disk5e || !disk2024) throw new Error('Silence disk row missing — fixtures must be REAL rows');
if (!(typeof disk5e.area_of_effect?.size === 'number')) throw new Error('5e Silence size no longer numeric — crash-class premise drifted');
if (typeof disk2024.area_of_effect?.size !== 'string') throw new Error('2024 Silence size no longer a string — parity premise drifted');

const COMBAT_SUMMARY = { players: [{ name: 'TestWizard' }], creatures: [{ name: 'Goblin1' }] };
const getCombatSummary = vi.fn(() => COMBAT_SUMMARY);

function run(spell, errorCount) {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    return handleSilence({
      spell,
      metaCtx: {},
      playerStats: { name: 'TestWizard' },
      campaignName: CAMPAIGN,
      getCombatSummary,
    }).result.automationPopup.payload.action;
  } finally {
    expect(errorSpy).toHaveBeenCalledTimes(errorCount);
    errorSpy.mockRestore();
  }
}

describe('handleSilence size/range parsing (#107 twin, modalSpells.js:279-316)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(COMBAT_SUMMARY);
  });

  it('parses the REAL 5e disk shape honestly: numeric area_of_effect.size survives (old .match TypeError killed) and plural-feet range parses', () => {
    const action = run({ name: 'Silence', range: disk5e.range, area_of_effect: disk5e.area_of_effect }, 0);
    expect(action).toEqual({ name: 'Silence', automation: { type: 'silence', aoeRadius: 20, range: 120 } });
  });

  it('parses the REAL 2024 disk string size and plural-feet range with zero loud noise', () => {
    const action = run({ name: 'Silence', range: disk2024.range, area_of_effect: disk2024.area_of_effect }, 0);
    expect(action).toEqual({ name: 'Silence', automation: { type: 'silence', aoeRadius: 20, range: 120 } });
  });

  it.each([
    /* #1348 arms — same-name inputs, differing honest outputs. */
    { label: 'plural feet off-disk range parses its own number (old digit-hyphen-foot regex matched ZERO plurals -> silent 120 drop)', spell: { name: 'Silence', range: '60 feet' }, range: 60, aoeRadius: 20, errors: 0 },
    { label: 'abbrev ft range parses', spell: { name: 'Silence', range: '60 ft' }, range: 60, aoeRadius: 20, errors: 0 },
    { label: 'mile range converts honestly (5 miles -> 26400 ft)', spell: { name: 'Silence', range: '5 miles' }, range: 26400, aoeRadius: 20, errors: 0 },
    { label: 'numeric size of another value passes through untouched (no 20-flatten)', spell: { name: 'Silence', range: '120 feet', area_of_effect: { type: 'sphere', size: 60 } }, range: 120, aoeRadius: 60, errors: 0 },
    { label: '2024-style spaced string size parses', spell: { name: 'Silence', area_of_effect: { size: '10-foot Emanation' } }, range: 120, aoeRadius: 10, errors: 0 },
    { label: 'loud-refuse garbage range -> documented 120ft default, error HEARD once', spell: { name: 'Silence', range: 'Self' }, range: 120, aoeRadius: 20, errors: 1 },
    { label: 'loud-refuse non-positive numeric size -> documented 20ft sphere default, error HEARD once', spell: { name: 'Silence', area_of_effect: { size: 0 } }, range: 120, aoeRadius: 20, errors: 1 },
    { label: 'loud-refuse garbage string size -> 20ft sphere default, error HEARD once', spell: { name: 'Silence', area_of_effect: { size: 'huge' } }, range: 120, aoeRadius: 20, errors: 1 },
    { label: 'missing range + missing aoe fall SILENTLY to the documented RAW defaults (null arms precede the loud arms)', spell: { name: 'Silence' }, range: 120, aoeRadius: 20, errors: 0 },
  ])('$label', ({ spell, range, aoeRadius, errors }) => {
    const action = run(spell, errors);
    expect(action).toEqual({ name: 'Silence', automation: { type: 'silence', aoeRadius, range } });
    expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
    expect(getCombatContext).toHaveBeenCalledTimes(0);
    expect(shapechangeStub).toHaveBeenCalledTimes(0);
  });

  it('#1471 guard-first symmetry: a nameless envelope declines { handled: false } with NO throw and zero side effects', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = handleSilence({ spell: {}, metaCtx: {}, playerStats: { name: 'TestWizard' }, campaignName: CAMPAIGN, getCombatSummary });
    expect(result).toEqual({ handled: false });
    expect(getCombatSummary).toHaveBeenCalledTimes(0);
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });
});
