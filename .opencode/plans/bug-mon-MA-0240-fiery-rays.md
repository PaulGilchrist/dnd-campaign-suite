# BUG MA-0240 — Ancient Red Dragon legendary "Fiery Rays": inert cast-prose row

**Verdict: FAIL** (MA-0163/MA-0219/MA-0239 inert-legendary-prose family; header gate MA-0217/0238)

## Row
- MA-0240 · Ancient Red Dragon (`ancient-red-dragon`) · "Fiery Rays" · category `legendary_actions` · actionType `other`

## Evidence (live 2026-09-15, test-campaign)
- **Static (STEP 1):** `public/data/monsters.json` `legendary_actions[2]` keys = `[name, description]` only — NO `delegates_to`, `uses`, `attack_bonus`, `save_dc`, `dice`, or `automation`. Header `legendary_actions[0]` carries no numeric `uses`. Grep: `delegates_to` consumers exist only in `monsterLegendaryUses.js` + `MonsterCardModal.jsx`; NO parser resolves "uses Spellcasting to cast Scorching Ray" prose (MA-0163 family).
- **UI (STEP 2/3):** EB tick "Ancient Red Dragon" → Join Encounter → `Ancient Red Dragon 1` init 15, HP 507/507; target ElderPaladin armed (targetName curl-verified). Card `.mc-overlay`: Fiery Rays row outerHTML = plain `<div class="mc-action "><strong>Fiery Rays.</strong> <span>The dragon uses Spellcasting to cast <em>Scorching Ray</em> (level 3 version)…</span></div>` — **0 `.mc-dice-link`, 0 buttons/[role=button]**; `.mc-legendary-counter` count = 0 (MA-0219 vanished-affordance shape).
- **Click probe:** row + inner span `el.click()` → ZERO delta: log stayed 2→2, no overlay/popup, no `lastAttack`, no `pendingSavePrompts`, `monsterLegendaryUses` key never created.
- **CONTROL (same card, different row):** non-legendary Spellcasting row chip "Scorching Ray" is LIVE — rolled d20 10 +15 = **HIT 25 vs AC 19**; Done applied: log 2→6 (`ability_use` + `roll attack` + `roll damage` + `hp_change −3 ElderPaladin`), `lastAttack={attackName:"Scorching Ray", attacker:"Ancient Red Dragon 1", total:25, hit:true}`. Proves the inertness is row-specific, not card/session dead.

## Root cause
DATA authoring: cast-prose legendary child with no machine fields, plus header missing numeric `uses` → `legendaryHeaderAction()` (monsterLegendaryUses.js:153) null → `LegendarySpendLink` (MonsterAction.jsx:148) null → plain inert `<div class="mc-action">` branch (MonsterCardBody.jsx:54). Expend/regain consumers exist but are unreached.

## Fix shape
Header `legendary_actions[0]` `uses: 3` (counter + per-turn latch + turn-start regain auto-wire, MA-0070/0184/0215 precedent) AND child row `delegates_to: "Spellcasting"` cast branch (resolves via existing MonsterCardModal delegates path) — mirroring the cast target "Scorching Ray (level 3 version)" so the legendary row ITSELF rolls the ray. Beware MA-0164: once header `uses` lands, prose-only children burn uses with no mechanic — children need `delegates_to`/inline metadata in the same fix.

## Cleanup
Admin Clear Change Data + Clear Campaign Log (native confirms accepted) → verified `log []`, `change-data {}`. Card `.mc-close` + result popups flushed; no overlays/dialogs lingering.
