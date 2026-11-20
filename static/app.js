/* Veðurfréttir að gömlum sið – snúningsspjald með fjórum kortum. */
(() => {
  'use strict';

  const W = 800, H = 600;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const DAYS = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
  const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Stöðvar og þrýstinet eru skilgreind í fetch_data.py og koma með gagnaskránni
  let STATIONS = [], OUTLOOK = [];

  // ---------- Hjálparföll ----------
  const pad2 = n => String(n).padStart(2, '0');
  const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
  const dayName = d => DAYS[d.getUTCDay()];
  const longDate = d => `${cap(dayName(d))} ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
  const fmtT = t => { const r = Math.round(t); return (r < 0 ? '−' : '') + Math.abs(r); };

  function beaufort(ms) {
    const lim = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
    let b = 0; while (b < lim.length && ms >= lim[b]) b++; return b;
  }
  const compass = deg => ['N', 'NA', 'A', 'SA', 'S', 'SV', 'V', 'NV'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];

  function symbolFor(code, night) {
    let s;
    if (code <= 1) s = 'sun';
    else if (code === 2) s = 'partly';
    else if (code === 3) s = 'cloud';
    else if (code === 45 || code === 48) s = 'fog';
    else if (code >= 51 && code <= 55) s = 'drizzle';
    else if (code === 56 || code === 57 || code === 66 || code === 67) s = 'sleet';
    else if (code >= 61 && code <= 65) s = 'rain';
    else if (code >= 71 && code <= 77) s = 'snow';
    else if (code >= 80 && code <= 82) s = 'showers';
    else if (code === 85 || code === 86) s = 'snowshowers';
    else if (code >= 95) s = 'thunder';
    else s = 'cloud';
    if (night && s === 'sun') s = 'moon';
    if (night && s === 'partly') s = 'partlymoon';
    return s;
  }
  const SYMBOL_TEXT = {
    sun: 'heiðskírt', moon: 'heiðskírt', partly: 'léttskýjað', partlymoon: 'léttskýjað', cloud: 'skýjað',
    fog: 'þoka', drizzle: 'súld', sleet: 'slydda', rain: 'rigning', snow: 'snjókoma',
    showers: 'skúrir', snowshowers: 'él', thunder: 'þrumuveður',
  };

  const el = (parent, tag, attrs = {}, text) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };

  // ---------- Tákn (seglarnir) ----------
  const CLOUD = 'M-13 10H13A7 7 0 0 0 14-4A10 10 0 0 0-3-9A8 8 0 0 0-16-1A5.5 5.5 0 0 0-13 10Z';

  function buildDefs() {
    const defs = document.querySelector('#defs defs');

    // Skuggi undir seglum
    const f = el(defs, 'filter', { id: 'magnet', x: '-30%', y: '-30%', width: '170%', height: '170%' });
    el(f, 'feDropShadow', { dx: 1.4, dy: 2.4, stdDeviation: 1.1, 'flood-color': '#000', 'flood-opacity': .45 });

    // Örlítið handteiknuð strandlína
    const w = el(defs, 'filter', { id: 'wobble', x: '-5%', y: '-5%', width: '110%', height: '110%' });
    el(w, 'feTurbulence', { type: 'fractalNoise', baseFrequency: .035, numOctaves: 2, seed: 4, result: 'n' });
    el(w, 'feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 3.5 });

    const sym = id => el(defs, 'symbol', { id: 's-' + id, viewBox: '-25 -25 50 50', overflow: 'visible' });
    const cloud = (g, tf = '', fill = '#ffffff', stroke = '#56646e') =>
      el(g, 'path', { d: CLOUD, transform: tf, fill, stroke, 'stroke-width': 2.2, 'stroke-linejoin': 'round' });
    const sun = (g, tf = '') => {
      const s = el(g, 'g', { transform: tf });
      let d = '';
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, da = .2;
        const p = (r, b) => `${(r * Math.cos(b)).toFixed(2)} ${(r * Math.sin(b)).toFixed(2)}`;
        d += `M${p(12.5, a - da)}L${p(22, a)}L${p(12.5, a + da)}Z`;
      }
      el(s, 'path', { d, fill: '#f7b500', stroke: '#c46f00', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
      el(s, 'circle', { r: 12, fill: '#ffd425', stroke: '#c46f00', 'stroke-width': 2 });
    };
    const moon = (g, tf = '') =>
      el(g, 'path', { d: 'M5-12A13 13 0 1 0 5 12A10 10 0 1 1 5-12Z', transform: tf, fill: '#f4e7a1', stroke: '#a88c22', 'stroke-width': 1.8 });
    const drops = (g, n = 3, y = 9) => {
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 9 + 2;
        el(g, 'line', { x1: x, y1: y, x2: x - 3.5, y2: y + 9, stroke: '#1b5fc4', 'stroke-width': 3.2, 'stroke-linecap': 'round' });
      }
    };
    const star = (g, x, y, r = 4.6) => {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3 + Math.PI / 2;
        el(g, 'line', {
          x1: x - r * Math.cos(a), y1: y - r * Math.sin(a), x2: x + r * Math.cos(a), y2: y + r * Math.sin(a),
          stroke: '#1d3f96', 'stroke-width': 2.2, 'stroke-linecap': 'round',
        });
      }
    };

    sun(sym('sun'));
    moon(sym('moon'));
    cloud(sym('cloud'), 'scale(1.15)');

    let g = sym('partly'); sun(g, 'translate(-6 -7) scale(.8)'); cloud(g, 'translate(4 6) scale(.85)');
    g = sym('partlymoon'); moon(g, 'translate(-6 -7) scale(.8)'); cloud(g, 'translate(4 6) scale(.85)');

    g = sym('rain'); cloud(g, 'translate(0 -6)'); drops(g);
    g = sym('drizzle'); cloud(g, 'translate(0 -6)');
    [[-8, 11], [1, 11], [10, 11], [-4, 18], [5, 18]].forEach(([x, y]) => el(g, 'circle', { cx: x, cy: y, r: 2.3, fill: '#1b5fc4' }));
    g = sym('snow'); cloud(g, 'translate(0 -6)'); star(g, -9, 14); star(g, 1, 17); star(g, 11, 13);
    g = sym('sleet'); cloud(g, 'translate(0 -6)'); drops(g, 2, 9); star(g, 10, 15);
    g = sym('showers'); sun(g, 'translate(-9 -11) scale(.65)'); cloud(g, 'translate(2 -3) scale(.85)'); drops(g, 3, 10);
    g = sym('snowshowers'); sun(g, 'translate(-9 -11) scale(.65)'); cloud(g, 'translate(2 -3) scale(.85)'); star(g, -7, 15); star(g, 3, 18); star(g, 12, 14);
    g = sym('thunder'); cloud(g, 'translate(0 -7)', '#9aa5ae', '#3e4a52');
    el(g, 'path', { d: 'M1 3L-7 15H-1L-4 24L8 10H2L5 3Z', fill: '#ffd425', stroke: '#9a6a00', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    g = sym('fog');
    [-8, 0, 8].forEach((y, i) => el(g, 'line', {
      x1: -18 + (i % 2) * 4, y1: y, x2: 18 - (i % 2) * 4, y2: y, stroke: '#7b8891', 'stroke-width': 4.5, 'stroke-linecap': 'round',
    }));
  }

  // ---------- Teikniföll ----------
  function plate(svg, x, y, title, sub) {
    const g = el(svg, 'g', { class: 'plate', filter: 'url(#magnet)' });
    const r = el(g, 'rect', { x, y, height: 46, rx: 3, fill: '#1c2944' });
    const t = el(g, 'text', {
      x: x + 16, y: y + 32, fill: '#f6f1e2', 'font-size': 27, 'font-weight': 600,
      'font-family': 'Jost, Futura, sans-serif', 'letter-spacing': '.04em',
    }, title);
    r.setAttribute('width', t.getComputedTextLength() + 32);
    if (sub) {
      const r2 = el(g, 'rect', { x, y: y + 52, height: 30, rx: 3, fill: '#f6f1e2', stroke: '#1c2944', 'stroke-width': 1.5 });
      const t2 = el(g, 'text', {
        x: x + 12, y: y + 73, fill: '#1c2944', 'font-size': 18, 'font-weight': 500,
        'font-family': 'Jost, Futura, sans-serif',
      }, sub);
      r2.setAttribute('width', t2.getComputedTextLength() + 24);
    }
  }

  function windArrow(g, x, y, dirDeg, ms, startR, scale = 1) {
    const bf = beaufort(ms);
    if (bf === 0) return;
    const a = dirDeg * Math.PI / 180;
    const ux = Math.sin(a), uy = -Math.cos(a);           // í áttina sem vindurinn kemur úr
    const L = (30 + Math.ceil(bf / 2) * 5) * scale;
    const x0 = x + ux * startR, y0 = y + uy * startR;
    const x1 = x + ux * (startR + L), y1 = y + uy * (startR + L);
    const sw = 2.6 * scale;
    const grp = el(g, 'g', { filter: 'url(#magnet)', stroke: '#141414', 'stroke-width': sw, 'stroke-linecap': 'round', fill: 'none' });
    let d = `M${x0} ${y0}L${x1} ${y1}`;
    // Fjaðrir: heil fjöður = 2 vindstig, hálf = 1
    // Halla út frá stöðinni (60° frá skaftinu), eins og fjaðrir aftast á ör
    const fx = Math.cos(a - 5 * Math.PI / 6), fy = Math.sin(a - 5 * Math.PI / 6);
    const full = Math.floor(bf / 2), half = bf % 2;
    const gap = 5.5 * scale, fl = 13 * scale;
    for (let i = 0; i < full + half; i++) {
      const px = x1 - ux * gap * i, py = y1 - uy * gap * i;
      const len = i < full ? fl : fl * .55;
      d += `M${px} ${py}L${px + fx * len} ${py + fy * len}`;
    }
    el(grp, 'path', { d });
    // Örvaroddur við stöðina
    const hx = -ux, hy = -uy, s = 7 * scale;
    el(grp, 'path', {
      d: `M${x0 - hx * s + -hy * s * .6} ${y0 - hy * s + hx * s * .6}L${x0} ${y0}L${x0 - hx * s - -hy * s * .6} ${y0 - hy * s - hx * s * .6}`,
      'stroke-linejoin': 'round',
    });
  }

  function tempTile(g, x, y, t, size = 21, leftOf = false) {
    const txt = fmtT(t);
    const w = (txt.length * .62 + .5) * size, h = size * 1.3;
    if (leftOf) x -= w;
    const grp = el(g, 'g', { filter: 'url(#magnet)' });
    el(grp, 'rect', { x, y: y - h / 2, width: w, height: h, rx: 3, fill: '#fffdf6', stroke: '#2a2a2a', 'stroke-width': 1.2 });
    el(grp, 'text', {
      x: x + w / 2, y: y + size * .36, 'text-anchor': 'middle', 'font-size': size, 'font-weight': 700,
      fill: t >= 0.5 ? '#b3121b' : (t <= -0.5 ? '#123a9c' : '#1a1a1a'), 'font-family': 'Jost, Futura, sans-serif',
    }, txt);
  }

  function useSymbol(g, id, x, y, size, title) {
    const grp = el(g, 'g', { filter: 'url(#magnet)' });
    el(grp, 'use', { href: '#s-' + id, x: x - size / 2, y: y - size / 2, width: size, height: size });
    if (title) el(grp, 'title', {}, title);
  }

  // ---------- Íslandskort ----------
  function glaciers() {
    // Grófar útlínur helstu jökla: [lon, lat, hálfbreidd (°lon), hálfhæð (°lat), snúningur]
    const list = [
      [-16.75, 64.42, 1.42, .40, 0],     // Vatnajökull
      [-20.15, 64.65, .33, .19, -40],    // Langjökull
      [-18.85, 64.81, .38, .15, 0],      // Hofsjökull
      [-19.10, 63.66, .38, .11, 0],      // Mýrdalsjökull
      [-19.62, 63.63, .14, .045, 0],     // Eyjafjallajökull
      [-23.78, 64.81, .07, .03, 0],      // Snæfellsjökull
      [-22.30, 66.17, .20, .08, -20],    // Drangajökull
    ];
    return list.map(([lon, lat, rx, ry, rot], k) => {
      const ring = [];
      const r = rot * Math.PI / 180;
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * 2 * Math.PI;
        const wob = 1 + .09 * Math.sin(3 * a + k) + .06 * Math.cos(5 * a + 2 * k);
        const ex = Math.cos(a) * rx * wob, ey = Math.sin(a) * ry * wob;
        ring.push([lon + ex * Math.cos(r) - ey * Math.sin(r) * 2.2, lat + ex * Math.sin(r) / 2.2 + ey * Math.cos(r)]);
      }
      ring[ring.length - 1] = ring[0];
      const feat = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } };
      if (d3.geoArea(feat) > 2 * Math.PI) ring.reverse();
      return feat;
    });
  }

  function icelandProjection(iceland, box) {
    return d3.geoConicConformal().parallels([64.25, 65.75]).rotate([19, 0]).fitExtent(box, iceland);
  }

  function drawIceland(g, iceland, proj, clipId) {
    const path = d3.geoPath(proj);
    const d = path(iceland);
    el(el(g, 'clipPath', { id: clipId }), 'path', { d });
    // Skuggi strandar í sjónum
    el(g, 'path', { d, fill: 'none', stroke: '#5f93b0', 'stroke-width': 7, 'stroke-linejoin': 'round', opacity: .55, filter: 'url(#wobble)' });
    el(g, 'path', { d, fill: '#e9e0b4', stroke: '#4a4130', 'stroke-width': 1.6, 'stroke-linejoin': 'round', filter: 'url(#wobble)' });
    const gl = el(g, 'g', { 'clip-path': `url(#${clipId})` });
    for (const f of glaciers()) el(gl, 'path', { d: path(f), fill: '#fbfdff', stroke: '#9fb3c2', 'stroke-width': 1 });
  }

  function seaBackground(svg) {
    el(svg, 'rect', { width: W, height: H, fill: '#8fb8cf' });
  }

  function stationMap(svg, iceland, values, title, sub) {
    svg.replaceChildren();
    seaBackground(svg);
    const proj = icelandProjection(iceland, [[50, 110], [750, 575]]);
    drawIceland(el(svg, 'g'), iceland, proj, svg.id + '-clip');
    plate(svg, 22, 20, title, sub);

    const arrows = el(svg, 'g'), syms = el(svg, 'g'), temps = el(svg, 'g');
    STATIONS.forEach((s, i) => {
      const v = values[i];
      if (!v) return;
      const [x, y] = proj([s.lon, s.lat]);
      const sym = symbolFor(v.code, v.night);
      windArrow(arrows, x, y, v.dir, v.wind, 20);
      useSymbol(syms, sym, x, y, 46,
        `${s.n}: ${SYMBOL_TEXT[sym]}, ${fmtT(v.temp)}°, ${compass(v.dir)} ${Math.round(v.wind)} m/s`);
      // Vindör til austurs → hitatala vinstra megin svo þær skarist ekki
      const east = beaufort(v.wind) > 0 && Math.sin(v.dir * Math.PI / 180) > .35;
      if (east) tempTile(temps, x - 23, y + 1, v.temp, 21, true);
      else tempTile(temps, x + 21, y + 1, v.temp);
    });
    windLegend(svg);
  }

  function windLegend(svg) {
    const g = el(svg, 'g', { transform: 'translate(596 538)', 'font-family': 'Jost, sans-serif', 'font-size': 13, fill: '#1c2944' });
    el(g, 'rect', { x: -10, y: -16, width: 196, height: 52, rx: 3, fill: '#f6f1e2', opacity: .9, stroke: '#1c2944', 'stroke-width': 1 });
    el(g, 'text', { x: 0, y: 0 }, 'Vindörvar: fjöður = 2 vindstig');
    el(g, 'text', { x: 0, y: 23 }, 'Dæmi: 5 vindstig af V');
    windArrow(g, 176, 18, 270, 9, 0, .7);
  }

  // ---------- Kort 4: Horfur ----------
  function outlookMap(svg, iceland, daily, startDate) {
    svg.replaceChildren();
    el(svg, 'rect', { width: W, height: H, fill: '#e9e3cf' });
    plate(svg, 22, 20, 'Horfur næstu daga');

    const cw = 252, ch = 238, x0 = 22, y0 = 108;
    for (let k = 0; k < 6; k++) {
      const di = k + 2;                         // dagur 2..7 (eftir morgundaginn)
      const date = addDays(startDate, di);
      const cx = x0 + (k % 3) * (cw + 3), cy = y0 + Math.floor(k / 3) * (ch + 8);
      const g = el(svg, 'g');
      el(g, 'rect', { x: cx, y: cy, width: cw, height: ch, rx: 4, fill: '#8fb8cf', stroke: '#1c2944', 'stroke-width': 1.5 });
      el(g, 'text', {
        x: cx + 12, y: cy + 26, 'font-size': 20, 'font-weight': 600, fill: '#1c2944', 'font-family': 'Jost, sans-serif',
      }, `${cap(dayName(date))} ${date.getUTCDate()}.`);

      const proj = icelandProjection(iceland, [[cx + 14, cy + 40], [cx + cw - 14, cy + ch - 34]]);
      drawIceland(el(g, 'g'), iceland, proj, `${svg.id}-clip${k}`);

      let tmin = Infinity, tmax = -Infinity, wmax = 0;
      const syms = el(g, 'g'), temps = el(g, 'g');
      OUTLOOK.forEach(si => {
        const d = daily[si];
        if (!d) return;
        const s = STATIONS[si];
        const [x, y] = proj([s.lon, s.lat]);
        const code = d.weather_code[di], tx = d.temperature_2m_max[di], tn = d.temperature_2m_min[di];
        tmin = Math.min(tmin, tn); tmax = Math.max(tmax, tx); wmax = Math.max(wmax, d.wind_speed_10m_max[di]);
        const sym = symbolFor(code, false);
        useSymbol(syms, sym, x - 4, y, 34, `${s.n}: ${SYMBOL_TEXT[sym]}, hiti ${fmtT(tn)} til ${fmtT(tx)}°`);
        tempTile(temps, x + 11, y + 6, tx, 14);
      });
      if (isFinite(tmin)) {
        el(g, 'text', {
          x: cx + 12, y: cy + ch - 11, 'font-size': 14.5, fill: '#1c2944', 'font-family': 'Jost, sans-serif', 'font-weight': 500,
        }, `Hiti ${fmtT(tmin)} til ${fmtT(tmax)}° · vindur allt að ${Math.round(wmax)} m/s`);
      }
    }
  }

  // ---------- Kort 2: Veðurkort Atlantshafs ----------
  function upsample(v, nx, ny, f) {
    const w = (nx - 1) * f + 1, h = (ny - 1) * f + 1, out = new Float64Array(w * h);
    const g = (i, j) => v[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
    const cr = (p0, p1, p2, p3, t) => p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    for (let Y = 0; Y < h; Y++) {
      const y = Y / f, j = Math.min(ny - 2, Math.floor(y)), ty = y - j;
      for (let X = 0; X < w; X++) {
        const x = X / f, i = Math.min(nx - 2, Math.floor(x)), tx = x - i;
        const r = [-1, 0, 1, 2].map(d => cr(g(i - 1, j + d), g(i, j + d), g(i + 1, j + d), g(i + 2, j + d), tx));
        out[Y * w + X] = cr(r[0], r[1], r[2], r[3], ty);
      }
    }
    return { out, w, h };
  }

  function atlanticMap(svg, world, grid, when) {
    svg.replaceChildren();
    const proj = d3.geoConicConformal().parallels([52, 68]).rotate([17, 0])
      .fitExtent([[0, 30], [W, H + 10]], {
        type: 'MultiPoint',
        coordinates: [[-50, 47], [-17, 47], [16, 47], [-58, 72], [-17, 74], [24, 72]],
      })
      .clipExtent([[0, 0], [W, H]]);
    const path = d3.geoPath(proj);

    el(svg, 'rect', { width: W, height: H, fill: '#cfe0e6' });
    el(svg, 'path', { d: path(d3.geoGraticule().step([10, 10])()), fill: 'none', stroke: '#9fbcc8', 'stroke-width': .8, 'stroke-dasharray': '3 4' });
    el(svg, 'path', { d: path(world.land), fill: '#efe7c8', stroke: '#5b5340', 'stroke-width': 1.2, 'stroke-linejoin': 'round', filter: 'url(#wobble)' });
    el(svg, 'path', { d: path(world.iceland), fill: '#e6d79a', stroke: '#3f3826', 'stroke-width': 1.6, filter: 'url(#wobble)' });

    if (grid) {
      const f = 4;
      const STEP = grid.step, LAT_N = grid.latN, LON_W = grid.lonW;
      const NY = (grid.latN - grid.latS) / STEP + 1, NX = (grid.lonE - grid.lonW) / STEP + 1;
      const { out, w, h } = upsample(grid.values, NX, NY, f);
      const toLL = (x, y) => [LON_W + (x - .5) / f * STEP, LAT_N - (y - .5) / f * STEP];
      const lo = Math.floor(d3.min(out) / 5) * 5, hi = Math.ceil(d3.max(out) / 5) * 5;
      const contours = d3.contours().size([w, h]).thresholds(d3.range(lo, hi + 1, 5))(Array.from(out));
      const onEdge = ([x, y]) => x <= .6 || x >= w - .6 || y <= .6 || y >= h - .6;
      const line = d3.line().curve(d3.curveCatmullRom.alpha(.5));
      const lines = el(svg, 'g', { fill: 'none', stroke: '#1d1d1d', 'stroke-width': 2.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      const labels = [];

      for (const c of contours) {
        for (const poly of c.coordinates) for (const ring of poly) {
          const n = ring.length - 1;   // síðasti punktur = fyrsti
          let b = -1;
          for (let i = 0; i < n; i++) if (onEdge(ring[i])) { b = i; break; }
          const segs = [];
          if (b < 0) {
            segs.push({ pts: ring.map(p => proj(toLL(...p))), closed: true });
          } else {
            let cur = [];
            for (let k = 0; k <= n; k++) {
              const p = ring[(b + k) % n];
              if (onEdge(p)) { if (cur.length > 2) segs.push({ pts: cur }); cur = []; }
              else cur.push(proj(toLL(...p)));
            }
            if (cur.length > 2) segs.push({ pts: cur });
          }
          for (const s of segs) {
            const pts = s.pts.filter(Boolean);
            if (pts.length < 3) continue;
            el(lines, 'path', { d: line(pts) + (s.closed ? 'Z' : '') });
            // Merking á línuna
            const m = pts[Math.floor(pts.length / 2)];
            if (m[0] > 40 && m[0] < W - 40 && m[1] > 120 && m[1] < H - 25 &&
                labels.every(l => Math.hypot(l[0] - m[0], l[1] - m[1]) > 85)) {
              labels.push([m[0], m[1], c.value]);
            }
          }
        }
      }
      const lg = el(svg, 'g', { 'font-family': 'Jost, sans-serif', 'font-size': 14, 'font-weight': 600, 'text-anchor': 'middle' });
      for (const [x, y, v] of labels) {
        el(lg, 'text', { x, y: y + 5, fill: '#1d1d1d', stroke: '#cfe0e6', 'stroke-width': 5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, v);
      }

      // Hæðir og lægðir
      const R = 9, found = [];
      for (let Y = R; Y < h - R; Y++) for (let X = R; X < w - R; X++) {
        const v = out[Y * w + X];
        let isMin = true, isMax = true;
        for (let dy = -R; dy <= R && (isMin || isMax); dy++) for (let dx = -R; dx <= R; dx++) {
          if (!dx && !dy) continue;
          const u = out[(Y + dy) * w + X + dx];
          if (u < v) isMin = false;
          if (u > v) isMax = false;
        }
        const type = isMin && v < 1012 ? 'L' : isMax && v > 1016 ? 'H' : null;
        if (type && found.every(q => Math.hypot(q.X - X, q.Y - Y) > 2 * R)) found.push({ X, Y, v, type });
      }
      const hg = el(svg, 'g', { 'font-family': 'Jost, sans-serif', 'text-anchor': 'middle' });
      for (const q of found) {
        const p = proj(toLL(q.X, q.Y));
        if (!p || p[0] < 20 || p[0] > W - 20 || p[1] < 110 || p[1] > H - 10) continue;
        const col = q.type === 'L' ? '#b01622' : '#123a9c';
        const g = el(hg, 'g', { filter: 'url(#magnet)' });
        el(g, 'text', { x: p[0], y: p[1] + 14, 'font-size': 46, 'font-weight': 700, fill: col, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, q.type);
        el(g, 'text', { x: p[0], y: p[1] + 34, 'font-size': 15, 'font-weight': 600, fill: col, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, Math.round(q.v));
        el(g, 'title', {}, `${q.type === 'L' ? 'Lægð' : 'Hæð'}, ${Math.round(q.v)} hPa`);
      }
    } else {
      el(svg, 'text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-size': 26, fill: '#1c2944', 'font-family': 'Jost, sans-serif' }, 'Þrýstigögn fengust ekki');
    }

    plate(svg, 22, 20, 'Veðurkort', `${cap(dayName(when))} kl. 12`);
    const g = el(svg, 'g', { 'font-family': 'Jost, sans-serif', 'font-size': 13, fill: '#1c2944' });
    el(g, 'rect', { x: 610, y: 560, width: 172, height: 26, rx: 3, fill: '#f6f1e2', opacity: .9, stroke: '#1c2944' });
    el(g, 'text', { x: 620, y: 578 }, 'Jafnþrýstilínur á 5 hPa bili');
  }

  // ---------- Gögn ----------
  // Allt kemur úr kyrrstæðum skrám sem scripts/fetch_data.py uppfærir einu sinni á dag.
  // Flask setur slóðirnar (með forskeyti, t.d. /vedur) í window.VEDUR.
  const CFG = window.VEDUR || { data: 'data/vedur.json', world: 'data/countries-50m.json' };
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} – ${url}`);
    return r.json();
  }

  async function loadWorld() {
    const topo = await getJSON(CFG.world);
    const iceGeom = topo.objects.countries.geometries.filter(g => g.id === '352');
    return {
      land: topojson.merge(topo, topo.objects.countries.geometries),
      iceland: topojson.merge(topo, iceGeom),
    };
  }

  // ---------- Snúningur ----------
  // Spjaldið er ferstrendingur (tromla) á lóðréttri stöng: snýst frá vinstri til hægri.
  // Snúningurinn er reiknaður ramma fyrir ramma svo hægt sé að skyggja hliðarnar
  // eftir halla og draga myndavélina aðeins frá á meðan.
  const prism = document.getElementById('prism');
  const stage = document.getElementById('stage');
  const faces = [...document.querySelectorAll('.face')];
  const shades = faces.map(f => f.appendChild(Object.assign(document.createElement('div'), { className: 'shade' })));
  const dots = [...document.querySelectorAll('#dots button')];
  const TURN_MS = 1100;                 // tími eins snúnings (90°), um sekúnda eins og í gömlu tromlunni
  const ZOOM = .16;                     // hve mikið myndavélin dregur sig frá í miðjum snúningi

  let step = 0, angle = 0, zoom = 0, anim = null, depthHalf = 300, autoTimer = null;
  const faceIndex = () => ((step % 4) + 4) % 4;

  function render() {
    prism.style.transform = `translateZ(${-depthHalf}px) rotateY(${-angle}deg)`;
    stage.style.transform = `scale(${1 - zoom})`;
    faces.forEach((f, i) => {
      const c = Math.cos((angle - i * 90) * Math.PI / 180);
      // Hlið sem snýr beint fram er björt, hallandi hliðar dekkri
      shades[i].style.opacity = c > 0 ? Math.min(1, (1 - c) * .95).toFixed(3) : 1;
    });
  }

  function layout() {
    depthHalf = stage.offsetWidth / 2;
    stage.style.perspective = `${depthHalf * 2.6}px`;
    faces.forEach((f, i) => {
      f.style.transform = `rotateY(${i * 90}deg) translateZ(${depthHalf}px)`;
    });
    render();
  }

  // Örlítið bakkað í byrjun og yfirskot í lokin, eins og þung vél
  function ease(x) {
    const c1 = .35, c2 = c1 * 1.525;
    return x < .5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  }

  function animate() {
    cancelAnimationFrame(anim);
    const from = angle, to = step * 90, z0 = zoom;
    // Snúningurinn er kjarni vefsins og keyrir því alltaf, líka þótt stýrikerfið biðji um minni hreyfingu
    const dur = TURN_MS * Math.sqrt(Math.max(1, Math.abs(to - from) / 90));
    const t0 = performance.now();
    sound.turn(dur / 1000);
    const frame = t => {
      const p = Math.min(1, (t - t0) / dur);
      angle = from + (to - from) * ease(p);
      zoom = Math.max(z0 * (1 - p), ZOOM * Math.sin(Math.PI * Math.min(1, p * 1.15)));
      if (p >= 1) { angle = to; zoom = 0; }
      render();
      anim = p < 1 ? requestAnimationFrame(frame) : null;
    };
    anim = requestAnimationFrame(frame);
  }

  function apply(instant) {
    dots.forEach((b, i) => b.setAttribute('aria-current', String(i === faceIndex())));
    if (instant) { angle = step * 90; render(); } else animate();
  }
  const next = () => { step++; apply(); };
  const prev = () => { step--; apply(); };
  function go(i) {
    let d = (i - faceIndex() + 4) % 4;
    if (!d) return;
    if (d === 3) d = -1;
    step += d; apply();
  }
  function setAuto(on) {
    clearInterval(autoTimer);
    autoTimer = on ? setInterval(next, 9000) : null;
  }
  const userAction = fn => (...a) => { fn(...a); if (autoTimer) setAuto(true); };

  document.getElementById('next').addEventListener('click', userAction(next));
  document.getElementById('prev').addEventListener('click', userAction(prev));
  stage.addEventListener('click', userAction(next));
  dots.forEach(b => b.addEventListener('click', userAction(() => go(+b.dataset.go))));
  document.getElementById('auto').addEventListener('change', e => setAuto(e.target.checked));
  document.getElementById('crtToggle').addEventListener('change', e =>
    document.getElementById('screen').classList.toggle('crt-off', !e.target.checked));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); userAction(next)(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); userAction(prev)(); }
    else if (/^[1-4]$/.test(e.key)) userAction(go)(+e.key - 1);
  });

  new ResizeObserver(layout).observe(stage);

  // Vélarhljóð: suð meðan spjaldið snýst og högg þegar það stöðvast
  const sound = (() => {
    let ctx = null;
    const box = document.getElementById('sound');
    return {
      turn(dur = 1.9) {
        if (!box.checked) return;
        try {
          ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
          const t = ctx.currentTime;
          const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
          const noise = ctx.createBufferSource(); noise.buffer = buf;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 180; bp.Q.value = 2;
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(.35, t + .2);
          ng.gain.setValueAtTime(.35, t + dur - .35); ng.gain.linearRampToValueAtTime(0, t + dur);
          noise.connect(bp).connect(ng).connect(ctx.destination); noise.start(t);
          const o = ctx.createOscillator(), og = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(110, t + dur); o.frequency.exponentialRampToValueAtTime(45, t + dur + .2);
          og.gain.setValueAtTime(0, t); og.gain.setValueAtTime(.6, t + dur); og.gain.exponentialRampToValueAtTime(.001, t + dur + .25);
          o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + dur + .3);
        } catch (e) { /* ekkert hljóð */ }
      },
    };
  })();

  // Pappírsáferð
  (function grain() {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'), img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 200 + Math.random() * 55;
      img.data[i] = v; img.data[i + 1] = v * .98; img.data[i + 2] = v * .93; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
  })();

  // ---------- Ræsing ----------
  async function main() {
    buildDefs();
    const startFace = +location.hash.slice(1);       // t.d. index.html#2 opnar á korti 2
    if (startFace >= 1 && startFace <= 4) step = startFace - 1;
    layout();
    apply(true);
    const introSub = document.getElementById('introSub');
    introSub.textContent = 'Augnablik…';
    const minIntro = new Promise(r => setTimeout(r, 1800));

    try {
      const [world, data] = await Promise.all([
        loadWorld(),
        getJSON(CFG.data),
        document.fonts ? document.fonts.ready : null,
      ]);
      STATIONS = data.stations;
      OUTLOOK = STATIONS.map((s, i) => s.horfur ? i : -1).filter(i => i >= 0);
      const grid = data.grid;

      // Dagsetningar miðast við hvenær gögnin voru sótt, ekki klukku lesandans
      const today = new Date(data.date + 'T00:00Z');
      const tomorrow = addDays(today, 1);

      // Kort 1: veðrið þegar gögnin voru sótt
      const ct = new Date(STATIONS[0].now.time + 'Z');
      stationMap(document.getElementById('face0'), world.iceland, STATIONS.map(s => s.now),
        `Veðrið kl. ${ct.getUTCHours()}`, longDate(ct));

      // Kort 2: veðurkort yfir Atlantshafi
      atlanticMap(document.getElementById('face1'), world, grid, tomorrow);

      // Kort 3: spá morgundagsins kl. 12
      stationMap(document.getElementById('face2'), world.iceland, STATIONS.map(s => s.tomorrow),
        `Spá: ${dayName(tomorrow)} kl. 12`, longDate(tomorrow));

      // Kort 4: horfur
      outlookMap(document.getElementById('face3'), world.iceland, STATIONS.map(s => s.daily), today);

      const intro = document.getElementById('intro');
      if (startFace) intro.style.transition = 'none'; else await minIntro;
      intro.classList.add('hidden');
    } catch (e) {
      console.error('[vedur]', e);
      introSub.textContent = 'Engin veðurgögn fundust. Keyrðu: make pipeline';
    }
  }

  main();
})();
