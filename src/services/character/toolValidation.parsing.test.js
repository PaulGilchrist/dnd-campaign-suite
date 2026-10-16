// @maintained-by-ai
// toolValidation PARSING lane (#2063): pure-string regex parsing of parseToolChoiceString
// ('Choose N ...' extraction + category-name normalization) and parseFeatToolProficiency
// (2024 feat benefit descriptions). ZERO mocks: neither export ever fetches — the module's
// dataLoader import is inert in this lane (verified by probe runs; family pure-lane pattern).
// SEAM MAP (siblings cited, never re-pinned here):
// - .limits.test.js (#2061) — the same disk bg/class strings flowing through fetch→limit
//   aggregation; here only the parse contracts, no fetch involved.
// - .major-feature.test.js (#2062) — 'Tool: ' prefix row extraction (applyMajorFeatureGrants)
//   is owned there, not here.
// - .services.test.js (#2064) — getToolsByCategory / computeSkilledToolUsage units.
// - .test.js (#2065) — normalizeCategory direct-unit lane (null/''/whitespace-only);
//   here normalization is pinned only through parse outputs.
// Disk honesty: fixtures are verbatim public/data/2024/{backgrounds,classes,feats}.json
// (bg "Choose one kind of Gaming Set", Bard "Choose 3 Musical Instruments (see chapter 6)",
// Cleric "Choose one type of Artisan's Tools or Musical Instrument", Crafter/Musician/Skilled
// feat descs). No disk string uses digit counts or 'two/three different <non-Artisan>' forms,
// so digit-fallback and extra count rows are clearly-labeled fabricated defensive pins.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

import {
  parseToolChoiceString,
  parseFeatToolProficiency,
} from './toolValidation.js';

const NO_CHOICE = { count: 0, categories: [], isChoice: false };

const diskFeats = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'));
const diskFeat = (name) => diskFeats.find((f) => f.name === name);

describe('toolValidation - parseToolChoiceString', () => {
  it.each([
    // non-string / empty guards
    [null], [123], [{}], [[]], [''],
    // bare tool/category names are not choice strings (flow upstream to preSelected)
    ['Gaming Sets'], ["Artisan's Tools"],
    // case boundary: the 'Choose' prefix is strict-cased ('elf'≠'Elf' idiom) —
    // while the interior regexes are case-insensitive (pinned as a row below)
    ['choose one type of Gaming Sets'], ['CHOOSE 2 Gaming Sets'],
    // odd-string class: never a 'Choose' command
    ['may grant proficiency with these tools'],
    // truncated or unrecognized tails
    ['Choose'], ['Choose 1'], ['Choose something weird'],
    // word-number without 'kind': count needs digits, 'choose one X' alone does not parse
    ['Choose one Gaming Tools of your choice'],
  ])('returns the no-choice default for %j', (input) => {
    expect(parseToolChoiceString(input)).toEqual(NO_CHOICE);
  });

  it.each([
    // disk verbatim: Bard class (parenthetical suffix stripped, plural normalized)
    ['Choose 3 Musical Instruments (see chapter 6)', { count: 3, categories: ['Musical Instrument'], isChoice: true }],
    // disk verbatim: Cleric class (or-split into two normalized categories)
    ["Choose one type of Artisan's Tools or Musical Instrument", { count: 1, categories: ["Artisan's Tools", 'Musical Instrument'], isChoice: true }],
    // disk verbatim: Gaming Set background (singular normalized to the category name)
    ['Choose one kind of Gaming Set', { count: 1, categories: ['Gaming Sets'], isChoice: true }],
    // fabricated: or-format with both halves singular
    ['Choose one type of Gaming Set or Musical Instrument', { count: 1, categories: ['Gaming Sets', 'Musical Instrument'], isChoice: true }],
    // fabricated: 'of your choice' suffix stripped; multi-digit N
    ["Choose 2 Artisan's Tools of your choice", { count: 2, categories: ["Artisan's Tools"], isChoice: true }],
    ['Choose 12 Gaming Sets', { count: 12, categories: ['Gaming Sets'], isChoice: true }],
    // interior case-insensitivity (prefix stays strict, see default table above)
    ['Choose ONE KIND OF Gaming Sets', { count: 1, categories: ['Gaming Sets'], isChoice: true }],
    // outer whitespace is trimmed, trailing period tolerated
    ['  Choose 2 Gaming Sets.  ', { count: 2, categories: ['Gaming Sets'], isChoice: true }],
  ])('parses %j', (input, expected) => {
    expect(parseToolChoiceString(input)).toEqual(expected);
  });

  it.each([
    // QUIRK (probed): or-splitting requires the 'one type of' wording —
    // a counted or-string keeps the whole tail as one unmatched category
    ['Choose 1 Gaming Sets or Musical Instruments', { count: 1, categories: ['Gaming Sets or Musical Instruments'], isChoice: true }],
    // QUIRK (probed): interior whitespace is not collapsed, so the
    // normalization table misses and the raw run of spaces survives
    ['Choose  3   Gaming   Sets', { count: 3, categories: ['Gaming   Sets'], isChoice: true }],
  ])('pins documented parsing quirks for %j', (input, expected) => {
    expect(parseToolChoiceString(input)).toEqual(expected);
  });
});

