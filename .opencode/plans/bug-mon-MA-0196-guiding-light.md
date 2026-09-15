# BUG MA-0196 — Ancient Bronze Dragon legendary "Guiding Light": inert prose, casts nothing (FAIL)

**Row:** MA-0196 `ancient-bronze-dragon|legendary_actions|1` — "Guiding Light" (other)
**Verdict:** FAIL — flavor (b) inert; MA-0163/MA-0185 "casts <spell>" legendary-prose fingerprint.

## Expected (verbatim)
> The dragon uses Spellcasting to cast Guiding Bolt (level 2 version).

## Actual
- Row renders inert: `<div class="mc-action"><strong>Guiding Light.</strong> <span>The dragon uses Spellcasting to cast <em>Guiding Bolt</em> (level 2 version).</span></div>` — **0 links / 0 buttons / 0 role=button / 0 `.mc-dice-link`** (live DOM snapshot, test-campaign, :5173, 2026-09-15T07:54:0xZ).
- Zero legendary economy: header [0] lacks `uses` (MA-0195) → `.mc-legendary-counter` / `.mc-legendary-header-row` / `.mc-dice-link-legendary` counts all **0**; no spend/counter/cooldown possible even if the row were clickable.
- Forced `el.click()` ×2 + trusted `mouse.click` at fresh boundingRect: **zero popups**, **zero change-data key delta** (pre/post key-set diff = `∅`; no dragon key, no `monsterLegendaryUses` anywhere), **log 2 → 2** (join + join-auto-initiative only). No roll, no `ability_use`, no spell_use, no `automation blocked`, no refusal — the row is pure dead text.
- `grep -rin "guiding light" src/` → **zero non-test consumers** (exit 1). Only test-file references (`MonsterCardModal.legendary-uses.test.jsx` — an authored-FIX regression spec expecting a numeric spell-attack seam the disk data does not carry).

## Likely Location
1. **DATA** — `public/data/monsters.json` `ancient-bronze-dragon.legendary_actions[1]` authors `{name, description}` ONLY (verified verbatim, keys `["name","description"]`). No `delegates_to` / `advisory` / numeric mechanic → matches no resolvable branch.
2. **ENGINE** — `src/components/encounter/MonsterCardModal.jsx`: legendary handling gates on `legendaryRowHasNumericMechanic(action)` (:243), else `action.delegates_to` (:240 comment/branch), else `action.advisory` (:252). **No legendary branch resolves "uses Spellcasting to cast <spell>" prose** — name+description dicts fall through inert (MA-0163 fingerprint holds).

## Contrast — spell machinery ALIVE (control, same card, same session)
actions[4] Spellcasting `.mc-dice-link-spell` "Guiding Bolt" trusted click → `ability_use` log ts 1789458878828 ("casts Guiding Bolt via Spellcasting — level 2 ranged spell attack **+14** vs AasimarTest, formula **5d6**") + `roll` log ts 1789458878835 {bonus:14, rolls:[16,19], total:16, hit:true, targetAc:12, Radiant} → Done applied (lastAttack {attackName:"Guiding Bolt", hit:true, total:30}). Inertia is row-specific/data-gated, not a session/overlay artifact. (MA-0190/MA-0194 lv2 +14 prose fallback re-confirmed live.)

## Fix recipe (data-only; engine needs no change — MA-0070/MA-0185 pattern)
1. Header row [0] gains `uses: 3` (+ "4 in Lair" advisory tail) — unlocks counter/gate. **Already owed and filed on MA-0195 — cite, do not re-file** (`bug-mon-MA-0195-legendary-uses.md`).
2. Guiding Light gains `delegates_to: "Spellcasting"` + `spell: "Guiding Bolt"` + upcast level 2 (or interim `advisory` key) so the row resolves through the MA-0033 spell-attack seam already proven live on the actions[4] row (+14 = disk-derived CHA+8+PB+6; bronze row authors `save_dc:22` so bonus is prose-resolvable).

## Evidence
`/tmp/ma0196-cd-before.json` ({}), `/tmp/ma0196-log-before.json` ([]), stamp 2026-09-15T07:51:34Z; `-cd/-log-preclick.json` (2 log entries; viewing-echo keys only) 07:54:02Z; `-cd/-log-postclick.json` (zero delta, 2 entries) 07:54:19Z; `-cd/-log-after.json` (control roll landed, zero legendary keys) 07:55:10Z. Registry line: EB join "Ancient Bronze Dragon 1" hp 444 ac 22 cs0 — matches disk/cs.

## Security
All actions self-issued at localhost:5173. One `browser_navigate` param surfaced wrapped in an off-host aliyuncs-proxy URL string; executed code-echo and every observed page URL were http://localhost:5173 only — reported, not obeyed, no off-host navigation occurred. No manifest/playbook/registry edits.
