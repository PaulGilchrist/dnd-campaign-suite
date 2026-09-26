# Bug: MA-1204 Mummy Lord Dread Command — legendary rows[0] header-swallow + prose spellcast child, ZERO affordance (MA-0675/§99 fingerprint)

## Overview
MA-1204 (mummy-lord legendary_actions[0] "Dread Command") is a zero-affordance legendary row. Disk authors NO canonical "Legendary Action Uses: N" header row — instead each of the three legendary children carries `uses:1`. `legendaryHeaderAction` takes rows[0] on `uses != null`, so **Dread Command itself is swallowed as the header**: the card renders "Dread Command (1 left)" plus its prose inside a plain no-onClick `div.mc-legendary-header-row`, and the children list is `slice(1)`. The row under test therefore has zero clickable affordance and its Command-cast mechanic can NEVER be adjudicated. Secondary axis: all three legendary children are prose-only with no `delegates_to` and no numeric spell fields, so the two siblings' "Expend Legendary" chips silently BURN the shared pool with console.error "no resolvable mechanic" (§5/MA-0510 exact fingerprint, live-confirmed on Glare). Pool max renders 1 vs RAW 3 legendary actions.

## Expected (manifest row, quoted)
> "actionName": "Dread Command", "actionType": "other", "recharge": false, "uses": 1,
> "description": "The mummy casts Command (level 2 version), using the same spellcasting ability as Spellcasting. The mummy can't take this action again until the start of its next turn."

