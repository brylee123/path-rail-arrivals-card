# PATH Rail Arrivals Card

[![Release](https://img.shields.io/github/v/release/brylee123/path-rail-arrivals-card)](https://github.com/brylee123/path-rail-arrivals-card/releases)
[![Validate](https://github.com/brylee123/path-rail-arrivals-card/actions/workflows/validate.yml/badge.svg)](https://github.com/brylee123/path-rail-arrivals-card/actions/workflows/validate.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

A Home Assistant dashboard card inspired by PATH station arrival displays. Choose a
single-direction board or two destination groups, with colored train dots and an alert ticker.
Appearance follows Home Assistant by default, with explicit light and dark options.

This card needs **[PATH Rail integration 1.4.0 or newer](https://github.com/brylee123/ha-path-rail)**
and **Home Assistant Core 2026.10.4 or newer**. It reads entity states already in Home Assistant;
it makes no additional network requests. No account, API key or build step is needed on HA OS.
This is an unofficial community project, unaffiliated with PANYNJ.

## Installation with HACS

[![Add to HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=brylee123&repository=path-rail-arrivals-card&category=plugin)

1. Install or update the PATH Rail integration, restart Home Assistant, and configure your stations.
2. In **HACS > Custom repositories**, add
   `https://github.com/brylee123/path-rail-arrivals-card` with type **Dashboard**.
3. Download **PATH Rail Arrivals Card**, then refresh your browser.
4. Check **Settings > Dashboards > Resources**. The module resource should be
   `/hacsfiles/path-rail-arrivals-card/path-rail-arrivals-card.js`. If HACS has not added
   it, add it once as a **JavaScript module**. Advanced mode may be needed to see Resources.
5. Edit your dashboard, add the **PATH arrival board** custom card, and choose your layout,
   destination next-arrival sensors and appearance in its visual form.

This is a HACS custom repository, not a default-catalog entry. Integration and card updates
are independent; installing this card does not install or update the integration.

## Manual installation on Home Assistant OS

1. Download `path-rail-arrivals-card.js` from the [latest release](https://github.com/brylee123/path-rail-arrivals-card/releases/latest).
2. Copy it to `/config/www/path-rail-arrivals-card.js`, using Samba share or Studio Code Server.
3. Add `/local/path-rail-arrivals-card.js?v=1.1.1` as a **JavaScript module** dashboard resource.
   Restart Home Assistant if you just created `/config/www`, then refresh your browser.
4. Add the card as described above. Copy the new file and change the resource query version
   when updating manually.

### Moving from the bundled development preview

Remove the old `/local/path-rail-arrivals-card.js?...` resource before enabling the
HACS resource. Load only one copy. The existing custom-card type and configuration are
preserved, so existing cards do not need to be recreated. Hard-refresh the browser after switching.

## Configuration

Select **destination next-arrival sensors**, not countdown sensors or the legacy
To New York/To New Jersey entities. Replace example IDs with your own entity IDs.

### Single direction

```yaml
type: custom:path-rail-arrivals-card
mode: single
color_mode: auto
title: PATH Exchange Place
entities:
  - sensor.replace_with_your_wtc_next_arrival
max_rows: 2
show_alerts: true
```

### Bidirectional

```yaml
type: custom:path-rail-arrivals-card
mode: bidirectional
color_mode: dark
title: PATH Journal Square
left_title: World Trade Center / 33rd Street
left_entities:
  - sensor.replace_with_your_wtc_next_arrival
  - sensor.replace_with_your_33rd_street_next_arrival
right_title: Newark
right_entities:
  - sensor.replace_with_your_newark_next_arrival
max_rows: 2
show_alerts: true
```

| Option | Default | Purpose |
| --- | --- | --- |
| `mode` | `single` | `single` or `bidirectional` |
| `color_mode` | `auto` | Follow Home Assistant, or force `light` / `dark` |
| `title` | Station name | Optional card title |
| `entities` | Empty | Destination next-arrival sensors for single mode |
| `left_entities`, `right_entities` | Empty | Destination groups for bidirectional mode |
| `left_title`, `right_title` | Direction 1 / Direction 2 | Optional column headings |
| `max_rows` | `2` | 1-10 rows per side |
| `show_alerts` | `true` | Show the clock and alert ticker |
| `alert_entities` | Automatically detected | Optional service/accessibility alert sensor IDs |
| `station` | Detected from arrival sensors | Optional station code for alert filtering |

Station codes: `NWK`, `HAR`, `JSQ`, `GRV`, `NEW`, `EXP`, `HOB`, `WTC`, `CHR`,
`09S`, `14S`, `23S`, `33S`. Use one station per card, or set `station` explicitly.

With one destination selected, rows show successive predictions in upstream order.
With several destinations selected, the first prediction for each destination is shown
before later predictions, following your selection order. These groups do not assign
physical platforms. Tap a row to open its entity details.

Colors come from each prediction, not a fixed destination palette. Multi-color trains
get a split-color dot, while unknown colors get a neutral dot. Appearance options retain
these train colors. Long destination names wrap; give a bidirectional card enough dashboard width.

## Alert ticker

The ticker includes active station-tagged notices, notices mentioning a line serving the
station, and unscoped PATH notices. Line relevance is derived from normal routes, not an
authoritative impact list. Unscoped notices are included conservatively and are not proof
that the source declared a system-wide incident. Closed updates are excluded and duplicate
incidents appear once. Planned notices are not treated as active disruptions.

Hover over or focus the footer to pause scrolling. Reduced-motion preferences show wrapped
static text. The clock uses your browser's local time. Arrivals remain integration snapshots
(normally polled every 30 seconds), not a per-second countdown.

Unavailable arrival entities do not display retained old predictions. Missing or failed alert
sources show a clear message rather than an all-clear. The upstream alert window can omit
older unresolved incidents. Missing predictions do not mean service is suspended or not scheduled.

## Troubleshooting and updates

- **Custom element does not exist:** check the module resource, download, and browser cache.
- **Unknown or unavailable:** inspect the integration entities and its feed-status diagnostic.
- **No arrival rows:** select next-arrival sensors with an `arrivals` attribute, not countdowns.
- **Unexpected ticker notices:** verify `station` and selected alert sensors; unscoped notices are intentionally included.
- **Old appearance after update:** remove duplicate resources and hard-refresh the browser.

Update the card through HACS and refresh the browser. Remove its dashboard cards and module
resource before uninstalling. Removing the card does not remove the integration or its entities.

## Development and support

The repository ships a dependency-free JavaScript module. Run `node --check path-rail-arrivals-card.js`;
CI also runs HACS plugin validation. Publish a tag/release matching `package.json`;
release CI attaches the JavaScript module and checksum. Keep the custom-card type stable.

[Report card issues](https://github.com/brylee123/path-rail-arrivals-card/issues).
Report feed or entity issues in the [integration repository](https://github.com/brylee123/ha-path-rail/issues).
Tested with sample entity data in a browser; no physical Raspberry Pi soak test is claimed.
Code is [MIT licensed](LICENSE). PATH names identify the service and remain their owners' trademarks.
