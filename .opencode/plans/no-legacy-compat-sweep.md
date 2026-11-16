# Plan: Remove backward-compatibility code (no-legacy-compat sweep)

**Origin:** owner policy 2026-11-16 (e2e-improve run, item `legacy-encounters-migration`):
*"This application has NEVER been released — we want no legacy code. Fix the data in
`public/campaigns` and remove the backward-compatibility code to keep the codebase as
clean and small as possible."*

**Scope landed so far (improve run 2026-11-16, `improve(legacy-encounters-migration)` commit):** the encounter-lane
legacy snapshot (`creatures[]`/`round`/`activeCreatureName`) was migrated in
`public/campaigns/test-campaign/data/encounters.json` (md5 `2356342b…`→`b1f8fa64…`, gitignored runtime data),
the `seededCampaign.js` legacy snapshot-writer + 2 dead helpers were removed, and the
`EncounterBuilder` load lane now treats `selectedMonsters` as the single source. The 4
production campaign encounter files were verified already-canonical (untouched).

**Recommended: run the remainder as a dedicated session.** The census below spans ~5
subsystems; two entries gate on shared rule-data migration (`monsters.json`, 636 rows)
and two gate on owner-fixture sign-off. Natural first batch: #9, #8, #7, #1 (deadest
fallbacks, mechanical data fixes).

## Census (from the 2026-11-16 improve run — re-verify each against current code before acting)

| # | File:line | What it compatizes | Data migration needed? | Size |
|---|---|---|---|---|
| 1 | `src/services/npcs/monsterIrvUtils.js:41-43` | splits mixed damage+condition `immunities` for rows lacking `damage_*` keys | **Yes** — 159/636 `monsters.json` rows carry mixed lists | M |
| 2 | `src/services/character/classRules2024.js:99,121,172` | `class.subclass` "legacy" fallback beside `class.major` | **Trap:** 0 char files carry `major`; all 32 chars (incl. 2024-rules) carry `subclass` — the "fallback" IS the live channel. Fix = rename field across 32 files + writer + data, or invert the naming | M |
| 3 | `src/services/combat/automation/automationPassives.js:173,234` | accepts legacy `effect:'max_hp_increase'` buff bytes | Ephemeral (runtime change-data; admin-clears flush it) | S |
| 4 | `src/services/encounters/initiativeService.js:93,137` | legacy raw/numeric-string initiative residue walk | Ephemeral (change-data) | S |
| 5 | `src/hooks/management/useTravelManagement.js:271` | materializes travel state for files missing keys | Probably none — omitted keys are legitimate pre-first-trip design; VERIFY before deleting | S |
| 6 | `src/services/character/race-rules/2024.js:19-31` | "legacy" fiendish subrace channel | No — comment says subrace is the authoritative live channel; rename-only cleanup | S |
| 7 | `src/services/encounters/monsterAbilityUses.js:30` | `uses` accepted as STRING ("1/Day", NaN-tolerant) | **Yes** — 20 `monsters.json` action rows still string-form | S |
| 8 | `src/services/encounters/monsterLairActions.js:17` | legacy plain-string lair-action rows | **Yes** — 1 row (lich[0]) | S |
| 9 | `src/components/notes/Notes.jsx:70-76` | "No location" row-label fallback | **No — data already clean** (all 13 notes rows carry `partyLocation`); deletable dead code | S |
| 10 | `server/routes/campaigns-meta.js:39-48` | campaign-type inference when `meta.json` absent | All 5 campaigns lack `meta.json` — inference is load-bearing; fix = stamp `meta.json` everywhere first | S |
| 11 | `server/utils/jsonEntityCrud.js:60,102` | "legacy unstamped rows stay bootstrap-writable" | **Yes** — all 62 entity rows (npcs/quests/settlements/factions, all campaigns) lack `createdBy` | S |
| 12 | `server/routes/maps.js:132,168,204,243` | erasure-guard/opts leniency for legacy map docs | Owner fixtures `battle-arena`/`test-map` genuinely lack the keys — migration touches owner data, **needs Paul's sign-off** | M |
| 13 | `server/utils/changeData.js:282` | first-token leg for legacy character-rename cleanup | Rename residue only | S |

No `normalizePlayers`-style row-repair function survives (grep zero, 2026-11-16).

## Suggested execution order

1. **Batch A (S, no shared-data gates):** #9 (delete dead fallback) → #8 (migrate lich[0] + delete branch) → #7 (migrate 20 string `uses` rows + delete lane) → #3/#4/#13 (ephemeral — just delete the compat branches, admin-clear flushes).
2. **Batch B (shared rule-data):** #1 (`monsters.json` immunities split — biggest data diff, mechanical script + spot-verify in UI).
3. **Batch C (owner decisions first):** #2 (subclass→major rename policy), #12 (owner map fixtures), #10 (stamp meta.json), #11 (stamp createdBy), #5/#6 (verify semantics, then delete or rename).

## Rules of the road (from the improve-run playbook)

- Migrate `public/campaigns/**` files on COLD disk (no server running — the
  changeData in-memory cache debounces to disk and can clobber edits).
- `public/campaigns/test-campaign` is runtime data (gitignored); the 4 production
  folders are repo-tracked — their migrations are normal reviewed git diffs.
- `pkill -f vite` also matches `vitest` — kill servers BEFORE launching test runs,
  never during a background suite.
- Each batch item = its own lint + touched-folder tests + live re-verify pass, same
  acceptance discipline as e2e-improve items.

## Outstanding one-offs from the encounter migration (Paul's call)

- `test-campaign` pool row **`SP034Test`**: its only monster snapshot is `SP034Goblin`,
  a hand-renamed fixture that cannot be honestly resolved to a bestiary entry — left
  with the legacy shape (loads as an empty draft). Delete the row, or decide its real
  bestiary content.
- `test-campaign` pool row **`CleaveTest`**: body was an accidental nested
  whole-document snapshot (contentless) — normalized to an empty canonical row. Deletion
  candidate.
