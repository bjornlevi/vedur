# Veður

Veðurfréttir að gömlum sið: fjögur veðurkort á snúningstromlu, eins og í sjónvarpinu um 1990.

1. **Veðrið** þegar gögnin voru sótt (stöðvar um allt land)
2. **Veðurkort** yfir Norður-Atlantshafi á morgun kl. 12 (jafnþrýstilínur, hæðir og lægðir)
3. **Spá** fyrir morgundaginn kl. 12
4. **Horfur** næstu sex daga

Flask þjónar kyrrstæðri síðu. Veðurgögnin eru sótt **einu sinni á dag** frá
[Open-Meteo](https://open-meteo.com/) með `scripts/fetch_data.py` og vistuð í
`data/`. Vefurinn spyr Open-Meteo aldrei sjálfur.

## Uppsetning

```bash
make install     # býr til .venv og setur upp flask + gunicorn
make pipeline    # sækir gögn í data/ (og kortagrunn ef hann vantar)
make dev         # þróunarþjónn á http://localhost:5003
```

## Á vefþjóni (bjornlevi.is/vedur)

Uppsetningarskrár eru í `deploy/` (nginx + gunicorn + systemd, eins og opin-gogn).
Appið hlustar á `127.0.0.1:8018`.

```bash
# 1. Kóði og umhverfi
sudo git clone https://github.com/bjornlevi/vedur.git /srv/vedur
cd /srv/vedur
sudo python3 -m venv .venv
sudo .venv/bin/pip install -r requirements.txt
sudo mkdir -p data
sudo chown -R web:www-data /srv/vedur

# 2. Stillingar og þjónustur
sudo cp deploy/vedur.env /etc/default/vedur
sudo cp deploy/vedur.service deploy/vedur-fetch.service deploy/vedur-fetch.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start vedur-fetch.service          # fyrsta söfnun strax
sudo systemctl enable --now vedur.service vedur-fetch.timer

# 3. nginx: bæta deploy/nginx-vedur.conf inn í server-blokkina
sudo nginx -t && sudo systemctl reload nginx
```

Gögnin eru sótt daglega kl. 18 (`vedur-fetch.timer`). Fyrsta kortið sýnir
veðrið eins og það var þá. Gagnlegar skipanir:

```bash
systemctl list-timers vedur-fetch.timer           # hvenær næst
journalctl -u vedur-fetch.service -n 20           # síðasta söfnun
journalctl -u vedur.service -f                    # vefþjónninn
```

Uppfærsla: `cd /srv/vedur && sudo -u web git pull && sudo systemctl restart vedur`.

## Skrár

| Skrá | Hlutverk |
|---|---|
| `app.py` | Flask-app: `/` og `/data/<skrá>` (aðeins `vedur.json` og `countries-50m.json`) |
| `scripts/fetch_data.py` | Sækir gögnin; stöðvalisti og þrýstinet eru skilgreind hér |
| `templates/index.html` | Síðan |
| `static/app.js` | Teiknar kortin og snýr tromlunni |
| `static/style.css` | Útlit (sjónvarp, tromla, stöng) |
| `deploy/` | systemd-þjónustur, timer, nginx og umhverfisskrá |
| `data/` | Myndað af `make pipeline`, ekki í git |

Kortagrunnur: Natural Earth í gegnum [world-atlas](https://github.com/topojson/world-atlas).
