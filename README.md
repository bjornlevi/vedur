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

```bash
PREFIX=/vedur .venv/bin/gunicorn wsgi:app
```

`PREFIX` stýrir öllum slóðum (static, gögn), eins og í opin_gogn.

Gögnin eru uppfærð daglega með cron, t.d. kl. 18:

```
0 18 * * * cd /slóð/að/vedur && make pipeline >> data/fetch.log 2>&1
```

Fyrsta kortið sýnir veðrið eins og það var þegar `make pipeline` keyrði.

## Skrár

| Skrá | Hlutverk |
|---|---|
| `app.py` | Flask-app: `/` og `/data/<skrá>` (aðeins `vedur.json` og `countries-50m.json`) |
| `scripts/fetch_data.py` | Sækir gögnin; stöðvalisti og þrýstinet eru skilgreind hér |
| `templates/index.html` | Síðan |
| `static/app.js` | Teiknar kortin og snýr tromlunni |
| `static/style.css` | Útlit (sjónvarp, tromla, stöng) |
| `data/` | Myndað af `make pipeline`, ekki í git |

Kortagrunnur: Natural Earth í gegnum [world-atlas](https://github.com/topojson/world-atlas).
