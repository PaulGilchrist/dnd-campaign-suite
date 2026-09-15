# BUG MA-0186 — Ancient Brass Dragon Pounce legendary: inert prose, no move+attack producer (FAIL)

**Row:** MA-0186 `ancient-brass-dragon|legendary_actions|2` — "Pounce" (legendary_actions, other)
**Expected (verbatim):** "The dragon moves up to half its Speed, and it makes one Rend attack."
**Verdict:** FAIL flavor (b) — MA-0164/MA-0175/MA-0092 inert-dict fingerprint; zero-delta live confirmed.

## Expected vs Actual
- Expected: legendary row spends 1 use, moves up to half Speed (60 ft), rolls ONE Rend (authored "+14" 2d10+8 Slashing + 2d6 Fire — live control proves component authored + engine alive).
- Actual: row renders plain inert `<div class="mc-action"><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — zero links, zero affordances. Forced `el.click()` ×2 + trusted Playwright click → **zero delta**: no popup, no roll, no pounce log, `lastAttack` untouched by Pounce, no legendary spend.

## Root cause (DATA)
1. **Dict data-shape:** `monsters.json` `ancient-brass-dragon.legendary_actions[2]` authors `{name, description}` ONLY — no `delegates_to`/`attack_bonus`/`dice`/`advisory`/`save_dc`. Legendary rendering gates on numeric mechanic (MonsterCardModal.jsx:291) → `delegates_to` (:263) → advisory (:252); name+description matches none → inert `.mc-action` (MonsterCardBody.jsx:29; MA-0164 fingerprint held for this exact row minutes ago at MA-0184 static read).
2. **No economy:** header row [0] lacks `uses` → `legendaryHeaderAction()` null (monsterLegendaryUses.js:156) → no counter, no spend, no exhaustion refusal (MA-0184 live-confirmed on this monster).
3. **No move+attack legendary branch:** grep -rni "pounce" src/ (non-test) = **0 matches** — composite "move half + one attack" has zero producers (§7 movement; MA-0164 fingerprint re-confirmed unchanged).

## Live evidence (test-campaign, 2026-09-15, :5173)
- EB Join exact "Ancient Brass Dragon 1" → cs idx 0, maxHp 332, ac 20 (MV-18 verified; registry line matches). Target armed AasimarTest via initiative `target-select` (creature[0].targetName=AasimarTest).
- Baseline log count 2 (join noise), change-data dragon key absent.
- Card open: Pounce row = `div.mc-action`, **0 links**; overlay-wide **0** `.mc-legendary-counter`/`.mc-legendary-header-row`/`.mc-dice-link-legendary`.
- Forced `el.click()` ×2 + trusted click on Pounce row: log count unchanged (2→2 in window), zero pounce/roll entries, no popups, no change-data deltas, hp 332.
- **Control:** Rend `.mc-dice-link "+14"` click → popup "✓ HIT (21 vs AC 12)" + NEW log lines: attack roll ts 1789452326644, damage ts 1789452334515 `2d10+8`=22 Slashing + 2d6=3 Fire, hp_change delta −25 (143→118), `lastAttack` written (attacker Ancient Brass Dragon 1, hit, target AasimarTest). Engine alive; Pounce absence is data-gated.
- Evidence: `/tmp/ma0186-cd-before.json`, `/tmp/ma0186-log-before.json`, `/tmp/ma0186-cd-mid.json`, `/tmp/ma0186-log-mid.json`, `/tmp/ma0186-cd-after.json`, `/tmp/ma0186-log-after.json` (stamped 2026-09-15T06:05:46Z). Note: one stray Perception skill roll (ts 1789452304663) from first "+14" locator hit on the skill row — self-issued misclick, removed at cleanup; not pounce-related.

## Fix recipe (MA-0070 data pattern, Adult Brass)
- Header row [0]: add `uses: 3` (+ advisory "4 in lair" tail) → counter/gate/spend/refusal engage with no engine change.
- Pounce row: add `delegates_to: "Rend"` (+ attack_bonus/dice mirroring the live Rend component) → delegated attack roll routes through `handleLegendaryRow` spend gate. Move-half leg remains advisory (no move producer app-wide, §7 — same residual as MA-0164/MA-0175).

## Security
All actions self-issued at localhost:5173; every tool code-echo wrapper URL matched the requested localhost URL; no off-host navigation; no injected "resume"/instruction wrappers obeyed.
