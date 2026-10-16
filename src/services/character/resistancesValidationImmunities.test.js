// @maintained-by-ai
// QUARTET lane (see resistancesValidation.test.js header seam map): class-side immunity
// extraction + level gates — extractClassImmunities via getResistanceLimits.
// Disk anchors, verified against public/data/classes.json + public/data/2024/classes.json:
// ZERO real class features on disk grant a valid damage immunity. The only "Immunity to"
// prose is condition immunity or flavor: 5e Monk Ki Empowered Strikes lv6 ("…immunity to
// nonmagical attacks and damage." — the case-insensitive regex matches, valid-type filter
// must reject "nonmagical"); 2024 Paladin Oath of Devotion Aura of Devotion lv7 ("Immunity
// to Charmed condition…"). All POSITIVE-immunity fixtures below are therefore synthetic.
// Divergence note: engine immunity thresholds elsewhere in the app (Monk>9/Paladin>2) are
// a different lane — this validation lane's gates are plain feature.level <= level.
// Dead code flag (#1916): the named "Mindless Rage" branch in extractClassImmunities is an
// empty no-op block — untestable by behavior; candidates for deletion in the source.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import { getResistanceLimits } from './resistancesValidation.js';

// ── Fixtures / helpers ───────────────────────────────────────────────────────

const emptyRaceData = () => ({ name: 'Human', traits: [] });

const baseArgs = (overrides = {}) => ({
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Fighter' },
  level: 1,
  ...overrides,
});

function mockClassData(classData) {
  vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(emptyRaceData());
  vi.mocked(dataLoader.fetchClassData).mockResolvedValue(classData);
}

// Synthetic base class_levels with one damage-immunity feature at featureLevel.
const baseClassAt = (featureLevel, description) => ({
  class_levels: [
    { level: 1, features: [] },
    { level: featureLevel, features: [{ name: 'Damage Immunity', description }] },
  ],
});

// Subclass-container fixture: correct container for the ruleset plus, when decoy is set,
// the WRONG ruleset's container carrying a DIFFERENT damage type (Cold) so that reading
// the wrong container is observable, not masked by matching types.
const subclassFixture = ({ rules, featureLevel, description, decoy }) => ({
  class_levels: [{ level: 1, features: [] }],
  ...(rules === '5e'
    ? {
        subclasses: [
          {
            name: 'Test Subclass',
            class_levels: [
              { level: featureLevel, features: [{ name: 'Subclass Feature', description }] },
            ],
          },
        ],
        ...(decoy
          ? {
              majors: [
                { name: 'Decoy Major', features: [{ level: 1, name: 'Decoy Feature', description: 'You gain Immunity to Cold damage.' }] },
              ],
            }
          : {}),
      }
    : {
        majors: [
          { name: 'Path of the Test', features: [{ level: featureLevel, name: 'Major Feature', description }] },
        ],
        ...(decoy
          ? {
              subclasses: [
                { name: 'Decoy Subclass', class_levels: [{ level: 1, features: [{ name: 'Decoy Feature', description: 'You gain Immunity to Cold damage.' }] }] },
              ],
            }
          : {}),
      }),
});

// Race fixture is traitless: the race side (Limits lane) must contribute nothing here.
function expectImmunityLimits(result, expected) {
  expect(result.resistances).toEqual([]);
  expect(result.immunities.sort()).toEqual([...expected].sort());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resistancesValidation getResistanceLimits - class immunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'includes feature exactly at character level (boundary)',
      level: 10,
      classData: baseClassAt(10, 'You gain Immunity to Fire damage.'),
      expected: ['Fire'],
    },
    {
      name: 'excludes feature one level above character level (boundary)',
      level: 9,
      classData: baseClassAt(10, 'You gain Immunity to Fire damage.'),
      expected: [],
    },
    {
      name: 'extracts multiple damage immunities from one feature',
      level: 1,
      classData: baseClassAt(1, 'You gain Immunity to Fire damage and Immunity to Cold damage.'),
      expected: ['Fire', 'Cold'],
    },
    {
      name: 'keeps valid damage types, drops condition names in same description',
      level: 1,
      classData: baseClassAt(1, 'You gain Immunity to Charmed and Immunity to Fire.'),
      expected: ['Fire'],
    },
    {
      name: 'condition-only immunity yields nothing',
      level: 1,
      classData: baseClassAt(1, 'You gain Immunity to Charmed and Frightened.'),
      expected: [],
    },
    {
      name: 'array descriptions are joined before matching',
      level: 1,
      classData: baseClassAt(1, ['You gain', 'Immunity to', 'Radiant damage.']),
      expected: ['Radiant'],
    },
    {
      name: 'disk anchor: real 5e Monk Ki Empowered Strikes lv6 prose grants nothing',
      level: 6,
      classData: baseClassAt(6, 'Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.'),
      expected: [],
    },
  ])('base class_levels: $name', async ({ level, classData, expected }) => {
    mockClassData(classData);

    const result = await getResistanceLimits(baseArgs({ level }));

    expectImmunityLimits(result, expected);
  });

  it.each([
    {
      name: '5e extracts subclasses feature at gate and ignores majors decoy',
      rules: '5e',
      fixture: { rules: '5e', featureLevel: 7, description: 'You gain Immunity to Lightning damage.', decoy: true },
      level: 7,
      expected: ['Lightning'],
    },
    {
      name: '5e excludes subclasses feature above character level',
      rules: '5e',
      fixture: { rules: '5e', featureLevel: 14, description: 'You gain Immunity to Fire damage.', decoy: false },
      level: 7,
      expected: [],
    },
    {
      name: '2024 extracts majors feature at gate and ignores subclasses decoy',
      rules: '2024',
      fixture: { rules: '2024', featureLevel: 3, description: 'You gain Immunity to Fire damage.', decoy: true },
      level: 3,
      expected: ['Fire'],
    },
    {
      name: '2024 excludes majors feature above character level',
      rules: '2024',
      fixture: { rules: '2024', featureLevel: 10, description: 'You gain Immunity to Fire damage.', decoy: false },
      level: 3,
      expected: [],
    },
    {
      name: 'disk anchor: real 2024 Aura of Devotion lv7 condition immunity grants nothing',
      rules: '2024',
      fixture: { rules: '2024', featureLevel: 7, description: 'You and your allies have Immunity to Charmed condition while in Aura of Protection.', decoy: false },
      level: 7,
      expected: [],
    },
  ])('subclass containers ($rules): $name', async ({ rules, fixture, level, expected }) => {
    mockClassData(subclassFixture(fixture));

    const result = await getResistanceLimits(baseArgs({ rules, level }));

    expectImmunityLimits(result, expected);
    // Ruleset routing into dataLoader (observable through the discriminating mock args).
    expect(dataLoader.fetchClassData).toHaveBeenCalledWith('Fighter', rules);
  });

  it.each([
    { name: 'null classData (unresolved fetch)', classData: undefined },
    { name: 'classData without class_levels', classData: { name: 'WeirdClass' } },
    { name: 'empty class_levels', classData: { class_levels: [] } },
    { name: 'level entry without features key', classData: { class_levels: [{ level: 1 }] } },
  ])('tolerates missing class data: $name', async ({ classData }) => {
    mockClassData(classData);

    const result = await getResistanceLimits(baseArgs());

    expectImmunityLimits(result, []);
  });
});
