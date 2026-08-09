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

## Notes

- Data (plant details, photos, schedule) is stored in this addon's `/data`
  folder, which persists across addon updates and restarts.
- Label printing (Brother QL700) is planned for a future release.
