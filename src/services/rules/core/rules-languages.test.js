// @maintained-by-ai
// Lane: rules-languages.js channel dispatch (2024 class.major vs 5e class.subclass) and
// disk-backed canonical language assembly through the rules.js facade.
// Owned elsewhere — NOT re-executed here:
//   - throw guards (race/class/subrace languages "not an array"): rules.helpers.test.js:291-317
//   - 5e assembly math (counts, dedup, background +2, subrace, ranger level bonuses):
//     rules.test.js:510-598 and rules.helpers.test.js:320-332
//   - facade passthrough identity (rules.getLanguages === getLanguages): rules-core.test.js:73
// No vi.mock: getLanguages is pure computation; the old dataLoader mock targeted a path
// outside rules.js's import graph (src/services/rules/ui/ does not exist — the real
// collaborator is src/services/ui/dataLoader.js) and stubbed nothing that runs here.
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';
import races5e from '../../../../public/data/races.json';
import races2024 from '../../../../public/data/2024/races.json';
import classes5e from '../../../../public/data/classes.json';

const findRace = (races, name) => races.find((r) => r.name === name);
const findClass = (classes, name) => classes.find((c) => c.name === name);

describe('rules.getLanguages ruleset channel dispatch', () => {
  it('2024 mode counts class.major.language_choices only — subclass channel ignored, major optional', () => {
    const race = findRace(races2024, 'Dwarf');
    expect(race.languages).toEqual(['Common', 'Dwarvish']);

    // Both channels present: only major's choose counts (2 + 2 background + 3).
    const [allowed, languages] = rules.getLanguages({
      rules: '2024',
      race,
      class: {
        languages: [],
        major: { language_choices: { choose: 3 } },
        subclass: { language_choices: { choose: 5 } },
      },
      languages: [],
    }, {});
    expect(languages).toEqual(['Common', 'Dwarvish']);
    expect(allowed).toBe(7);

    // Major removed: subclass choose (5) still must not leak; missing major is tolerated.
    const [allowedNoMajor] = rules.getLanguages({
      rules: '2024',
      race,
      class: { languages: [], subclass: { language_choices: { choose: 5 } } },
      languages: [],
    }, {});
    expect(allowedNoMajor).toBe(4);
  });

  it('5e mode counts class.subclass.language_choices and ignores the 2024 major channel', () => {
    const [allowed] = rules.getLanguages({
      race: { languages: ['Common'] },
      class: {
        languages: [],
        subclass: { language_choices: { choose: 2 } },
        major: { language_choices: { choose: 9 } },
      },
      languages: [],
    }, {});
    // 1 (race) + 2 (background) + 2 (subclass); major decoy must not leak.
    expect(allowed).toBe(5);
  });
});

describe('rules.getLanguages disk-backed canon (5e)', () => {
  it('assembles exact languages for a High Elf Druid from races.json + classes.json', () => {
    const elf = findRace(races5e, 'Elf');
    const highElf = elf.subraces.find((s) => s.name === 'High Elf');
    const druid = findClass(classes5e, 'Druid');

    const [allowed, languages] = rules.getLanguages({
      rules: '5e',
      race: { ...elf, subrace: highElf },
      class: { ...druid, major: { language_choices: { choose: 9 } } },
      languages: ['Infernal'],
    }, {});

    // Race [Common, Elvish] + subrace [] + class [Druidic] + player-chosen [Infernal].
    expect(languages).toEqual(['Common', 'Druidic', 'Elvish', 'Infernal']);
    // 2 (race) + 2 (background) + 1 (High Elf language_options) + 0 (Druid, no 5e subclass picks).
    expect(allowed).toBe(5);
  });
});
