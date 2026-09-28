# BUG MA-1479 — Solar Blinking Gaze (legendary_actions|0) — FAIL(b)/DATA + code-gap riders

Row (verbatim):
```json
{"id":"MA-1479","stableKey":"solar|legendary_actions|0","monsterIndex":"solar","monster":"Solar","actionIndex":0,"actionName":"Blinking Gaze","category":"legendary_actions","actionType":"save","saveEffect":"The target has the Blinded condition for 1 minute. Failure or Success: The solar can't take this action again until the start of its next turn.","recharge":false,"uses":1,"conditions":["blinded"],"description":"Constitution Saving Throw: DC 25, one creature the solar can see within 120 feet. Failure: The target has the Blinded condition for 1 minute. Failure or Success: The solar can't take this action again until the start of its next turn.","verified":"not verified"}
```

## Verdict: FAIL(b) — header-swallow, zero affordance on THIS row (MA-1456 twin)

## Disk structure (public/data/monsters.json solar.legendary_actions)
- rows[0] "Blinking Gaze": `uses:1` numeric; NO `save_dc` (DC 25 prose-only); NO `save_type` (prose "Constitution Saving Throw"); `save_effect` w/ "Blinded ... for 1 minute" + "Failure or Success:" marker; `recharge:false`; NO `delegates_to`; once-per-turn cooldown clause in description.
- rows[1] "Radiant Teleport": `uses:1`, `save_type:"Dexterity"`, prose damage, NO numeric `save_dc`.
- NO canonical header row "Legendary Action Uses: N".

## Code-fingerprint (source-confirmed)
- `legendaryHeaderAction` monsterLegendaryUses.js:153 — returns rows[0] whenever `rows[0].uses != null` → Blinking Gaze is consumed AS the header.
- MonsterCardBody.jsx:60 — `actions={s.actions.slice(1)}` when header truthy → Blinking Gaze row dropped from render; header renders as no-onClick `div.mc-legendary-header-row` (:249).
- MA-0675 §202 harder-zero shape: swallowed child is itself → ZERO `.mc-dice-link-legendary`, ZERO Expend chip, silent-burn unreachable, frozen counter, console 0 errors. Exact MA-1456 twin (Shadow Dragon Pounce, same :153 + slice(1)).

## Live ledger (Playwright, test-campaign, header verified, localhost-only)
- Board: EB re-join after MA-1477 admin-clear — Solar 1 idx0 init35 hp297, Bandit 1 init12 AC12 hp11; Bandit armed on Solar own-card `[data-testid="target-select"]` (value verified).
- Legendary window: initiative walked past Solar (activeCreatureName=AasimarTest, round const).
- Card audit: legendary section renders
  - `div.mc-legendary-header-row` text "Blinking Gaze (1 left)" — `onclick:false`, `role:null`, links:[] — structurally unclickable.
  - rows[1] Radiant Teleport: own `2d10` chip riding the wrapped legendaryGate (shared-counter consumer on the NEIGHBOR row — no Blinking Gaze credit).
  - Card-wide save chips: ONLY "DC 21 Dexterity" (Slaying Bow, actions section). ZERO DC 25 chips, ZERO Constitution chips, ZERO `.mc-dice-link-legendary`, ZERO "Expend Legendary".
- Swallowed-header click: zero log delta (log stayed 4 join-noise encounter/roll entries), zero popup, zero spend.
- Change-data: Solar 1 store EMPTY (no `monsterLegendaryUses`, no `monsterLegendaryActionCooldowns.blinking_gaze` latch); Bandit 1 `activeConditions:null` — Blinded NEVER granted; no save log; DC 25/CON never adjudicated.
- Console: 0 errors (silent-burn unreachable per §202).

## Defect axes
1. PRIMARY: header-swallow (rows[0] uses:1, no header) → row structurally unclickable — FAIL(b) per ticket trichotomy; MA-1456 twin citation.
2. Prose-only DC + missing save_type: even un-swallowed, no numeric `save_dc` → chip never arms (MonsterAction.jsx:91 gate; §54/§89/§178 MA-0614 family).
3. "Failure or Success:" always-condition marker: §160 (MA-0590) transport is PICKER-only; single-target save seam is fail-only (applyFailedSaveConditions early-return on success) → Blinded-on-success leg needs picker/both-outcomes transport even after fixes 1-2.
4. Once-per-turn owner latch (§40/§204): clause parses (hasLegendaryCooldownClause, monsterLegendaryUses.js:134, slug `blinking_gaze`) but never stamps because the row is unreachable.

## Fix (DATA-first, same-pass per §46)
1. Insert canonical header rows[0]: `{"name":"Legendary Action Uses: 2","uses":2,"description":...}` (verified templates MA-0675/§168 byte-shape).
2. Drop per-child `uses` from both children (§165/§168).
3. Blinking Gaze: add numeric `save_dc:25` + `save_type:"Constitution"` → rows[1+] own save chip rides shared legendary gate live (MA-0567 §113 / MA-0676 §204 twin: DC23-Constitution chip spends shared counter honestly).
4. Blinded-on-success ("Failure or Success") leg: single-target inline seam is fail-only (§160); needs both-outcomes transport (MA-0590 picker-only today) — adjudicate as accepted residual or picker-route; "for 1 minute" clock = rounds:10 §38 at grant time.

## Clock/§38/§94 residual
- No "for 1 minute" meta recorded (nothing ever granted) — §38 minutes×10-rounds clock and §94 persistent-prone-style residual unexercised; nothing to clock against because the row never fires.

## Cleanup end-state
- Card closed; `/admin/clear-change-data` 200, `/admin/clear-log` 200; combatSummary creatures=0; log len=0; location.href localhost:5173 throughout.
- Injection note: navigate args echoed an off-site OSS proxy URL (§90 pattern); page URL value verified localhost every step; no off-site navigation performed. Zero fabricated content obeyed.

Files: checkpoint `.opencode/plans/checkpoint-mon-MA-1479.md`, this bug file, registry row appended to Solar.config.verifiedRow.
