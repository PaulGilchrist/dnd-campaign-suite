# MA-1057 — Kraken "Storm Bolt" (legendary_actions[0], uses:1) — FAIL(b) HEADER-SWALLOW

- **id:** MA-1057 | **monster:** Kraken (`kraken`) | **row:** legendary_actions[0] | **category:** legendary
- **actionName:** Storm Bolt | **authored:** `{name:"Storm Bolt", description:"The kraken uses Lightning Strike.", uses:1, recharge:false}` (public/data/monsters.json:37059-37064)
- **verdict:** FAIL(b) — rows[0] swallowed-by-header + no alias resolution (MA-0675 §99 harder-zero family)
- **date:** 2026-09-24 | **campaign:** test-campaign (header verified `test-campaign` after select; localhost:5173 only)

## Expected

"Storm Bolt" is the Kraken's first legendary action, a prose alias of the `actions[]` row **Lightning Strike** ("The kraken uses Lightning Strike."). Expected: an Expend-gated `.mc-dice-link-legendary` affordance on a Storm Bolt row that, via `delegates_to: "Lightning Strike"`, spends a legendary use and adjudicates the Lightning Strike DC 23 Dex save. §99 canonical shape (docs/test-setup-playbook.md:202): rows[0] MUST be header `"Legendary Action Uses: N"`; children carry `delegates_to`. Kraken disk data is pre-fix legacy shape.

## Actual (live DOM, fresh Kraken card, test-campaign)

Storm Bolt is consumed **as the economy header** and never renders as a row:

- Header row verbatim (only Storm Bolt appearance on the entire card):
  `<div class="mc-action mc-legendary-header-row" title="Legendary action uses — regain at the start of this creature's turn"><strong>Storm Bolt</strong> <span class="mc-legendary-counter">(1 left)</span> <span>The kraken uses Lightning Strike.</span></div>`
- Header row interactivity: `onclick` attr **false**, inner `a/button/[role=button]/dice-link/expend` count **0** → plain no-onClick div.
- `.mc-dice-link-legendary` in overlay: **1**, and it belongs to **Toxic Ink** (rows[1]) only — Storm Bolt has **zero** chips.
- Legendary uses display: `(1 left)` — economy max sourced from swallowed rows[0].uses:1, contradicting RAW Kraken (3 legendary actions; both children authored `uses:1`, canonical total absent from disk — honest gap named).
- Section title renders `"Legendary Actions"` (not `"Legendary Action Uses: N"`) — header-insert fix applied to elemental cataclysm (MA-0675 FIXED) was **not** applied to kraken data.
- Alias inert: prose "The kraken uses Lightning Strike." renders as dead text in the header; `delegates_to` field absent; no "uses <Name>" auto-alias resolver exists (rg zero). Lightning Strike itself is clickable only as its own actions[] row (interactive 3, DC 23 chip), unlinked from the legendary economy.

### Click probe (ONE press, budget honored)

Fresh-rect click on `.mc-legendary-header-row` center (pre-rect x=470 y=1155.05 w=640 h=17.84): **zero delta** — popups 0, `.dice-tray-popup-overlay` false, overlays 1 (card itself), counter frozen `(1 left)`, log **500→500**, Kraken runtime store keys unchanged `[_lastRollContext, lastAttackRoll, lastSaveRoll, pendingCombatSuperiorityPrompt]` — **zero** `monsterLegendaryUses` / spend / latch keys = economy untouched-and-unreachable. Console errors **0**.

## Cites

- `src/services/encounters/monsterLegendaryUses.js:153-157` — `legendaryHeaderAction`: `return rows[0]?.uses != null ? rows[0] : null;` (:156) → Storm Bolt (uses:1) IS the header.
- `src/components/encounter/MonsterCardBody.jsx:55` — legendary section renders `actions={s.actions.slice(1)}` → Storm Bolt dropped from clickable rows.
- `src/components/encounter/MonsterCardBody.jsx:241-250` — `MonsterLegendaryHeaderRow` plain `<div>`, no onClick → no `.mc-dice-link-legendary`, silent-burn path (MA-0510) unreachable.
- `src/components/encounter/MonsterAction.jsx:164-165` — `LegendarySpendLink` gates on `legendaryGate`; header row never routes through it.
- Delegate resolution spans `actions[]`: `monsterLegendaryUses.js:3-9` (`resolveDelegates`) — usable once `delegates_to` authored.

## Fingerprint comparison

- **MA-0675 Eruption (registry:1861, playbook:202)** — exact twin: swallowed child IS the would-be attacker, name+(N left) in plain no-onClick div, children slice(1) drops row, frozen counter, refusal tokens untestable by construction, 0 console errors. Kraken differs only in residual: rows[1] Toxic Ink keeps its own Expend chip (MA-0675 card had 0 legendary links because rows[1] rode the same gate too) — Storm Bolt affordance itself is the same harder-zero on its own row.
- **MA-0958 Cast a Spell (bug-mon-MA-0958:55)** — opposite shape: prose rows[0] (no uses) → header **null**, whole economy disarmed. Here economy IS armed but sourced from and capped by the swallowed child itself (max 1, "(1 left)" frozen).

## Fix

§165/§99 data template (data-shaped, machinery already live per MA-0675-FIXED registry:231):
1. Insert header rows[0]: `{"name":"Legendary Action Uses: 3","uses":3}` (printed-source floor; current child uses:1 each is the economy-cap defect).
2. Storm Bolt child: drop `uses`, add `delegates_to: "Lightning Strike"` (actions[] row exists, DC 23 6d10) → Expend chip + delegate adjudication ride the existing gate.
3. Toxic Ink child: drop `uses`, keep save transport.

## Cleanup / integrity

Card closed; overlays clean (body-child overlay scan []). Bandit 1 cond-clean GET proof: `activeConditions: []` (twice: pre-click and post-click), AC12 819/999, rig intact (Kraken 481/481 init 29, round 8, activeCreature unchanged Kraken 1). Log unmodified 500; no cache/log clears; no manifest edit; no git writes. Security: navigate echo showed off-site aliyuncs URL rewrite (§90/§97 fingerprint); rejected — `location.href` self-verified `http://localhost:5173/` throughout; test-campaign only.
