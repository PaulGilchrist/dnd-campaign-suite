# BUG MA-1649 — Vampire Nightbringer "Mists" (lair_actions[2]) — FAIL(b)/DATA — 2026-09-29

## Row
stableKey `vampire-nightbringer|lair_actions|2` · category lair_actions · actionType "other"
Disk keys: `name`, `description` ONLY (monsters.json ~:63232). No zone / advisory / save_dc / dice.

## Observed (live, test-campaign, dev:locked :5173)
- Card renders verbatim: "Mists. The area within 1 mile of the lair is Lightly Obscured by a persistent, creeping fog. The vampire and any creatures of its choice are unaffected by the fog."
- Whole-card `.mc-dice-link-lair` count = 0 (all three Nightbringer lair rows static, cursor:auto, role=button 0).
- Click probes ×3 on row: 0 popups, log 2→2 (join-noise only), cs lastAttack/targetEffects/pendingSavePrompts null, NB char keys []. Console 0 errors.
- `isLairRowClickable` (monsterLairActions.js:26) returns false on name+desc-only dict → MonsterCardBody.jsx:358 static div. Row has a NAME, so the MA-0024 static carve-out (:17-19, legacy plain-string + nameless dicts) does NOT cover it.

## Why FAIL(b)/DATA (not §70 advisory)
Fog obscurement te lane is LIVE and REGISTERED: `lair_fog_cloud` te (targetEffectDefinitions.js:1218, "lightly obscured … No saving throw", Lair group) + MA-0043 zoneOnly picker + `.mc-dice-link-lair` chip. Identical lightly-obscured fog lair rows elsewhere HAVE zone-fills authored:
- Adult Bronze Dragon lair_actions[0] "Fog Cloud": `zone:{radius_ft:20,no_save:true,noun:"fog",effect_key:"lair_fog_cloud",advisory:…}`
- Ancient Bronze Dragon lair_actions[0] "Fog Cloud": byte-twin
- Ancient Silver Dragon lair_actions[0] "Fog Cloud": byte-twin
- Ancient White Dragon lair_actions[0] "Freezing Fog": byte-twin INCLUDING persistent-fog copy ("…until the dragon uses this lair action again or until the dragon dies — GM-enforced") — exactly Nightbringer Mists' persistence shape
Plus MA-0378 (§9): bare-string lair fog/darkness rows were converted to zone-row shape + te. MA-1251 fingerprint verbatim: "te pre-registered … but rows ship ZERO surface = family defect; recommended fix = zone-dict byte-twin". Adult Silver Dragon's advisory-dict opt-in twin (:0 keys advisory/description/name) still arms a clickable advisory chip — precedent gives every named fog row SOME surface; only Nightbringer Mists ships none.

## Recommended fix (one-field DATA)
Author `zone` as last key, byte-twin of Adult Bronze shape:
`"zone": {"radius_ft": 5280, "no_save": true, "noun": "fog", "effect_key": "lair_fog_cloud", "advisory": "1-mile lair region modeled as a GM-positioned radius picker (no 1-mile token scale; gridless map). Lightly obscured has no obscurement/light-level consumer in this engine — GM-enforced. The vampire and creatures of its choice are unaffected — GM-enforced (no selective-immunity consumer). Persists until the vampire dies or moves its lair — GM-enforced (no initiative-20 lair seam / persistent-lair-state consumer)."}`
Residuals after fix: 1-mile radius abstraction, persistent-until-lair-moves cadence, vampire-choice immunity = advisory copy (no consumers; same class as MA-0378 square→radius + init-20 accepted residuals). If radius_ft:5280 breaks picker sanity, fall back to Adult Silver advisory-dict opt-in twin `{name,advisory,advisory_message,description}` (MAIR-LAIR-FAMILY MA-1207/08/09 Kraken twin) — still strictly better than zero surface.

## Evidence trail
cs join: Vampire Nightbringer 1 142/142 via EB exact-td. Cleanup: tab closed FIRST → admin clear-change-data 200 + clear-log 200 → log 0, change-data [] (§15).
