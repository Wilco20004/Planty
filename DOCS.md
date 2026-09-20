# Planty

Track your house plants: location, light needs, and watering schedule, with
optional Home Assistant integration for reminders and (later) live sensor
readings.

## Setup

1. Install the addon and start it.
2. Open the Planty panel from the sidebar (Ingress) or the "Open Web UI" link.
3. Add your plants and set a watering interval (and optionally a "move to
   brighter light" reminder) for each.
4. Go to **Settings** inside Planty and point it at your MQTT broker (e.g.
   the official Mosquitto broker addon, host `core-mosquitto`, port `1883`,
   using credentials from a Home Assistant user). Planty will publish each
   plant's schedule to Home Assistant via MQTT discovery, so entities such as
   `sensor.<plant>_watering_next_due` and `binary_sensor.<plant>_watering_overdue`
   appear automatically for you to use in automations and notifications.

## Sensors (light / moisture)

Once you have a light or moisture sensor for a plant (e.g. a Zigbee soil
sensor via Zigbee2MQTT, or any device already publishing to MQTT or mirrored
into MQTT via Home Assistant's `mqtt_statestream` integration), open the
plant's page in Planty and add a sensor with the MQTT topic it publishes
readings on. Planty subscribes to that topic and shows the latest reading on
the plant's page.

## Dashboard cards

Once Planty has published a plant's schedule via MQTT discovery (see above),
you can show its status on a Home Assistant dashboard with two plain
Markdown cards (built into HA core — no HACS required). They read every
`sensor.*_next_due` / `binary_sensor.*_overdue` entity Planty has published,
so new plants and tasks show up automatically without editing the card.

Add each of these as a card on your dashboard (**Edit Dashboard → Add Card →
Manual**, then paste):

**All plants, care status:**

```yaml
type: markdown
title: 🌿 Plant Care Status
content: |-
  {%- set rows = namespace(items=[]) -%}
  {%- for state in states.sensor -%}
    {%- if state.entity_id.endswith('_next_due') and state.attributes.device_class == 'date' -%}
      {%- set overdue_id = state.entity_id | replace('sensor.', 'binary_sensor.') | replace('_next_due', '_overdue') -%}
      {%- set rows.items = rows.items + [{'name': state.name | replace(' next due', ''), 'due': state.state, 'overdue': is_state(overdue_id, 'on')}] -%}
    {%- endif -%}
  {%- endfor -%}
  {%- if rows.items | length == 0 -%}
  No plant care schedules yet — add a plant and a care task in Planty to see it here.
  {%- else -%}
  | Plant | Next due | Status |
  | --- | --- | --- |
  {% for row in rows.items | sort(attribute='due') -%}
  | {{ row.name }} | {{ row.due }} | {{ '🔴 Overdue' if row.overdue else '🟢 OK' }} |
  {% endfor -%}
  {%- endif -%}
```

**Next plant due for watering:**

```yaml
type: markdown
title: 💧 Next Up Watering
content: |-
  {%- set rows = namespace(items=[]) -%}
  {%- for state in states.sensor -%}
    {%- if state.entity_id.endswith('_watering_next_due') -%}
      {%- set rows.items = rows.items + [{'name': state.name | replace(' Watering next due', ''), 'due': state.state}] -%}
    {%- endif -%}
  {%- endfor -%}
  {%- set sorted = rows.items | sort(attribute='due') -%}
  {%- if sorted | length == 0 -%}
  No watering scheduled yet.
  {%- else -%}
  **{{ sorted[0].name }}** needs water on **{{ sorted[0].due }}**
  {%- if sorted | length > 1 %}

  Then: {{ sorted[1:] | map(attribute='name') | join(', ') }}
  {%- endif -%}
  {%- endif -%}
```

The second card matches on entity IDs ending in `_watering_next_due`, which
is how Planty names the sensor for a task whose type is "watering" and whose
label hasn't been customized. If you give a watering task a custom label,
rename that filter to match, or just use the first card.

## Calendar export

Go to **Settings → Calendar export** inside Planty for an `.ics` feed of
every care task (one recurring event per task, starting on its next due
date and repeating on its interval).

- **Download once**: click "Download .ics file" and import it into whatever
  calendar app you like.
- **Keep it live in Home Assistant**: add it as a **Remote Calendar**
  integration (Settings → Devices & Services → Add Integration → "Remote
  Calendar"), using the URL shown on the Calendar export card. Home
  Assistant's backend fetches this URL directly (not through your browser),
  so it needs the add-on's direct port (`:8080`), not the ingress panel
  address — the card fills this in for you automatically.

## Plant labels

Planty can print a label for each plant on a Brother QL, through the
[LabelForge](https://github.com/wilco20004/LabelForge) add-on. Open the
**Labels** tab, enter LabelForge's address, load its templates, tick the plants
you want and print. Labelling a whole shelf in one go is the point — the
selection is a checklist, not one plant at a time.

Planty talks to LabelForge from its **server**, not from your browser. Behind
Ingress the Planty page is served over HTTPS, and a browser will not let an
HTTPS page call a plain-HTTP add-on on the LAN. Doing it server-side also means
the printer's address is configured once rather than on every phone and laptop.

### Designing the template

Design the template in LabelForge; Planty only fills it in. Use these variables
in its text fields — anything else prints blank, and Planty warns you before it
does:

`name`, `species`, `scientific`, `location`, `light`, `watering`, `next_water`,
`tasks`, `notes`, `added`, `id`, `link`.

Give the template's **image an override variable** (any name). Planty fills it
with a QR code, drawn to that block's exact pixel size.

### A template to start from

A 62 x 29 mm die-cut label (DK-11209) with the QR code on the left. Run this
once against LabelForge and the template appears in its list, ready to edit:

```bash
curl -X POST http://<labelforge-host>:8095/api/templates \
  -H 'Content-Type: application/json' -d '{
  "name": "Plant label 62x29",
  "label_size": "62x29",
  "image": { "data": "", "variable": "qr", "x": 12, "y": 8, "width": 180, "height": 255 },
  "text_fields": [
    { "id": "name",  "x": 208, "y": 10,  "width": 476, "height": 50, "font_size": 40, "bold": true,  "align": "left", "text": "{{name}}" },
    { "id": "spec",  "x": 208, "y": 62,  "width": 476, "height": 34, "font_size": 26, "bold": false, "align": "left", "text": "{{scientific}}" },
    { "id": "where", "x": 208, "y": 100, "width": 476, "height": 64, "font_size": 24, "bold": false, "align": "left", "text": "{{location}} · {{light}}" },
    { "id": "water", "x": 208, "y": 172, "width": 476, "height": 62, "font_size": 26, "bold": true,  "align": "left", "text": "Water {{watering}}\nNext {{next_water}}" }
  ]
}'
```

Two things are worth knowing when laying a template out:

- **Give the image block room.** The QR is drawn at a whole number of pixels per
  module, and below 3 px a module it stops scanning reliably — Planty says so
  before you print. The 180 x 255 block above gives 4 px a module for a link
  like `http://homeassistant.local:8080/plants/<id>`. A longer address needs
  more room, because the plant id alone is a 36-character UUID.
- **A text field that wraps runs past its own height.** LabelForge wraps text to
  the field's width and keeps going downwards, so a long plant name will
  overwrite whatever you placed below it. Leave room for two lines.

### Scanning a label

Set **This Planty's address** to wherever Planty is reachable from your phone —
for example `http://homeassistant.local:8080`. Each label's QR then links to
`<that>/plants/<id>`, so scanning a label on a pot opens that plant's page, with
its care schedule and journal. Leave the address blank and the code holds only
the plant id.

Note that an Ingress URL is not a usable address here: it is a
browser-authenticated link into Home Assistant, not a stable address for a
phone's camera to open. Use Planty's own port (8080 by default).

## Notes

- Data (plant details, photos, schedule) is stored in this addon's `/data`
  folder, which persists across addon updates and restarts.
- Label printing (Brother QL700) is planned for a future release.