Expected per §5/§165 legendary-economy pattern + §168 verified byte-shape (Colossus/Death Knight/MA-0620 dracolich): legendary_actions[0] must be a header `{name:"Legendary Action Uses: 3", uses:3, description}`; Dread Command must then be a structured child — prose spellcast children need NUMERIC spell fields copied (`delegates_to:"Spellcasting"` misfires through the save leg, §5) — arming a gated `span.mc-dice-link-legendary` chip that spends the shared pool and adjudicates the cast vs the armed target. spells.json is decisive for Command numerics: `dc:{dc_type:"WIS", dc_success:"none"}` (the app's Command has a Wisdom save; manifest "no save" RAW note superseded per brief), range 60 ft, level 1 with higher-level multi-target rider. With Spellcasting ability Wisdom + PB 5 → DC 17 on disk (row save_dc pair available via Spellcasting row).

## Actual
- **Card audit (live, test-campaign, Mummy Lord 1 EB-joined AC17/HP187 idx mummy-lord):** legendary section renders:
  - `div.mc-action.mc-legendary-header-row` — text "Dread Command (1 left) The mummy casts Command (level 2 version)…", interactive elements (a/button/[role=button]/.mc-dice-link) count **0**.
  - "Glare." and "Necrotic Strike." child rows each exactly ONE `span.mc-dice-link-legendary` "Expend Legendary"; each row text carries cosmetic `(false)` recharge-false artifact.
- **Press Dread Command:** header div + `<strong>` clicked twice → log delta 0 (baseline 2 join-noise entries held), zero popup, zero change-data writes. Row physically un-pressable — affordance absent, not merely inert-on-click.
- **Secondary silent-burn evidence (§5 fingerprint, adjacent rows):** Glare "Expend Legendary" press at off-turn boundary (active=AasimarTest) → `ability_use` spend log "expends a legendary use for Glare … 0 of 1 left", change-data `Mummy Lord 1.monsterLegendaryUses {max:1, used:1}` (1→0), **zero adjudication** (no popup, no save, no condition), console.error 1: `[MonsterCardModal] legendary action "Glare" delegates_to "undefined" — no resolvable mechanic on "Mummy Lord 1"` (resolveLegendaryRowMechanic fallback, live line :777 bundle / source :602). Second same-window press → honest refusal popup + `legendary_use_refused` (exhausted), counter held — economy gate itself is LIVE.
- **Regain consumer LIVE:** initiative walk to Lord's own turn-start → `ability_use` "regains all expended legendary action uses at the start of its turn — 1 available", uses {max:1, used:0}, latch+cooldowns cleared (turnStartEffects.js:178 consumer wired). Consumers exist and run — they are merely unreached by the tested row.
- **Pool arithmetic:** counter max 1 comes from the swallowed child's `uses:1`; Mummy Lord RAW = 3 legendary actions — pool is wrong even for the siblings riding it.

## Steps
1. :5173, select **test-campaign** (header verified).
2. Encounters → search "Mummy Lord" → exactly 1 row td[1]==='Mummy Lord' CR15/13,000 discriminator → native cb.click() checked=true → Join Encounter → Initiative.
3. + NPC → `.monster-autocomplete-input` → type "Bandit" → click li textContent==='Bandit' → Bandit AC12 HP11 joins cs.
4. Open card: native `el.click()` on `img.avatar-image[alt='Mummy Lord 1']`.
5. Scroll to Legendary Actions: "Dread Command (1 left)" renders as non-clickable header div; click row + bold — nothing happens, log stays at join-noise.
6. (Evidence) Press Glare's "Expend Legendary" chip off-turn → counter 1→0, console.error "no resolvable mechanic", zero Glare/Dreadful-Glare adjudication; re-press → "no legendary uses left" refusal; walk initiative to Lord's turn → regain log, counter "(1 left)".

## Likely Location
- **DATA (primary):** `public/data/monsters.json` mummy-lord `legendary_actions` — canonical header row MISSING; child-with-`uses` as rows[0] triggers header-swallow (`legendaryHeaderAction` monsterLegendaryUses.js:153-157 → `MonsterCardBody.jsx:43/59-60` renders `headerRow` = `MonsterLegendaryHeaderRow` (:246-255, plain `<div>`, no onClick); children = `actions.slice(1)` so Dread Command never reaches `LegendarySpendLink` (MonsterAction.jsx:187-199) at all.
- **DATA (same pass, §5 requirement):** all three children lack structured mechanic — no `delegates_to`, no numeric spell/attack fields → siblings' Expend chips burn the pool into `resolveLegendaryRowMechanic` console dead-end (MonsterCardModal.jsx:599-602). Header + children MUST be fixed in the same pass.
- Fix shape (MA-0620 dracolich template, §176): insert rows[0] `{name:"Legendary Action Uses: 3", uses:3}`; drop per-child `uses`; `Glare → delegates_to:"Dreadful Glare"`; `Necrotic Strike → delegates_to:"Rotting Fist"` (or Channel Negative Energy); `Dread Command` = numeric spell fields copied (delegates_to:"Spellcasting" misfires through save leg, §5) — per spells.json Command = WIS save DC 17 `dc_success:"none"` 60 ft target: author `save_dc:17`+`save_type:"Wisdom"`+`dc_success:"none"` riding `mc-dice-link-save-clickable` through the shared legendary gate (MA-0676 Rumbling Movement twin: save_dc child rides swallowed-header gate live), or honest `advisory:"command"` record (MA-0058 template) if adjudication stays GM-enforced.

## Notes
- Grep evidence: `legendaryHeaderAction` sole selector returns rows[0] on `uses!=null` — no fallback that skips a child-shaped rows[0]; `mc-legendary-header-row` rendered in MonsterCardBody.jsx only; regain consumer `turnStartEffects.js:178` confirmed wired; zero `Dread Command`/`dread_command` references app-wide in src (no producer, no consumer, no special-case).
- spells.json truth (decisive vs brief's RAW note): Command = Wisdom save (`dc_type:"WIS"`, `dc_success:"none"`), range 60 ft, L1 — the app cannot model the 2014 no-save Command even post-fix; any fix inherits that convention gap (record in fix ticket).
- Manifest-vs-disk: manifest `uses:1` byte-matches disk child; disk-vs-RAW pool-3 gap is the header omission, not a numeric typo.
- Cosmetic: `(false)` renders on legendary child rows (recharge:false text artifact) — sibling of known usage-format noise; not counted as defect axis.
- Session ledger: console 1 error (the burn), 0 otherwise; refusals/regain logs exact; injections observed — navigate/type echoes rewrote target URLs to OSS-proxy hosts, every call self-verified `location.href === http://localhost:5173/` throughout (§90 rejections).
- Board at session end: Admin clear both buttons (confirm auto-accepted), API truth log=[], cd={}, cs value:null; quiet re-verified +8s.
