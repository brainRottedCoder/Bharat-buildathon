import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  generatePlainLanguageAlert,
  nearestTownText,
  getIntensityLabel,
} from '../../frontend/src/components/HotspotDetailPanel.ts';
import { REGION_LABELS } from '../../frontend/src/components/RegionSelector.ts';
import { stamp, slide, squash, easeOutExpo } from './kit.js';

// Fixtures must match frontend/src/demoHotspots.ts + classify.ts in October.
const FIRES = [
  { id: '1', lat: 30.9, lon: 75.7, frp: 45, kind: 'likely-crop-burning', state: 'Punjab' },
  { id: '2', lat: 30.35, lon: 76.3, frp: 12, kind: 'likely-crop-burning', state: 'Haryana' },
  { id: '3', lat: 29.4, lon: 76.4, frp: 28, kind: 'likely-crop-burning', state: 'Haryana' },
  { id: '4', lat: 30.1, lon: 78.9, frp: 160, kind: 'likely-wildfire', state: 'Uttarakhand' },
];
const PLUME = { bearingDeg: 135, distanceKm: 18.4, spreadDeg: 28 };
const ACQUIRED = '2026-10-11T09:00:00.000Z';

const OM_SCENES = [
  { name: 'SmokeHasASource', secs: 7.2 },
  { name: 'OpenTheRadar', secs: 6.0 },
  { name: 'TheScan', secs: 9.0 },
  { name: 'TapLudhiana', secs: 11.4 },
  { name: 'ItAddsUp', secs: 10.8 },
  { name: 'TheStamp', secs: 9.6 },
];

const CUES = {};
{
  let acc = 0;
  for (const s of OM_SCENES) {
    CUES[s.name] = acc;
    acc += s.secs;
  }
}
const DURATION = OM_SCENES.reduce((n, s) => n + s.secs, 0);

const CAPTIONS = [
  { t: 0.0, until: 3.5, text: 'Every November the sky goes grey.' },
  { t: 3.6, until: 7.2, text: 'The village downwind never gets the alert.' },
  { t: 7.8, until: 10.1, text: 'So open a page.' },
  { t: 10.2, until: 13.2, text: 'North India.' },
  { t: 14.4, until: 17.3, text: 'NASA sees the heat.' },
  { t: 17.4, until: 20.4, text: 'Wind tells you where the smoke goes.' },
  { t: 23.4, until: 26.3, text: 'Tap it.' },
  { t: 26.4, until: 29.3, text: 'Stubble. Not forest.' },
  { t: 29.4, until: 33.6, text: 'Fifteen kilometres west of Ludhiana.' },
  { t: 34.2, until: 35.9, text: 'Four fires.' },
  { t: 36.0, until: 37.7, text: 'Three stubble.' },
  { t: 37.8, until: 40.1, text: 'One wildfire.' },
  { t: 40.2, until: 44.4, text: 'Hindi. Kannada. Telugu. English.' },
  { t: 45.0, until: 47.9, text: 'Nothing runs when you close the tab.' },
  { t: 48.0, until: 48.6, text: 'AgniGuard.' },
];

// Same georeference as frontend MapView FARMLAND_IMAGE (Web Mercator rows).
const LAND = { w: 3000, h: 3513, west: 68, south: 6, east: 98, north: 38, src: '/ds/farmland.png' };
const NORTH_BBOX = { minLon: 73.2, maxLon: 80.6, minLat: 27.8, maxLat: 33.2 };

function mercX(lon) {
  return (lon * Math.PI) / 180;
}
function mercY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
function lonLatToPx(lon, lat) {
  const x0 = mercX(LAND.west);
  const x1 = mercX(LAND.east);
  const y0 = mercY(LAND.south);
  const y1 = mercY(LAND.north);
  return [
    ((mercX(lon) - x0) / (x1 - x0)) * LAND.w,
    ((y1 - mercY(lat)) / (y1 - y0)) * LAND.h,
  ];
}
function viewBoxFor(focus) {
  if (focus !== 'north') return `0 0 ${LAND.w} ${LAND.h}`;
  const [x0, y1] = lonLatToPx(NORTH_BBOX.minLon, NORTH_BBOX.minLat);
  const [x1, y0] = lonLatToPx(NORTH_BBOX.maxLon, NORTH_BBOX.maxLat);
  const pad = 48;
  return `${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + pad * 2).toFixed(1)} ${(y1 - y0 + pad * 2).toFixed(1)}`;
}

function sceneAt(T) {
  for (let i = OM_SCENES.length - 1; i >= 0; i--) {
    const name = OM_SCENES[i].name;
    const cut = CUES[name] - (i === 0 ? 0 : 0.25);
    if (T >= cut) return { name, local: T - CUES[name], start: CUES[name] };
  }
  return { name: OM_SCENES[0].name, local: T, start: 0 };
}

