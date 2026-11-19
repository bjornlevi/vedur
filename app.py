#!/usr/bin/env python3
"""Veðurfréttir að gömlum sið: veðurkort á snúningstromlu.

Vefurinn sjálfur er kyrrstæður (templates/index.html + static/). Veðurgögnin
eru sótt einu sinni á dag með scripts/fetch_data.py inn í data/ og þjónað
héðan; vefurinn spyr Open-Meteo aldrei sjálfur.
"""
from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, abort, render_template, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

BASE_DIR = Path(__file__).resolve().parent

# URL-forskeyti þegar appið keyrir á bak við reverse proxy, t.d. PREFIX=/vedur
PREFIX = os.getenv("PREFIX", "").rstrip("/")

# Mappan sem scripts/fetch_data.py skrifar í
DATA_DIR = Path(os.getenv("VEDUR_DATA_DIR", str(BASE_DIR / "data")))

# Einu skrárnar sem /data/ þjónar, og hve lengi vafrar mega geyma þær (sek.)
DATA_FILES = {
    "vedur.json": 15 * 60,              # uppfærist daglega
    "countries-50m.json": 7 * 24 * 3600,  # kortagrunnur, breytist ekki
}


def create_app() -> Flask:
    app = Flask(__name__)

    if PREFIX:
        app.config["APPLICATION_ROOT"] = PREFIX
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

        class PrefixMiddleware:
            def __init__(self, app, prefix: str):
                self.app = app
                self.prefix = prefix

            def __call__(self, environ, start_response):
                path_info = environ.get("PATH_INFO", "")
                if path_info.startswith(self.prefix):
                    environ["SCRIPT_NAME"] = self.prefix
                    environ["PATH_INFO"] = path_info[len(self.prefix):] or "/"
                return self.app(environ, start_response)

        app.wsgi_app = PrefixMiddleware(app.wsgi_app, PREFIX)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/data/<filename>")
    def data_file(filename: str):
        if filename not in DATA_FILES:
            abort(404)
        if not (DATA_DIR / filename).exists():
            abort(404, description="Gögn vantar. Keyrðu: make pipeline")
        return send_from_directory(DATA_DIR, filename, max_age=DATA_FILES[filename])

    return app


app = create_app()


if __name__ == "__main__":
    create_app().run(debug=True)
