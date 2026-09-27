# Bug MA-1419 — Sahuagin Priest "Spellcasting" (actions[2]) — FAIL(b)/DATA

**Verdict: FAIL(b)/DATA** — plain-text spell names render ZERO cast affordances (MA-1327/MA-1339/MA-1375 twin fingerprint, §MA-1339 playbook).

## Row (disk, public/data/monsters.json sahuagin-priest actions[2])
- name Spellcasting, attack_bonus 0, save_dc 12, save_type Wisdom, save_effect "" (manifest VERBATIM match)
- description VERBATIM:
  `The sahuagin casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12):<br><strong>At Will:</strong> Thaumaturgy<br><strong>2/Day Each:</strong> Hold Person, Tongues`
- Spell names Thaumaturgy / Hold Person / Tongues = **PLAIN TEXT**; sole emphasis = tier headers `<strong>At Will:</strong>` + `<strong>2/Day Each:</strong>` (both end ':' → extractor skips). No mid-prose decoy emphasis → pure MA-1327 zero-chip shape, NOT the MA-0599 fake-chip shape.

## Byte-shape comparison
- **PASS twin djinni MA-0611** (disk, actions Spellcasting): EVERY spell name individually `<strong>`-wrapped (`<strong>Detect Evil and Good</strong>, <strong>Detect Magic</strong>…`) + row-level `save_dc:17`+`save_type:"Charisma"`. Extraction replica yields 10 chip names + 2/Day uses map {Create Food and Water:2, Tongues:2, Wind Walk:2}.
- **FAIL twin questing-knight MA-1375** (disk actions[3]): IDENTICAL family shape to sahuagin-priest — tier header `<strong>1/Day Each:</strong>` sole markup, names plain, `attack_bonus:0`, row save_dc/save_type pair authored.
- Sahuagin-priest differs from djinni on exactly one axis: names unmarked. The row already carries the numeric `save_dc:12`+`save_type:"Wisdom"` pair (§89/§167 gate satisfied) — markup is the sole gap.

## Static extraction replica (MonsterCardHelpers.js)
- `extractSpellNamesFromSpellcasting` (:356, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, :363 skips names ending ':'): names = **[]** ("At Will:" and "2/Day Each:" both skipped; plain text never matches).
- `extractSpellcastingSpellUses` (:395): limit=2 captured from "2/Day Each:" header but binds only MARKED names (§144) → **{}** — 2/Day tracking structurally dead.
- Lane: row name `^spellcasting$` → SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx §532/§676-MA-1294): names.length===0 → null → row-level save_dc 12 NEVER renders a DC chip there. Generic junk **"+0"** chip arms on `attack_bonus != null` (:383/:408 §490).

## Live proof (test-campaign, localhost:5173, 2026-09-27)
- Header verified `test-campaign`; log baseline 2 (join-noise encounter+roll, §146).
- Rig (§MA-1417/§MA-1418 join order): +NPC autocomplete Bandit FIRST (exact-li, AC12 HP11 unsuffixed §805), EB exact-td[1] "Sahuagin Priest" SECOND (prefix-pair census [Sahuagin Priest, Sahuagin Priestess] §MA-1417); cs "Sahuagin Priest 1" mIdx sahuagin-priest AC12 HP38 idx0, zero clobber. No Hold Person victim rig needed (zero-affordance row needs no victim, MA-1375 precedent).
- Card Spellcasting row innerHTML:
  `<strong>Spellcasting.</strong> <span class="mc-dice-link" role="button" tabindex="0"><i class="fa-solid fa-dice-d20"></i> +0</span><span>The sahuagin casts … Hold Person, Tongues</span><em> ()</em>` — byte-shape twin of MA-1375 census.
- Chip census: `.mc-dice-link-spell` row AND whole card = **0**; only in-row link = junk **"+0"** (§490) — **UNPRESSED**, zero ability_use entries whole-log; cosmetic empty `<em> ()</em>` usage renders.
- Row-text press probe ×3 (description span): log 2→2→2→2 **ZERO delta**, zero popups, **console errors 0** (no §158 junk-cast noise — consistent zero-chip, not fake-chip).
- State probes: change-data `monsterSpellUses` ABSENT (top-level and nested `Sahuagin Priest 1`) — no counter, no gate, no spent state possible (§70 counter axis dead with markup); `pendingSavePrompts` absent, `lastAttack.saveDc/saveType` null, zero save log entries (§117 CLEAN — row DC unrenderable per MA-1294, absent ≠ FAIL(a)).
- Admin-clear after: log [] cd {} quiet-recheck; location.href localhost throughout (§90).

## Twin census (monsters.json)
- 20 zero-chip Spellcasting rows app-wide incl. priest (MA-1339), priest-acolyte (MA-1342), planetar (MA-1327), questing-knight (MA-1375), rakshasa (MA-1380), quaggoth-thonot (MA-1366)…
- **Armed twins LIVE**: djinni MA-0611, night-hag MA-1230 (fixed same family), death-knight — names marked + row DC; fix fully reachable in one DATA pass.

## Fix (DATA, zero code)
Wrap each spell name: `<strong>Thaumaturgy</strong>` / `<strong>Hold Person</strong>, <strong>Tongues</strong>` (djinni MA-0611 byte-shape; tier headers keep trailing-":" plain; row `save_dc:12`+`save_type:"Wisdom"` already authored). Recommend additionally dropping `attack_bonus:0` so junk "+0" stops rendering (armed twins carry no attack_bonus, §490). After fix: 3 chips; `extractSpellcastingSpellUses` binds {Hold Person:2, Tongues:2} → monsterSpellUses counters + `automation blocked` refusal on 3rd-cast of same spell (§57); Thaumaturgy At-Will ungated by design. Hold Person save-leg rides spell text seam `spellDamagelessSaveCondition` (Helpers:421) → paralyzed on failed Wis save vs DC 12 (MA-0348). All three spells present in 5e spells.json (verified).
