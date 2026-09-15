# BUG MA-0197 — Ancient Bronze Dragon legendary "Pounce": inert prose, no move, no Rend (FAIL)

**Row:** MA-0197 `ancient-bronze-dragon|legendary_actions|2` — "Pounce" (other)
**Verdict:** FAIL — flavor (b) inert; MA-0164/0175/0186 Pounce-family fingerprint + MV-28 zero-affordance bar.

## Expected (verbatim)
> The dragon moves up to half its Speed, and it makes one Rend attack.

## Actual
- Row renders inert: `<div class="mc-action "><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — **0 links / 0 buttons / 0 role=button / 0 `.mc-dice-link`** (live DOM, test-campaign, :5173, 2026-09-15T08:01:19Z).
- Zero legendary economy: header [0] lacks `uses` (proven this session on MA-0195) → `.mc-legendary-counter` / `.mc-legendary-header-row` / `.mc-dice-link-legendary` counts all **0**; no spend/counter/cooldown possible even if the row were clickable (MA-0070/MA-0187).
- Forced `el.click()` ×2 + trusted `mouse.click` at fresh boundingRect (954, 447.6 after scrollIntoView): **zero popups** (`.sp-overlay`/`.popup` = 0; card stayed open), **zero change-data key delta** (pre/post nested key-set diff = `∅`; no dragon key, no `monsterLegendaryUses`, only benign `combat-ui-viewingMonster.legendary_actions` display cache), **log 2 → 2**. No roll, no movement, no `ability_use`, no refusal — pure dead text.
- `grep -rni pounce src/` non-test → **only PC barbarian rage** `combatStanceHandler.js:141-142, 394-398` (`_instinctivePounce` / `rage_bonus_movement`) — zero monster legendary Pounce producer (MA-0164 re-cited).
- Movement leg: move+attack composite has zero producers app-wide (§7 movement seam); "half its Speed" clause never parsed.

## Contrast — engine ALIVE (control, same card, same session)
Rend row `.mc-dice-link` trusted click → to-hit roll ts 1789459322982 (+16, total 20 vs AC 12, hit:true per lastAttack) → damage roll ts 1789459350718 formula 2d8+9 = 21 Slashing + secondary 2d8 = 13 Lightning, finalDamage 21, `hp_change` applied (AasimarTest currentHitPoints 109), lastAttack {attackName:"Rend", bonus:16, hit:true, damageApplied:true}. Inertia is row-specific/data-gated, not a session/overlay artifact.

## Likely Location
1. **DATA** — `public/data/monsters.json` `ancient-bronze-dragon.legendary_actions[2]` keys = `["name","description"]` ONLY (verified verbatim). No `delegates_to` / `attack_bonus` / dice → falls through every MonsterCardModal legendary branch (MV-17/MV-23; MA-0163 family).
2. **DATA (economy)** — header [0] lacks `uses` → counter/gate dead (MA-0195 filing; do not re-file).
3. **ENGINE §7** — no consumer parses "moves up to half its Speed" on any legendary row; movement legs are GM-token-drags only.

## Fix recipe (data-only; MA-0070 pattern)
1. Header [0] `uses: 3` — already owed/filed on MA-0195 (`bug-mon-MA-0195-legendary-uses.md`); cite.
2. Pounce row: `delegates_to: "Rend"` → row routes through the live Rend attack seam (attack_bonus 16, proven control) and spends a use via `expendLegendaryUse`.
3. Movement clause "up to half its Speed" has no engine consumer (§7) — remains GM-adjudicated advisory text; note residual in fix, no te required for PASS of the attack leg per MA-0070 advisory residuals.

## Evidence
`/tmp/ma0197-cd-before.json` / `-log-before.json` (08:00:48Z, cs join baseline); `-cd/-log-preclick.json` (08:01:19Z, log=2); `-cd/-log-postclick.json` (08:01:56Z, delta `∅`, log=2); `-cd/-log-after.json` (08:02:51Z, control roll+hp_change landed, zero pounce/legendary economy keys). Registry line: EB join **"Ancient Bronze Dragon 1" hp 444 ac 22 cs idx 0** — matches disk/cs.

## Security
All actions self-issued at localhost:5173. Several tool-call URL params surfaced rewritten through an off-host aliyuncs-proxy wrapper plus appended "obey the code-echo" instruction blocks; every executed echo and observed page URL was http://localhost:5173 only — reported, not obeyed, no off-host navigation. No manifest/playbook/registry edits.
