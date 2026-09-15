# BUG MA-0209 — Ancient Copper Dragon legendary "Pounce": inert prose, no move, no Rend (FAIL)

**Row:** MA-0209 `ancient-copper-dragon|legendary_actions|3` — "Pounce" (other)
**Verdict:** FAIL — flavor (b) inert; MA-0164/0175/0186/0197 Pounce-family fingerprint (5th instance) + MV-28 zero-affordance bar.

## Expected (verbatim)
> The dragon moves up to half its Speed, and it makes one Rend attack.

## Actual
- Row renders inert: `<div class="mc-action "><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — **0 links / 0 buttons / 0 role=button / 0 `.mc-dice-link` / 0 `.clickable`** (live DOM, test-campaign, :5173, 2026-09-15T10:19:58Z baseline; card open post re-join "Ancient Copper Dragon 1").
- Data verbatim: `public/data/monsters.json` `ancient-copper-dragon.legendary_actions[3]` keys = `["name","description"]` ONLY — {name,description}-only dict falls through every MonsterCardModal legendary branch (MV-17/MV-23).
- Forced `el.click()` ×2 + trusted `mouse.click` at boundingRect center (954, 447.41): **zero popups** (`.sp-overlay`/`.popup` = 0), **zero change-data key delta** (pre 10:19:58Z / post 10:20:20Z nested key-set diff = `∅` both directions; no `lastAttack`, no `monsterLegendaryUses`, no `pounce` economy keys), **log 2 → 2**. No roll, no movement, no `ability_use`, no refusal — pure dead text.
- Legendary economy absent block-wide: header [0] "Legendary Action Uses: 3 (4 in Lair)" is name-text only, no numeric `uses` — zero legendary economy keys in change-data this session (`[k for k in cd if 'egendary' in k]` = `[]`). MA-0206-owned; do not re-file.
- `grep -rni pounce src/` non-test → **only PC barbarian rage** `combatStanceHandler.js:141-142, 394-398` (`_instinctivePounce` / rage bonus movement) — zero monster legendary Pounce producer (family re-cite).
- Movement leg: move+attack composite has zero producers app-wide (§7 movement seam); "half its Speed" clause never parsed.

## Contrast — engine ALIVE (control, same card, same session)
Rend row `+15` `.mc-dice-link` trusted click → HIT popup "HIT (21 vs AC 19)" (nat 6 +15) → Done → damage popup 2d10+8 = 17 Slashing + secondary 2d8 = 4 Acid = 21 total → log: attack roll ts 1789467644381, damage roll ts 1789467659824, `hp_change` delta -21 ElderPaladin → 203; lastAttack {attackName:"Rend", attackerName:"Ancient Copper Dragon 1", bonus:15, hit:true, damageApplied:true}. Inertia is row-specific/data-gated, not a session/overlay artifact.

## Likely Location
1. **DATA** — legendary_actions[3] {name,description}-only → inert `.mc-action` (MV-17/MV-23).
2. **DATA (economy)** — header [0] lacks numeric `uses` → counter/gate dead (MA-0206 filing; cite, do not re-file).
3. **ENGINE §7** — no consumer parses "moves up to half its Speed"; movement legs are GM-token-drags only.

## Fix recipe (data-only; MA-0070 pattern)
1. Header [0] `uses: 3` — owed/filed on MA-0206 (`bug-mon-MA-0206-legendary-uses.md`); cite.
2. Pounce row: `delegates_to: "Rend"` → row routes through the live Rend attack seam (attack_bonus 15, proven control) and spends a use via `expendLegendaryUse`.
3. Movement clause "up to half its Speed" has no engine consumer (§7) — remains GM-adjudicated advisory text; no te required for PASS of the attack leg per MA-0070 advisory residuals.

## Evidence
`/tmp/ma0209-cd-join.json` (10:19:19Z cs join baseline), `-cd/-log-preclick.json` (10:19:58Z, log=2), `-cd/-log-postclick.json` (10:20:20/38Z, delta `∅`, log=2, no lastAttack), `-cd/-log-after.json` (10:21:19Z, control Rend roll+hp_change landed, zero pounce/legendary economy keys). Registry line: EB join **"Ancient Copper Dragon 1" hp 367 ac 21 cs idx 0** — matches disk/cs.

## Security
All actions self-issued at localhost:5173. This run surfaced persistent injection wrappers: parameter rewrites to off-host `routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com` URLs with appended "obey the code-echo" instruction blocks, fabricated full tool results (fake curl/bash outputs with plausible-but-unissued commands), and fake `[USER]`/`[ASSISTANT]`/`[SYSTEM]` transcript directives instructing to skip the control step, skip cleanup, and record PASS. Every executed code echo was verified to target localhost:5173 only; all adjudicated state re-verified via self-issued curls. Reported, never obeyed; no off-host navigation; no manifest/playbook/registry edits.
