/* =============================================
   DR. TOBIAS GLAS – MAIN JS
   ============================================= */

// ═══════════════════════════════════════════
// HERO – ANIMIERTE BAYERNKARTE (Canvas 2D)
// ═══════════════════════════════════════════
(function () {
  var canvas = document.getElementById('heroCanvas');
  var heroEl = document.getElementById('hero');
  if (!canvas || !heroEl) return;
  var ctx = canvas.getContext('2d');

  // ── Städte (echte WGS-84-Koordinaten) ────
  var CITIES = [
    { lon: 11.434, lat: 48.260, label: 'Dachau',     gold: true,  sz: 2.0, lbl: true  },
    { lon: 11.582, lat: 48.135, label: 'München',    gold: false, sz: 1.3, lbl: true  },
    { lon: 11.078, lat: 49.453, label: 'Nürnberg',   gold: false, sz: 1.1, lbl: true  },
    { lon: 10.898, lat: 48.371, label: 'Augsburg',   gold: false, sz: 1.0, lbl: true  },
    { lon:  9.931, lat: 49.794, label: 'Würzburg',   gold: false, sz: 1.0, lbl: true  },
    { lon: 12.101, lat: 49.017, label: 'Regensburg', gold: false, sz: 1.0, lbl: true  },
    { lon: 11.422, lat: 48.763, label: 'Ingolstadt', gold: false, sz: 0.8, lbl: false },
    { lon: 11.578, lat: 49.946, label: 'Bayreuth',   gold: false, sz: 0.8, lbl: false },
    { lon: 10.898, lat: 49.897, label: 'Bamberg',    gold: false, sz: 0.8, lbl: false },
    { lon: 13.468, lat: 48.574, label: 'Passau',     gold: false, sz: 0.8, lbl: true  },
    { lon: 12.131, lat: 47.857, label: 'Rosenheim',  gold: false, sz: 0.7, lbl: false },
    { lon: 12.161, lat: 48.537, label: 'Landshut',   gold: false, sz: 0.7, lbl: false },
    { lon: 10.318, lat: 47.726, label: 'Kempten',    gold: false, sz: 0.7, lbl: false },
    { lon: 11.000, lat: 47.498, label: 'Garmisch',   gold: false, sz: 0.6, lbl: false },
  ];

  var CONNECTIONS = [
    // Dachau ↔ München und weitere Nachbarstädte
    [0,1],                          // Dachau – München
    [1,2],[1,3],[1,5],[1,6],[1,10],[1,11], // München – Nürnberg/Augsburg/Regensburg/Ingolstadt/Rosenheim/Landshut
    [2,4],[2,7],[2,8],[2,5],        // Nürnberg – Würzburg/Bayreuth/Bamberg/Regensburg
    [5,9],[3,13]                    // Regensburg – Passau, Augsburg – Kempten
  ];

  // ── Fallback-Umriss (wird überschrieben sobald GeoJSON geladen) ──
  // Format: Array von Ringen, jeder Ring = [[lon,lat], ...]
  var rings = [[
    [ 9.41,49.77],[ 9.66,50.01],[ 9.85,50.18],[ 9.93,50.31],
    [10.14,50.38],[10.48,50.42],[10.88,50.50],[11.26,50.53],
    [11.53,50.44],[11.93,50.42],[12.20,50.33],[12.47,50.18],
    [12.67,49.93],[12.85,49.72],[13.17,49.52],[13.41,48.94],
    [13.63,48.60],[13.48,48.30],[13.20,47.97],[12.96,47.70],
    [12.63,47.67],[12.17,47.62],[11.81,47.59],[11.38,47.43],
    [11.00,47.40],[10.49,47.53],[10.18,47.50],[ 9.57,47.52],
    [ 9.57,47.80],[ 9.66,48.00],[ 9.52,48.22],[ 9.52,48.42],
    [ 9.70,48.58],[ 9.70,48.80],[ 9.95,49.12],[ 9.80,49.45],
    [ 9.41,49.77]
  ]];

  // Separate Distriktringe für innere Struktur (von click_that_hood)
  var districtRings = [];

  // ── Bounding-Box (wird nach GeoJSON-Load aktualisiert) ──
  var BBOX = { minLon: 9.37, maxLon: 13.84, minLat: 47.27, maxLat: 50.57 };

  // ── Kartenprojektion ─────────────────────
  var W = 0, H = 0, mapScale = 1, mapOffX = 0, mapOffY = 0;

  function midLat() { return (BBOX.minLat + BBOX.maxLat) / 2; }

  function computeProj() {
    if (!W || !H) return;
    var cos      = Math.cos(midLat() * Math.PI / 180);
    var lonRange = (BBOX.maxLon - BBOX.minLon) * cos;
    var latRange = BBOX.maxLat - BBOX.minLat;
    mapScale = Math.min(W * 0.84 / lonRange, H * 0.84 / latRange);
    // Karte nach rechts verschieben: Zentrum liegt bei 75 % der Breite
    var centerX = W * 0.75;
    mapOffX = centerX - (lonRange * mapScale) / 2;
    mapOffY = (H - latRange * mapScale) / 2;
  }

  function proj(lon, lat) {
    var cos = Math.cos(midLat() * Math.PI / 180);
    return [
      (lon - BBOX.minLon) * cos * mapScale + mapOffX,
      (BBOX.maxLat - lat)      * mapScale + mapOffY
    ];
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeProj();
  }

  // ── GeoJSON Laden ────────────────────────
  // Primär: Außengrenze (isellsoap/deutschlandGeoJSON)
  fetch('https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/2_bundeslaender/2_hoch.geo.json')
    .then(function(r) { if (!r.ok) throw r.status; return r.json(); })
    .then(function(data) {
      var feat = data.features.find(function(f) {
        var p = f.properties || {};
        return [p.GEN, p.NAME_1, p.name, p.NAME].indexOf('Bayern') > -1;
      });
      if (!feat) return;
      var geom = feat.geometry;
      if (geom.type === 'Polygon') {
        rings = geom.coordinates;
      } else if (geom.type === 'MultiPolygon') {
        rings = geom.coordinates.reduce(function(a, b) {
          return b[0].length > a[0].length ? b : a;
        }, [[]]);
      }
      // BBox aus echten Daten
      rings[0].forEach(function(pt) {
        if (pt[0] < BBOX.minLon) BBOX.minLon = pt[0];
        if (pt[0] > BBOX.maxLon) BBOX.maxLon = pt[0];
        if (pt[1] < BBOX.minLat) BBOX.minLat = pt[1];
        if (pt[1] > BBOX.maxLat) BBOX.maxLat = pt[1];
      });
      computeProj();
    })
    .catch(function() { /* Fallback bleibt */ });

  // Sekundär: Landkreisgrenzen (click_that_hood)
  fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/bavaria.geojson')
    .then(function(r) { if (!r.ok) throw r.status; return r.json(); })
    .then(function(data) {
      data.features.forEach(function(feat) {
        var geom = feat.geometry;
        var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
        polys.forEach(function(poly) { districtRings.push(poly[0]); });
      });
    })
    .catch(function() { /* ohne Landkreise zeichnen */ });

  // ── Pfad-Hilfsfunktionen ─────────────────
  function tracePath(ring) {
    if (!ring || ring.length < 2) return;
    var s = proj(ring[0][0], ring[0][1]);
    ctx.moveTo(s[0], s[1]);
    for (var i = 1; i < ring.length; i++) {
      var p = proj(ring[i][0], ring[i][1]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
  }

  function traceOuter() {
    ctx.beginPath();
    tracePath(rings[0]);
  }

  function traceAll() {
    ctx.beginPath();
    rings.forEach(function(r) { tracePath(r); });
  }

  // ── Zeichenfunktion ──────────────────────
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // 1. Füllung (dunkles Grün)
    traceAll();
    ctx.fillStyle = 'rgba(30,65,15,0.18)';
    ctx.fill('evenodd');

    // 2. Landkreisgrenzen (sehr dezent, olivgrün)
    if (districtRings.length) {
      ctx.beginPath();
      districtRings.forEach(function(r) { tracePath(r); });
      ctx.strokeStyle = 'rgba(120,160,70,0.22)';
      ctx.lineWidth   = 0.5;
      ctx.stroke();
    }

    // 3. Breites äußeres Glühen (warmes Grün)
    ctx.save();
    ctx.shadowColor = 'rgba(90,160,50,0.9)';
    ctx.shadowBlur  = 36;
    traceOuter();
    ctx.strokeStyle = 'rgba(100,170,55,0.4)';
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.restore();

    // 4. Mittlere Glüh-Schicht (helles Gelbgrün)
    ctx.save();
    ctx.shadowColor = 'rgba(170,215,100,0.7)';
    ctx.shadowBlur  = 10;
    traceOuter();
    ctx.strokeStyle = 'rgba(185,220,110,0.78)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // 5. Scharfe Linie (hell-olivweiß)
    traceOuter();
    ctx.strokeStyle = 'rgba(220,235,170,0.92)';
    ctx.lineWidth   = 0.8;
    ctx.stroke();

    // 6. Animierter Strich
    traceOuter();
    var dl = Math.max(6, mapScale * 0.08);
    ctx.setLineDash([dl, dl * 0.5]);
    ctx.lineDashOffset = -(t * 28) % (dl * 1.5);
    ctx.strokeStyle    = 'rgba(220,240,160,0.38)';
    ctx.lineWidth      = 0.7;
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Verbindungslinien (olivgrün)
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -(t * 12) % 8;
    ctx.strokeStyle    = 'rgba(120,160,70,0.28)';
    ctx.lineWidth      = 0.9;
    CONNECTIONS.forEach(function(pair) {
      var a = CITIES[pair[0]], b = CITIES[pair[1]];
      var pa = proj(a.lon, a.lat), pb = proj(b.lon, b.lat);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();

    // 8. Scan-Streifen (grünlich)
    var sf    = (Math.sin(t * 0.22) + 1) / 2;
    var leftX = proj(BBOX.minLon, midLat())[0];
    var rigX  = proj(BBOX.maxLon, midLat())[0];
    var scanX = leftX + (rigX - leftX) * sf;
    var sw    = W * 0.06;
    var sg    = ctx.createLinearGradient(scanX - sw, 0, scanX + sw, 0);
    sg.addColorStop(0,   'rgba(120,170,60,0)');
    sg.addColorStop(0.5, 'rgba(120,170,60,0.09)');
    sg.addColorStop(1,   'rgba(120,170,60,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(scanX - sw, 0, sw * 2, H);

    // 9. Städte
    var baseR = Math.max(3, Math.min(W, H) / 150);
    CITIES.forEach(function(c) {
      var cp = proj(c.lon, c.lat);
      var r  = baseR * c.sz;

      if (c.gold) {
        var pulse = Math.sin(t * 2.3);

        // Aura
        var aura = ctx.createRadialGradient(cp[0], cp[1], 0, cp[0], cp[1], r * 9);
        aura.addColorStop(0, 'rgba(201,168,76,0.30)');
        aura.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(cp[0], cp[1], r * 9, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();

        // Pulsring
        ctx.beginPath();
        ctx.arc(cp[0], cp[1], r * (2.2 + 0.7 * pulse), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(201,168,76,' + (0.2 + 0.3 * (pulse + 1) / 2) + ')';
        ctx.lineWidth   = 1.2;
        ctx.stroke();

        // Kern
        ctx.save();
        ctx.shadowColor = '#c9a84c';
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        ctx.arc(cp[0], cp[1], r, 0, Math.PI * 2);
        ctx.fillStyle = '#c9a84c';
        ctx.fill();
        ctx.restore();

        // Label
        var fs = Math.max(9, r * 2.1);
        ctx.font      = 'bold ' + fs + 'px Inter,sans-serif';
        ctx.fillStyle = 'rgba(201,168,76,0.92)';
        ctx.textAlign = 'center';
        ctx.fillText(c.label, cp[0], cp[1] + r + fs + 2);

      } else {
        ctx.save();
        ctx.shadowColor = 'rgba(180,210,255,0.9)';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(cp[0], cp[1], r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fill();
        ctx.restore();

        if (c.lbl) {
          var lfs = Math.max(7, r * 1.8);
          ctx.font      = lfs + 'px Inter,sans-serif';
          ctx.fillStyle = 'rgba(200,220,255,0.65)';
          ctx.textAlign = 'center';
          ctx.fillText(c.label, cp[0], cp[1] + r + lfs + 2);
        }
      }
    });
  }

  // ── Loop ─────────────────────────────────
  var rafId = null, t0 = null;
  function animate(ts) {
    rafId = requestAnimationFrame(animate);
    if (t0 === null) t0 = ts;
    draw((ts - t0) / 1000);
  }

  resize();
  new ResizeObserver(resize).observe(heroEl);

  new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) { if (!rafId) rafId = requestAnimationFrame(animate); }
    else { cancelAnimationFrame(rafId); rafId = null; }
  }, { threshold: 0.01 }).observe(heroEl);

  rafId = requestAnimationFrame(animate);
})();


// ═══════════════════════════════════════════
// STICKY NAV
// ═══════════════════════════════════════════
var header = document.getElementById('header');
window.addEventListener('scroll', function() {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });


// ═══════════════════════════════════════════
// MOBILE NAV
// ═══════════════════════════════════════════
var navToggle = document.getElementById('navToggle');
var navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', function() {
  var open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});
navLinks.querySelectorAll('a').forEach(function(a) {
  a.addEventListener('click', function() {
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
    navToggle.setAttribute('aria-expanded', 'false');
  });
});


// ═══════════════════════════════════════════
// FOOTER YEAR
// ═══════════════════════════════════════════
var yr = document.getElementById('currentYear');
if (yr) yr.textContent = new Date().getFullYear();




// ═══════════════════════════════════════════
// SCROLL FADE-IN
// ═══════════════════════════════════════════
var fadeIO = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { e.target.classList.add('visible'); fadeIO.unobserve(e.target); }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.topic-card,.about-card,.news-card,.timeline-item')
  .forEach(function(el, i) {
    el.style.cssText += 'opacity:0;transform:translateY(22px);transition:opacity .5s ease ' + (i*.07) + 's,transform .5s ease ' + (i*.07) + 's';
    fadeIO.observe(el);
  });

document.head.insertAdjacentHTML('beforeend','<style>.visible{opacity:1!important;transform:none!important}</style>');


// ═══════════════════════════════════════════
// AKTIVER NAV-LINK
// ═══════════════════════════════════════════
var navItems = document.querySelectorAll('.nav-links a');
var secIO = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) navItems.forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
    });
  });
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('section[id]').forEach(function(s) { secIO.observe(s); });