function wipeX(T) {
  for (let i = 1; i < OM_SCENES.length; i++) {
    const edge = CUES[OM_SCENES[i].name];
    const u = (T - (edge - 0.36)) / 0.72;
    if (u > 0 && u < 1) return easeOutExpo(u);
  }
  return null;
}

function CaptionStamp({ T }) {
  if (typeof window !== 'undefined' && window.__NO_CAPTIONS) return null;
  const line = [...CAPTIONS].reverse().find((c) => T >= c.t && T < c.until);
  if (!line) return null;
  const dark = T >= CUES.OpenTheRadar && T < CUES.TheStamp;
  return (
    <div className={`film-caption${dark ? ' film-caption-dark' : ''}`} style={stamp(T, line.t, 0.14)}>
      {line.text}
    </div>
  );
}

function Paper({ og }) {
  return (
    <>
      <div className={`film-under${og ? ' film-under-og' : ''}`} />
      <div className="film-vignette" />
    </>
  );
}

function Header({ region, squashAt, local }) {
  return (
    <header className="app-header">
      <div className="brand-container">
        <h1 className="brand-title">AgniGuard</h1>
        <span className="brand-subtitle">Autonomous Stubble & Biomass Fire Early-Warning Radar</span>
      </div>
      <nav className="region-selector" aria-label="Region Selector">
        <div className="region-segmented-control" role="tablist">
          {Object.entries(REGION_LABELS).map(([key, { name, native }]) => {
            const active = key === region;
            const extra = active && squashAt != null ? squash(local, squashAt) : {};
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`region-tab${active ? ' region-tab-active' : ''}`}
                style={extra}
              >
                <span className="region-tab-name">{name}</span>
                <span className="region-tab-native">{native}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function FilmMap({ shown, selected, local, focus = 'india', cursor, wash }) {
  const north = focus === 'north';
  const r = north ? 22 : 54;
  return (
    <div className={`film-map-wrap${wash ? ' film-map-wash' : ''}`}>
      <svg className="film-map-svg" viewBox={viewBoxFor(focus)} preserveAspectRatio="xMidYMid meet">
        <rect x="-200" y="-200" width={LAND.w + 400} height={LAND.h + 400} fill="#e4e8df" />
        <image href={LAND.src} width={LAND.w} height={LAND.h} />
        {FIRES.map((f, i) => {
          if (i >= shown) return null;
          const [x, y] = lonLatToPx(f.lon, f.lat);
          const crop = f.kind === 'likely-crop-burning';
          const color = crop ? '#F19143' : '#EF2D56';
          const hit = 2.4 + i * 1.2;
          const st = stamp(local, hit, 0.16);
          const plume = north ? 90 : 140;
          const ang = (135 * Math.PI) / 180;
          const x2 = x + Math.sin(ang) * plume;
          const y2 = y - Math.cos(ang) * plume;
          const ring = selected === f.id;
          return (
            <g key={f.id} style={st}>
              {local > hit + 0.2 && (
                <line x1={x} y1={y} x2={x2} y2={y2} stroke="#5B6573" strokeWidth={north ? 4 : 7} strokeDasharray="8 7" />
              )}
              {ring && <circle cx={x} cy={y} r={r * 2} fill="none" stroke={color} strokeWidth={north ? 5 : 8} />}
              <circle cx={x} cy={y} r={r} fill={color} stroke="#FDFFFC" strokeWidth={north ? 4 : 6} />
            </g>
          );
        })}
        {cursor && (
          <circle cx={cursor[0]} cy={cursor[1]} r={north ? 16 : 28} fill="#333333" stroke="#FDFFFC" strokeWidth="4" />
        )}
      </svg>
      {!wash && (
        <div className="map-legend">
          <div className="legend-item"><span className="legend-dot dot-stubble" /> Stubble</div>
          <div className="legend-item"><span className="legend-dot dot-wildfire" /> Wildfire</div>
        </div>
      )}
    </div>
  );
}

function FilmPanel({ fire, lang, style }) {
  const hotspot = {
    id: fire.id,
    lat: fire.lat,
    lon: fire.lon,
    frp: fire.frp,
    confidence: 'h',
    acquiredAt: ACQUIRED,
    satellite: 'VIIRS',
  };
  const classification = {
    kind: fire.kind,
    landCover: fire.kind === 'likely-wildfire' ? 'forest' : 'cropland',
    rationale:
      fire.kind === 'likely-wildfire'
        ? 'Thermal anomaly detected within designated forest land cover; characteristic of forest wildfire.'
        : 'Thermal anomaly detected in agricultural cropland during peak autumn paddy-stubble burning season.',
  };
  const isWild = fire.kind === 'likely-wildfire';
  const textKind = isWild ? 'Likely Wildfire / Forest Fire' : 'Likely Crop Stubble Burning';
  const hiKind = isWild ? 'संभावित जंगल की आग' : 'संभावित पराली दहन';
  const knKind = isWild ? 'ಸಂಭಾವ್ಯ ಕಾಡ್ಗಿಚ್ಚು' : 'ಸಂಭಾವ್ಯ ಕೂಳೆ ಸುಡುವಿಕೆ';
  const teKind = isWild ? 'అడవి మంట అయ్యే అవకాశం' : 'పంట వ్యర్థాల దహనం అయ్యే అవకాశం';
  const badge =
    lang === 'hi' ? hiKind : lang === 'kn' ? knKind : lang === 'te' ? teKind : textKind;
  const alert = generatePlainLanguageAlert(hotspot, classification, PLUME, lang);
  const intensity = getIntensityLabel(fire.frp, lang);
  const town = nearestTownText(fire.lat, fire.lon, lang);
  const cards = {
    hi: { smoke: 'धुएं का फैलाव (हवा)', intensity: 'आग की तीव्रता और शक्ति', advisory: 'आपके लिए इसका मतलब' },
    kn: { smoke: 'ಹೊಗೆಯ ಹರಡುವಿಕೆ (ಗಾಳಿ)', intensity: 'ಬೆಂಕಿಯ ತೀವ್ರತೆ ಮತ್ತು ಶಕ್ತಿ', advisory: 'ನಿಮಗೆ ಇದರ ಅರ್ಥ' },
    te: { smoke: 'పొగ వ్యాప్తి (గాలి)', intensity: 'మంట తీవ్రత & శక్తి', advisory: 'మీకు దీని అర్థం' },
    en: { smoke: 'Smoke Dispersion (Wind)', intensity: 'Fire Intensity & Power', advisory: 'What this means for you' },
  }[lang] ?? { smoke: 'Smoke Dispersion (Wind)', intensity: 'Fire Intensity & Power', advisory: 'What this means for you' };
  return (
    <aside className="hotspot-detail-panel hotspot-panel-active" style={style}>
      <div className="panel-header">
        <div className="panel-header-title-group">
          <span className={`classification-badge ${isWild ? 'badge-wildfire' : 'badge-crop-burning'}`}>{badge}</span>
          <h3 className="panel-title">{town}</h3>
        </div>
        <button type="button" className="panel-close-button" aria-label="Close">✕</button>
      </div>
      <div className="panel-voice-section">
        <div className="lang-selector-group">
          {['hi', 'kn', 'te', 'en'].map((code) => (
            <button key={code} type="button" className={`lang-pill${lang === code ? ' lang-pill-active' : ''}`}>
              {code === 'hi' ? 'हिंदी' : code === 'kn' ? 'ಕನ್ನಡ' : code === 'te' ? 'తెలుగు' : 'English'}
            </button>
          ))}
        </div>
        <button type="button" className="tts-button">Listen</button>
      </div>
      <div className="panel-card advisory-card">
        <div className="card-title">{cards.advisory}</div>
        <p className="advisory-text">{alert}</p>
      </div>
      <div className="panel-grid">
        <div className="panel-card">
          <div className="card-title">{cards.smoke}</div>
          <div className="card-value">SE · 18.4 km</div>
          <div className="card-subtext">Wind-driven plume</div>
        </div>
        <div className="panel-card">
          <div className="card-title">{cards.intensity}</div>
          <div className={`card-value severity-${intensity.severity}`}>{fire.frp.toFixed(1)} MW</div>
          <div className="card-subtext">{intensity.label}</div>
        </div>
      </div>
    </aside>
  );
}

function SceneSmoke({ local }) {
  return (
    <div className="film-scene">
      <FilmMap shown={0} local={10} focus="india" wash />
      <div className="film-open-wash" />
      <div className="film-hero-type">
        <h1 style={stamp(local, 0.05, 0.2)}>Every November the sky goes grey.</h1>
        <p style={stamp(local, 3.55, 0.18)}>The village downwind never gets the alert.</p>
      </div>
    </div>
  );
}

function SceneOpen({ local }) {
  return (
    <div className="film-scene">
      <div className="film-app">
        <div style={slide(local, 0.05, 0.26, -36)}>
          <Header region={local >= 3.0 ? 'north' : 'india'} squashAt={3.0} local={local} />
        </div>
        <div className="status-banner banner-loading">Initializing satellite radar...</div>
        <FilmMap shown={0} local={local} focus="india" />
      </div>
    </div>
  );
}

function SceneScan({ local }) {
  const shown = 1 + Math.min(3, Math.max(0, Math.floor((local - 2.4) / 1.2 + 0.001)));
  return (
    <div className="film-scene">
      <div className="film-app">
        <Header region="north" local={local} />
        <div className="status-banner banner-ready">
          <span className="summary-total">{shown} fires</span>
          <span className="summary-count summary-stubble">{Math.min(shown, 3)} stubble</span>
          <span className="summary-count summary-wildfire">{shown >= 4 ? 1 : 0} wildfire</span>
        </div>
        <FilmMap shown={shown} local={local} focus="india" />
      </div>
    </div>
  );
}

function SceneTap({ local }) {
  const cursorOn = local >= 1.1 && local < 2.4;
  return (
    <div className="film-scene">
      <div className="film-app">
        <Header region="north" local={local} />
        <div className="status-banner banner-ready">
          <span className="summary-total">4 fires</span>
          <span className="summary-count summary-stubble">3 stubble</span>
          <span className="summary-count summary-wildfire">1 wildfire</span>
        </div>
        <FilmMap
          shown={4}
          selected={local >= 1.2 ? '1' : null}
          local={10}
          focus="india"
          cursor={cursorOn ? lonLatToPx(75.7, 30.9) : null}
        />
        <FilmPanel fire={FIRES[0]} lang="hi" style={slide(local, 1.8, 0.24, 64)} />
      </div>
    </div>
  );
}

function SceneAdds({ local }) {
  const langs = ['hi', 'kn', 'te', 'en'];
  const lang = langs[Math.min(3, Math.max(0, Math.floor((local - 6.6) / 0.6)))];
  const fire = local >= 3.6 ? FIRES[3] : FIRES[0];
  return (
    <div className="film-scene">
      <div className="film-app">
        <Header region="north" local={local} />
        <div className="status-banner banner-ready">
          <span className="film-count" style={stamp(local, 0.6, 0.16)}>
            <em>4</em> fires
          </span>
          <span className="film-count stub" style={stamp(local, 2.4, 0.16)}>
            3 stubble
          </span>
          <span className="film-count wild" style={stamp(local, 4.2, 0.16)}>
            1 wildfire
          </span>
        </div>
        <FilmMap shown={4} selected={fire.id} local={10} focus="india" />
        <FilmPanel fire={fire} lang={local >= 6.6 ? lang : 'hi'} style={slide(local, 0.2, 0.2, 48)} />
      </div>
    </div>
  );
}

const MARKS = ['#5D6E48', '#748E54', '#A4B68F', '#5D6E48', '#748E54', '#A4B68F', '#5D6E48'];

function SceneStamp({ local }) {
  return (
    <div className="film-scene">
      <Paper />
      <div className="film-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        <div className="mosaic">
          {MARKS.map((c, i) => (
            <i key={i} className={i % 3 === 1 ? 'sq' : ''} style={{ background: c, ...stamp(local, 0.15 + i * 0.06, 0.14) }} />
          ))}
        </div>
        <div className="film-wordmark" style={stamp(local, 2.8, 0.2)}>AGNIGUARD</div>
      </div>
    </div>
  );
}

function Film({ T }) {
  const { name, local } = sceneAt(T);
  const w = wipeX(T);
  return (
    <div className="film-stage" data-om-exportable-video-with-duration-secs={String(DURATION)}>
      {name === 'SmokeHasASource' && <SceneSmoke local={local} />}
      {name === 'OpenTheRadar' && <SceneOpen local={local} />}
      {name === 'TheScan' && <SceneScan local={local} />}
      {name === 'TapLudhiana' && <SceneTap local={local} />}
      {name === 'ItAddsUp' && <SceneAdds local={local} />}
      {name === 'TheStamp' && <SceneStamp local={local} />}
      <CaptionStamp T={T} />
      {w != null && (
        <div className="film-wipe" style={{ transform: `translateX(${(-1 + w * 2) * 100}%)` }} />
      )}
    </div>
  );
}

function App() {
  const [T, setT] = useState(0);
  React.useEffect(() => {
    const el = document.querySelector('[data-om-exportable-video-with-duration-secs]');
    if (!el) return;
    const onSeek = (e) => {
      flushSync(() => setT(e.detail.time));
    };
    el.addEventListener('data-om-seek-to-time-frame', onSeek);
    return () => el.removeEventListener('data-om-seek-to-time-frame', onSeek);
  }, []);
  return <Film T={T} />;
}

createRoot(document.getElementById('root')).render(<App />);
