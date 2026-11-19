#!/usr/bin/env python3
"""Sækir veðurgögn frá Open-Meteo og vistar í data/vedur.json.

Ætlað að keyra einu sinni á dag (t.d. með cron). Vefurinn les aðeins
skrána sem þetta býr til og spyr Open-Meteo aldrei sjálfur.

Notkun:  make pipeline   (eða python3 scripts/fetch_data.py)
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.getenv("VEDUR_DATA_DIR", str(ROOT / "data")))
OUT = DATA / "vedur.json"
WORLD = DATA / "countries-50m.json"
WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json"
API = "https://api.open-meteo.com/v1/forecast"

# Veðurathugunarstaðir á Íslandskortunum. "horfur" = sýndur á litlu horfukortunum.
STATIONS = [
    {"n": "Reykjavík",           "lat": 64.13, "lon": -21.90, "horfur": True},
    {"n": "Stykkishólmur",       "lat": 65.07, "lon": -22.73},
    {"n": "Ísafjörður",          "lat": 66.07, "lon": -23.13, "horfur": True},
    {"n": "Blönduós",            "lat": 65.66, "lon": -20.29},
    {"n": "Akureyri",            "lat": 65.68, "lon": -18.09, "horfur": True},
    {"n": "Raufarhöfn",          "lat": 66.45, "lon": -15.95},
    {"n": "Egilsstaðir",         "lat": 65.27, "lon": -14.40, "horfur": True},
    {"n": "Höfn",                "lat": 64.25, "lon": -15.21},
    {"n": "Kirkjubæjarklaustur", "lat": 63.79, "lon": -18.05},
    {"n": "Vestmannaeyjar",      "lat": 63.44, "lon": -20.27},
    {"n": "Hveravellir",         "lat": 64.87, "lon": -19.56},
]

# Þrýstinet yfir Norður-Atlantshafi (raðað norður → suður, vestur → austur)
GRID = {"latN": 77, "latS": 37, "lonW": -72, "lonE": 32, "step": 4}


def get_json(url, tries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "vedur-retro/1.0"})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  villa ({e}), reyni aftur…", file=sys.stderr)
            time.sleep(20 * (i + 1))


def fetch_stations(tomorrow):
    url = (f"{API}?latitude={','.join(str(s['lat']) for s in STATIONS)}"
           f"&longitude={','.join(str(s['lon']) for s in STATIONS)}"
           "&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day"
           "&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m"
           "&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max"
           "&wind_speed_unit=ms&timezone=GMT&forecast_days=8")
    raw = get_json(url)
    target = f"{tomorrow}T12:00"
    out = []
    for s, d in zip(STATIONS, raw):
        c, h = d["current"], d["hourly"]
        i = h["time"].index(target)
        out.append({
            **s,
            "now": {
                "time": c["time"], "temp": c["temperature_2m"], "code": c["weather_code"],
                "wind": c["wind_speed_10m"], "dir": c["wind_direction_10m"], "night": not c["is_day"],
            },
            "tomorrow": {
                "temp": h["temperature_2m"][i], "code": h["weather_code"][i],
                "wind": h["wind_speed_10m"][i], "dir": h["wind_direction_10m"][i],
            },
            "daily": {k: d["daily"][k] for k in
                      ("time", "weather_code", "temperature_2m_max", "temperature_2m_min", "wind_speed_10m_max")},
        })
    return out


def fetch_grid(tomorrow):
    g = GRID
    lats, lons = [], []
    for la in range(g["latN"], g["latS"] - 1, -g["step"]):
        for lo in range(g["lonW"], g["lonE"] + 1, g["step"]):
            lats.append(la)
            lons.append(lo)
    hour = f"{tomorrow}T12:00"
    url = (f"{API}?latitude={','.join(map(str, lats))}&longitude={','.join(map(str, lons))}"
           f"&hourly=pressure_msl&timezone=GMT&start_hour={hour}&end_hour={hour}")
    raw = get_json(url)
    return {**g, "time": hour, "values": [p["hourly"]["pressure_msl"][0] for p in raw]}


def write_atomic(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def main():
    DATA.mkdir(exist_ok=True)

    if not WORLD.exists():
        print("Sæki kortagrunn…")
        write_atomic(WORLD, get_json(WORLD_URL))

    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = (today + timedelta(days=1)).isoformat()

    print("Sæki stöðvagögn…")
    stations = fetch_stations(tomorrow)
    print("Sæki þrýstinet…")
    try:
        grid = fetch_grid(tomorrow)
    except Exception as e:  # noqa: BLE001
        print(f"  þrýstinet fékkst ekki: {e}", file=sys.stderr)
        grid = None

    write_atomic(OUT, {
        "generated": now.strftime("%Y-%m-%dT%H:%MZ"),
        "date": today.isoformat(),
        "stations": stations,
        "grid": grid,
    })
    print(f"Vistað í {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