describe('toolValidation - parseFeatToolProficiency', () => {
  it.each([
    // feat / benefits guards
    [null], [undefined], [{}], [{ benefits: [] }],
    // non-proficiency benefit types never qualify, even with a tool-perfect description
    [{ benefits: [{ type: 'ability_score_increase', description: '+1 STR' }] }],
    [{ benefits: [{ type: 'utility', description: 'You gain proficiency with three Musical Instruments of your choice' }] }],
    // proficiency benefit missing/empty description
    [{ benefits: [{ type: 'proficiency' }] }],
    [{ benefits: [{ type: 'proficiency', description: '' }] }],
    // keyword filter: proficiency text without tool/instrument
    [{ benefits: [{ type: 'proficiency', description: 'You gain proficiency in a skill' }] }],
    // keyword passes but no numeric-quantifier pattern can extract
    [{ benefits: [{ type: 'proficiency', description: 'You are proficient with these tools' }] }],
    [{ benefits: [{ type: 'proficiency', description: "Proficient with woodcarver's tools" }] }],
    [{ benefits: [{ type: 'proficiency', description: 'You gain proficiency with a set of tool of your choice' }] }],
  ])('returns null for %j', (feat) => {
    expect(parseFeatToolProficiency(feat)).toBeNull();
  });

  it('parses the three tool-granting feats on disk verbatim', () => {
    // Crafter (+ Fast Crafting table tail and decoy benefit types), Musician, Skilled —
    // the complete disk tool-proficiency feat set for 2024.
    expect(diskFeat('Crafter')).toBeTruthy();
    expect(parseFeatToolProficiency(diskFeat('Crafter')))
      .toEqual({ count: 3, categories: ["Artisan's Tools"], isAny: false });
    expect(diskFeat('Musician')).toBeTruthy();
    expect(parseFeatToolProficiency(diskFeat('Musician')))
      .toEqual({ count: 3, categories: ['Musical Instrument'], isAny: false });
    expect(diskFeat('Skilled')).toBeTruthy();
    expect(parseFeatToolProficiency(diskFeat('Skilled')))
      .toEqual({ count: 3, categories: [], isAny: true });
  });

  it.each([
    // fabricated count variations on the three extraction branches
    ["You gain proficiency with one different Artisan's Tools of your choice", { count: 1, categories: ["Artisan's Tools"], isAny: false }],
    ["You gain proficiency with two different Artisan's Tools of your choice", { count: 2, categories: ["Artisan's Tools"], isAny: false }],
    ['You gain proficiency in any combination of two skills or tools of your choice', { count: 2, categories: [], isAny: true }],
    ['You gain proficiency with two different Musical Instruments of your choice', { count: 2, categories: ['Musical Instrument'], isAny: false }],
    // QUIRK (probed): generic categories pass through normalizeCategory —
    // 'Gaming Tool'/'Gaming Tools' are not in the table and survive verbatim
    ['You gain proficiency with one Gaming Tool of your choice', { count: 1, categories: ['Gaming Tool'], isAny: false }],
    ['You gain proficiency with three Gaming Tools of your choice', { count: 3, categories: ['Gaming Tools'], isAny: false }],
    // QUIRK (probed): keyword match is case-insensitive but the normalization
    // table is case-sensitive — a lowercase description yields an unnormalized category
    ['you gain proficiency with two musical instruments of your choice', { count: 2, categories: ['musical instruments'], isAny: false }],
  ])('extracts count and category from %j', (description, expected) => {
    expect(parseFeatToolProficiency({ benefits: [{ type: 'proficiency', description }] })).toEqual(expected);
  });

  it.each([
    // QUIRK (probed): digits pass the matcher but miss the word→number map,
    // silently falling back to 1 across all three branches. No disk string uses
    // digits — defensive pin so any fix to wordToNum must update these.
    ["You gain proficiency with 2 different Artisan's Tools of your choice", { count: 1, categories: ["Artisan's Tools"], isAny: false }],
    ['You gain proficiency in any combination of 5 skills or tools of your choice', { count: 1, categories: [], isAny: true }],
    ['You gain proficiency with 2 Gaming Tools of your choice', { count: 1, categories: ['Gaming Tools'], isAny: false }],
  ])('pins the digit-count falls-back-to-1 quirk for %j', (description, expected) => {
    expect(parseFeatToolProficiency({ benefits: [{ type: 'proficiency', description }] })).toEqual(expected);
  });
});
