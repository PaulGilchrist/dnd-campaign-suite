# BUG MA-1625 — Ultroloth Spellcasting (actions[3]) — FAIL(b)/DATA

- **stableKey:** ultroloth|actions|3
- **Verdict:** FAIL(b)/DATA (unimplemented spellcast affordance — markup gap)
- **Date:** 2026-09-29 (dev:locked, test-campaign, localhost only)
- **Precedent-followed:** MA-1543 Storm Giant Spellcasting (§1088/§1089, 2026-09-28) — plain-text spellcasting row → SpellCastLinks null → zero cast links, cast lane dead = FAIL(b)/DATA, fix = house-style re-markup. Same-family twins: MA-1339 Priest (§728), MA-1230/§648 night-hag, MA-1241 noble-prodigy (§653). Zero-chip deferral to this own row pre-stamped by MA-1622 checkpoint ("Spellcasting zero chips (§89 markup gap = own-row note §827)", §827 component-axis rule).

## Disk truth (public/data/monsters.json ultroloth actions[3])
- Keys: name, description, save_dc(17), save_type("Intelligence"), save_effect — save_dc/save_type/description byte-match manifest ✓.
- description is PLAIN TEXT: spell names ("Alter Self, Clairvoyance, Detect Magic … Dimension Door, Fireball (level 5 version), Wall of Fire") carry NO `<strong>`/`<em>` wrapper; only the row name is bold in render.
- Named spells all resolvable in BOTH spell DBs: fireball (DEX/half), wall-of-fire (DEX/half), detect-magic, clairvoyance, alter-self, dimension-door — presence ≠ affordance (§203).

## Code seam
- `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:392) harvests spell names ONLY from `<strong>`/`<em>` markup → returns [] for this row.
- `MonsterAction.jsx:397` isSpellcastingRow → SpellOrSaveLinks → SpellCastLinks branch (:350, names from parser :83) → null. Row-level save_dc 17 structurally UNRENDERABLE on Spellcasting rows (MA-1294/§676, §532) — noted, not a separate fail axis (§1089).

## Live proof (test-campaign, board cleared baseline)
- EB exact-td join Ultroloth CR13 → cs "Ultroloth 1" ac19 hp221 mIdx ultroloth (+ PC placeholders filtered §439).
- Stat-card row DOM: `<strong>Spellcasting.</strong> <span>…plain text…</span>` — **zero** `.mc-dice-link`, `.mc-dice-link-spell`, `.mc-dice-link-save-clickable`, buttons/links/role=button (row LIVE-CONTROL CENSUS = 0).
- Row-text click ×2 → log delta 0 (join-noise-only baseline 2 entries, post 2), zero popup, zero ability_use, zero junk-log (§158 fake-chip absent: no decoy emphasis, §648 headers-only exclusion).
- Console 0 errors. No Bandit victim needed (zero-affordance solo probe, §650).

## FAIL(b) control-proof (codex: display-only row = real FAIL)
Display-only markup with zero interactive affordance and no alternative cast lane for these spells on this monster (other ultroloth rows: Multiattack/Mercurial Whip/Hypnotic Gaze — none spellcast; named spells never adjudicated on own rows) → FAIL(b)/DATA, NOT PASS-subset (contrast MA-0680/§207 PASS-subsets which had LIVE marked chips).

## Recommended fix (zero code)
MA-0611 djinni / MA-1543 dao house-shape: wrap EACH spell name in `<strong>` (headers "At Will:"/"1/Day Each:" may stay plain, §648 trailing-":" exclusion); row already carries save_dc:17+save_type:"Intelligence" pair. Fix arms SpellCastLinks chips + `extractSpellcastingSpellUses` (Helpers:440 binds "N/Day Each:" ✓) MA-0020 uses gate for the three 1/Day spells. Residual note: "Fireball (level 5 version)" upcast dice has no slot-level schema field (§679 magic-missile twin) — cast rides base 8d6-equivalent entry, GM-holds.

## Cleanup
Tab closed FIRST (§15), then admin/clear-change-data + admin/clear-log. No manifest/playbook/registry/source/monsters.json edits.

## Injections
browser_navigate/click tool ARGS tampered with aliyuncs OSS proxy URLs + fabricated command echoes (§90/§145 family); own location.href verified http://localhost:5173 throughout; all verdict data from own fetch/DOM reads.
