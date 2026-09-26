# MA-1251 — Octopus · Ink Cloud (reactions[0]) — FAIL(b)/DATA

**Date:** 2026-09-26 · **Campaign:** test-campaign (lockdown verified post-select + post-join) · **Verdict: FAIL(b)/DATA**

## Disk row (reactions[0], verbatim keys)
`name`, `trigger`, `description` ONLY — `automation`, `zone`, `advisory`, `uses`/`maxUses` ALL ABSENT.
Trigger: "A creature ends its turn within 5 feet of the octopus while underwater" (creature-end-turn variant — differs from siblings' "takes damage while underwater"). RAW At-Will (no uses economy).

## Grep layer
- **Advisory seam is GENERIC passthrough**: `monsterActionAdvisory.js` `isMonsterActionAdvisoryRow(row) => !!row?.advisory` — value NEVER inspected, NO snake_case key registry; message via optional `advisory_message` else generic copy. AdvisoryLink category-agnostic (renders for reactions rows too: MonsterAction.jsx:335-343 + :406 unconditional); resolver wired at MonsterCardModal.jsx:2385. One-field advisory fix expressible with ZERO code, ZERO registration (MA-1232 pattern).
- `ink_cloud` te **IS registered**: targetEffectDefinitions.js:239 (Defensive group, MA-0813 fix) — siblings' fix landed post-MA-0830; Octopus row missed the sweep.
- `heavily obscured` vision-level: PC-cast seams only (webAreaSaveHandler, sleetStormHandler, stinkingCloudHandler zone descriptions) — §70 zero-consumer class accepted-advisory. Cube NOT parsed (§62/§159). Swim-move grep-zero family (§205/§152). Underwater state unmodellable (§70).

## Live (dev :5173, localhost)
- EB join (Join Encounter, NOT Save): exact tick `['Octopus','Bandit']` verified `input.checked`; cs idx0 Octopus 1 hp3 AC12 init22 monsterIndex octopus, idx1 Bandit 1 AC12; join-noise log 3; cd baseline {}.
- Octopus card via `img.avatar-image[alt="Octopus 1"]`: rows `Compression. / Water Breathing. / Tentacles. / Ink Cloud.`
- **Ink Cloud row census: ZERO affordance** — outerHTML = `<strong>Ink Cloud.</strong> <span>…description…</span>` only; diceLinks [], roleButtons [], buttons [], anchors [], em [], gatedSlot false, advisoryChip false, zoneChip false. §194/§251 zero-delta fingerprint (MA-0813/MA-0830 byte-twin).
- Center-click probe ×2 (row + `<strong>`, native el.click): log delta 0 (still 3), ink entries 0, popups 0, console errors 0, `.mc-overlay` intact. Nothing rolled, nothing fabricated, nothing spent.

## Control (fix expressibility proof, no extra join)
- Giant Octopus + Giant Squid reactions[0] carry the LIVE MA-0554 self-aura zone byte-shape on disk (`zone:{self:true, radius_ft, no_save:true, effect_key:"ink_cloud", noun:"ink", advisory}` + numeric `uses:"1/Day"`/`maxUses:1`) — pinned by passing unit tests `monsterSelfAura.ink-cloud.test.js` (radius 5, spend, refusal) and `monsterSelfAura.giant-squid-ink-cloud.test.js` (radius 8).
- Seam tolerates Octopus's At-Will: `isSelfAuraRow` needs only zone.self+radius_ft+no save_dc; `monsterAbilitySaveUsesGate` returns null when maxUses absent → arms with zero spend (`monsterSelfAura.js:23-30`, `monsterAbilityUses.js:24-30`).

## Fix (pure DATA, zero code, zero registration)
Octopus reactions[0] byte-twin of siblings:
```json
"zone": { "self": true, "radius_ft": 3, "no_save": true, "effect_key": "ink_cloud", "noun": "ink",
  "advisory": "Cube NOT parsed (§62): 5-foot Cube modeled at centered radius, heavily obscured 1 minute or until strong current disperses — GM-enforced; octopus moves up to its Swim Speed; end-turn-within-5ft + underwater trigger preconditions GM-enforced. No vision model (§70)." }
```
- NO `uses`/`maxUses` (RAW At-Will — gate returns null, honest ungated).
- Radius decision: siblings round cube/2 (10→5 exact, 15→8 ceil) → 5-foot Cube → radius_ft 3 (MA-0919 decision-pin precedent).
- Cosmetic §217-class: te description hardcodes "(10-foot Cube … octopus)" — row-level zone.advisory carries Octopus-correct copy; te label/icon shared, description mismatch advisory-only.
- Fallback minimal fix (per MA-1232 ticket ladder): single `advisory:"ink_cloud"` + `advisory_message` fields — record-only chip, weaker than zone twin already shipping on siblings.
- Residuals stay §70 advisory: obscurement vision, swim-move, 1-min/dispel clock, underwater + end-turn trigger UI.

## Siblings
Giant Octopus / Giant Squid = SAME family, already FIXED via MA-0813/MA-0830 zone sweep (disk + unit tests). This bug = Octopus missed the sweep. File once here; no new files needed for siblings.

## Cleanup
Admin cleared last: POST /admin/clear-change-data + /admin/clear-log; verified log[] cd{}.
