# Makefile fyrir vedur
# Vefurinn les aðeins data/vedur.json og data/countries-50m.json,
# sem `make pipeline` býr til (keyrt einu sinni á dag, t.d. með cron).

SHELL  := /bin/bash
PYTHON := .venv/bin/python3

.PHONY: web dev install pipeline

web:
	$(PYTHON) -m flask --app app run --debug --port 5003

dev:
	$(PYTHON) -m flask --app app run --debug --port 5003

install:
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt

# Sækir veðurgögn dagsins frá Open-Meteo (og kortagrunn ef hann vantar)
pipeline:
	$(PYTHON) scripts/fetch_data.py
