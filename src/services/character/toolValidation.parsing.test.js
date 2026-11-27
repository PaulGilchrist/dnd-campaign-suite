// @maintained-by-ai 2026-11-27 improve-and-trim: same-branch cosmetic twins collapsed (guards, prefix rejects, fall-through, type-reject, no-description, crafter 'one'-count); added whitespace-only, bare 'Choose kind of', and non-'(see' paren legs; full normalization table still pinned through parse outputs per .test.js seam.
// toolValidation PARSING lane (#2063): pure-string regex parsing of parseToolChoiceString
// ('Choose N ...' extraction + category-name normalization) and parseFeatToolProficiency
// (2024 feat benefit descriptions). ZERO mocks: neither export ever fetches — the module's
// dataLoader import is inert in this lane (verified by probe runs; family pure-lane pattern).
// SEAM MAP (siblings cited, never re-pinned here):
// - .limits.test.js (#2061) — the same disk bg/class strings flowing through fetch→limit
//   aggregation; here only the parse contracts, no fetch involved.
// - .major-feature.test.js (#2062) — 'Tool: ' prefix row extraction (applyMajorFeatureGrants)
//   is owned there, not here.
// - .services.test.js (#2064) — getToolsByCategory units (computeSkilledToolUsage lane retired with its dead export).
// - .test.js (#2065) — normalizeCategory direct-unit lane (null/''/whitespace-only);
//   here normalization is pinned only through parse outputs: every non-identity table hit
//   ('Gaming Set'→'Gaming Sets', 'Musical Instruments'→'Musical Instrument') plus the
//   unknown-category verbatim pass-through ('Gaming Tool') and the case-sensitive miss.
// Disk honesty: fixtures are verbatim public/data/2024/{backgrounds,classes,feats}.json
// (bg "Choose one kind of Gaming Set", Bard "Choose 3 Musical Instruments (see chapter 6)",
// Cleric "Choose one type of Artisan's Tools or Musical Instrument", Crafter/Musician/Skilled
// feat descs). No disk string uses digit counts or 'two/three different <non-Artisan>' forms,
// so digit-fallback and extra count rows are clearly-labeled fabricated defensive pins.
// Branch discipline: one row per distinct return/regex branch; same-branch cosmetic twins
// (e.g. two startsWith rejects, null-vs-undefined guard) are collapsed. 'one <word>' counts
// are NOT pinned for parseFeatToolProficiency: wordToNum.one===1 is indistinguishable from
// the `|| 1` fallback, so only non-1 words and the digit-fallback table carry signal.
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
    // guard branch (`!x || typeof`): one falsy string, one undefined (missing-field face),
    // one number, one object — '' is the required empty-string boundary
    [undefined], [123], [{}], [''],
    // strict-cased 'Choose' prefix branch: bare names are not choice strings (they flow
    // upstream to preSelected); lowercase and uppercase near-misses pin the case boundary
    ['Gaming Sets'], ['choose one type of Gaming Sets'], ['CHOOSE 2 Gaming Sets'],
    // whitespace-only passes the guard, trim('   ')→'' then fails the prefix test
    ['   '],
    // final fall-through branch: 'Choose 1' pins the tail requirement after \d+,
    // 'choose one X' pins that word-counts need digits (countMatch \d+ boundary)
    ['Choose 1'], ['Choose one Gaming Tools of your choice'],
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
    // kindMatch's optional 'one' group: the bare 'Choose kind of X' alternative
    ['Choose kind of Gaming Sets', { count: 1, categories: ['Gaming Sets'], isChoice: true }],
    // fabricated: 'of your choice' suffix stripped; multi-digit N pins parseInt
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
    // QUIRK (probed): the suffix strip only recognizes '(see …)' — any other
    // parenthetical fails the strip and survives verbatim inside the category
    ['Choose 2 Gaming Sets (handout)', { count: 2, categories: ['Gaming Sets (handout)'], isChoice: true }],
  ])('pins documented parsing quirks for %j', (input, expected) => {
    expect(parseToolChoiceString(input)).toEqual(expected);
  });
});

describe('toolValidation - parseFeatToolProficiency', () => {
  it.each([
    // guards: falsy feat (undefined) vs truthy-feat-missing-benefits ({});
    // { benefits: [] } passes both guards and dies at the find (next branch)
    [undefined], [{}], [{ benefits: [] }],
    // type filter: even a keyword-perfect description fails without type 'proficiency'
    [{ benefits: [{ type: 'utility', description: 'You gain proficiency with three Musical Instruments of your choice' }] }],
    // proficiency benefit with no description
    [{ benefits: [{ type: 'proficiency' }] }],
    // keyword filter: proficiency text without tool/instrument
    [{ benefits: [{ type: 'proficiency', description: 'You gain proficiency in a skill' }] }],
    // keyword passes but no numeric-quantifier pattern can extract:
    // 'these tools' lacks both a count word and 'of your choice'
    [{ benefits: [{ type: 'proficiency', description: 'You are proficient with these tools' }] }],
    // 'of your choice' present but no numWords count before the category
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
    // fabricated non-disk counts, one per extraction branch (Crafter/Skilled/generic;
    // the generic row also pins the optional 'different' leg of that regex)
    ["You gain proficiency with two different Artisan's Tools of your choice", { count: 2, categories: ["Artisan's Tools"], isAny: false }],
    ['You gain proficiency in any combination of two skills or tools of your choice', { count: 2, categories: [], isAny: true }],
    ['You gain proficiency with two different Musical Instruments of your choice', { count: 2, categories: ['Musical Instrument'], isAny: false }],
    // QUIRK (probed): generic categories pass through normalizeCategory —
    // 'Gaming Tool' is not in the table and survives verbatim
    ['You gain proficiency with one Gaming Tool of your choice', { count: 1, categories: ['Gaming Tool'], isAny: false }],
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
