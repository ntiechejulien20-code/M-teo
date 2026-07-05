// ============================================================
// Weather App — vanilla JS
// APIs used (no key required):
//   - navigator.geolocation           -> user's GPS position
//   - Open-Meteo forecast API         -> temperature / hourly / daily
//   - Open-Meteo geocoding API        -> search cities by name (tabs)
//   - BigDataCloud reverse geocoding  -> city name from lat/lon ("Ma position")
// Weather icons are emoji (reliable, no external asset to fail loading).
// ============================================================

const els = {
  city: document.getElementById('cityName'),
  date: document.getElementById('dateLabel'),
  temp: document.getElementById('tempValue'),
  minMax: document.getElementById('minMax'),
  icon: document.getElementById('mainIcon'),
  pressure: document.getElementById('pressureValue'),
  wind: document.getElementById('windValue'),
  humidity: document.getElementById('humidityValue'),
  hourly: document.getElementById('hourlyScroll'),
  carousel: document.getElementById('hourlyCarousel'),
  status: document.getElementById('statusMsg'),
  refreshBtn: document.getElementById('refreshBtn'),
  dayBtns: document.querySelectorAll('.day-btn'),
  resBtns: document.querySelectorAll('.res-btn'),
  cityTabs: document.getElementById('cityTabs'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  menuBtn: document.getElementById('menuBtn'),
  avatarBtn: document.getElementById('avatarBtn'),
  avatarDisplay: document.getElementById('avatarDisplay'),
  avatarPicker: document.getElementById('avatarPicker'),
  avatarGrid: document.getElementById('avatarGrid'),
  settingsOverlay: document.getElementById('settingsOverlay'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettings: document.getElementById('closeSettings'),
  unitToggle: document.getElementById('unitToggle'),
  themeToggle: document.getElementById('themeToggle'),
  iconStyleToggle: document.getElementById('iconStyleToggle'),
  weatherCard: document.getElementById('weatherCard'),
  favoritesOverlay: document.getElementById('favoritesOverlay'),
  favoritesSheet: document.getElementById('favoritesSheet'),
  closeFavorites: document.getElementById('closeFavorites'),
  favoritesList: document.getElementById('favoritesList'),
  navHome: document.getElementById('navHome'),
  navLocate: document.getElementById('navLocate'),
  navFavorites: document.getElementById('navFavorites'),
  navSettings: document.getElementById('navSettings'),
};

let activeDay = 'today';
let activeRes = 60; // minutes: 60 or 30
let lastForecast = null;
let activeCityId = 'current';
let searchDebounce = null;

// ---- Auto-scroll carousel state ----
let scrollRAF = null;
let scrollPaused = false;
let scrollSpeed = 0.35; // px per frame — slow, ambient drift

// ---- Cities list: "Ma position" is special (geolocation), rest are fixed coords ----
let cities = [
  { id: 'current', name: 'Ma position', isCurrentLocation: true, removable: false },
  { id: 'douala',  name: 'Douala', country: 'Cameroun', lat: 4.0511, lon: 9.7679, removable: false },
];

// ---- Weather code -> category + label -------------------------
// Categories are rendered as layered 3D-gradient SVG illustrations (buildWeatherIcon),
// close to the reference design (puffy cloud + glossy sun + glassy raindrops).
function weatherFromCode(code, isDay){
  const map = {
    0:  { cat:'clear',        label:'Ciel dégagé' },
    1:  { cat:'clear',        label:'Plutôt dégagé' },
    2:  { cat:'partly-cloudy', label:'Partiellement nuageux' },
    3:  { cat:'cloudy',       label:'Couvert' },
    45: { cat:'fog',          label:'Brouillard' },
    48: { cat:'fog',          label:'Brouillard givrant' },
    51: { cat:'drizzle',      label:'Bruine légère' },
    53: { cat:'drizzle',      label:'Bruine' },
    55: { cat:'rain',         label:'Bruine forte' },
    56: { cat:'rain',         label:'Bruine verglaçante' },
    57: { cat:'rain',         label:'Bruine verglaçante forte' },
    61: { cat:'rain',         label:'Pluie légère' },
    63: { cat:'rain',         label:'Pluie' },
    65: { cat:'rain',         label:'Pluie forte' },
    66: { cat:'rain',         label:'Pluie verglaçante' },
    67: { cat:'rain',         label:'Pluie verglaçante forte' },
    71: { cat:'snow',         label:'Neige légère' },
    73: { cat:'snow',         label:'Neige' },
    75: { cat:'snow',         label:'Neige forte' },
    77: { cat:'snow',         label:'Grains de neige' },
    80: { cat:'rain',         label:'Averses' },
    81: { cat:'rain',         label:'Averses fortes' },
    82: { cat:'storm',        label:'Averses violentes' },
    85: { cat:'snow',         label:'Averses de neige' },
    86: { cat:'snow',         label:'Averses de neige fortes' },
    95: { cat:'storm',        label:'Orage' },
    96: { cat:'storm',        label:'Orage + grêle' },
    99: { cat:'storm',        label:'Orage violent' },
  };
  const entry = map[code] || { cat:'partly-cloudy', label:'—' };
  return { icon: buildWeatherIcon(entry.cat, isDay), label: entry.label, category: entry.cat };
}

// ---- Icon library: the user can switch between icon "packs" from the
// settings panel. Each pack is just a builder function keyed by category.
// To add a new pack later: write a buildXxxIcon(category, isDay) function
// that returns an <svg>...</svg> string, then add it to ICON_STYLES below. ----
let iconStyle = localStorage.getItem('weatherIconStyle') || 'gloss';

// ---- SVG 3D-gradient weather icon builder ----------------------------
let iconUid = 0;

function sunSVG(uid, small){
  const r = small ? 15 : 19;
  return `
    <defs>
      <radialGradient id="sun-${uid}" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fff6c8"/>
        <stop offset="55%" stop-color="#ffcf4d"/>
        <stop offset="100%" stop-color="#ff9f2e"/>
      </radialGradient>
    </defs>
    <g class="icon-rays" stroke="#ffcf4d" stroke-width="4" stroke-linecap="round">
      <line x1="50" y1="10" x2="50" y2="2"/>
      <line x1="50" y1="90" x2="50" y2="98"/>
      <line x1="10" y1="50" x2="2" y2="50"/>
      <line x1="90" y1="50" x2="98" y2="50"/>
      <line x1="21" y1="21" x2="15" y2="15"/>
      <line x1="79" y1="21" x2="85" y2="15"/>
      <line x1="21" y1="79" x2="15" y2="85"/>
      <line x1="79" y1="79" x2="85" y2="85"/>
    </g>
    <circle class="icon-sun-core" cx="50" cy="50" r="${r}" fill="url(#sun-${uid})"/>
    <circle cx="44" cy="43" r="${r*0.4}" fill="#ffffff" opacity="0.55"/>
  `;
}

function moonSVG(uid){
  return `
    <defs>
      <radialGradient id="moon-${uid}" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#eef0ff"/>
        <stop offset="60%" stop-color="#b9c2ec"/>
        <stop offset="100%" stop-color="#8a91c9"/>
      </radialGradient>
    </defs>
    <circle class="icon-moon" cx="50" cy="45" r="19" fill="url(#moon-${uid})"/>
    <circle cx="43" cy="38" r="3" fill="#8a91c9" opacity="0.6"/>
    <circle cx="57" cy="50" r="2" fill="#8a91c9" opacity="0.5"/>
  `;
}

function cloudSVG(uid, cx, cy, scale, back){
  const fill = back ? `cloud-back-${uid}` : `cloud-front-${uid}`;
  return `
    <defs>
      <linearGradient id="${fill}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${back ? '#d9def0' : '#ffffff'}"/>
        <stop offset="100%" stop-color="${back ? '#aeb6d6' : '#c9cee6'}"/>
      </linearGradient>
    </defs>
    <g transform="translate(${cx} ${cy}) scale(${scale})" opacity="${back ? 0.75 : 1}">
      <g class="${back ? 'icon-cloud-float-back' : 'icon-cloud-float-front'}">
        <ellipse cx="0" cy="10" rx="34" ry="15" fill="url(#${fill})"/>
        <circle cx="-16" cy="-2" r="15" fill="url(#${fill})"/>
        <circle cx="4" cy="-8" r="19" fill="url(#${fill})"/>
        <circle cx="22" cy="0" r="14" fill="url(#${fill})"/>
        <ellipse cx="-6" cy="-10" rx="10" ry="6" fill="#ffffff" opacity="${back ? 0 : 0.5}"/>
      </g>
    </g>
  `;
}

function raindropsSVG(uid, y, heavy){
  const drops = heavy ? [-24,-6,12,30] : [-16,10,28];
  return `
    <defs>
      <linearGradient id="rain-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8fd3ff"/>
        <stop offset="100%" stop-color="#4a9dff"/>
      </linearGradient>
    </defs>
    ${drops.map((x,i) => `
      <path class="icon-raindrop" style="animation-delay:${(i*0.22).toFixed(2)}s"
        d="M${50+x} ${y+i%2*4} q4 8 0 13 a4 4 0 1 1 0 -13 z"
        fill="url(#rain-${uid})"/>
    `).join('')}
  `;
}

function snowflakesSVG(y){
  return [-22,2,26].map((x,i) => `<circle class="icon-snowflake" style="animation-delay:${(i*0.5).toFixed(2)}s" cx="${50+x}" cy="${y + (x===2?6:0)}" r="4" fill="#eaf3ff"/>`).join('');
}

function boltSVG(uid){
  return `
    <defs>
      <linearGradient id="bolt-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffe98a"/>
        <stop offset="100%" stop-color="#ffb23d"/>
      </linearGradient>
    </defs>
    <path class="icon-bolt" d="M54 58 L40 82 L50 82 L46 100 L66 74 L55 74 Z" fill="url(#bolt-${uid})"/>
  `;
}

function fogSVG(y){
  return [0,10,20].map((dy,i) => `
    <rect class="icon-fog-line" style="animation-delay:${(i*0.4).toFixed(2)}s" x="${18+i*4}" y="${y+dy}" width="${64-i*8}" height="6" rx="3" fill="#cfd6ea" opacity="${0.75 - i*0.15}"/>
  `).join('');
}

function buildWeatherIcon(category, isDay){
  return iconStyle === 'minimal'
    ? buildWeatherIconMinimal(category, isDay)
    : buildWeatherIconGloss(category, isDay);
}

// ---- Pack 1: "3D Glossy" — layered gradients, the original illustrated style ----
function buildWeatherIconGloss(category, isDay){
  const uid = ++iconUid;
  let inner = '';

  switch(category){
    case 'clear':
      inner = isDay ? sunSVG(uid) : moonSVG(uid);
      break;
    case 'partly-cloudy':
      inner = `
        <g transform="translate(-10,-8)">${isDay ? sunSVG(uid, true) : moonSVG(uid)}</g>
        ${cloudSVG(uid, 54, 58, 1.05, false)}
      `;
      break;
    case 'cloudy':
      inner = cloudSVG(uid, 40, 40, 0.85, true) + cloudSVG(uid, 58, 60, 1.05, false);
      break;
    case 'fog':
      inner = cloudSVG(uid, 50, 38, 0.9, false) + fogSVG(66);
      break;
    case 'drizzle':
      inner = cloudSVG(uid, 50, 44, 1.0, false) + raindropsSVG(uid, 78, false);
      break;
    case 'rain':
      inner = `
        <g transform="translate(-14,-14)">${isDay ? sunSVG(uid, true) : moonSVG(uid)}</g>
        ${cloudSVG(uid, 52, 52, 1.05, false)}
        ${raindropsSVG(uid, 86, true)}
      `;
      break;
    case 'storm':
      inner = cloudSVG(uid, 50, 42, 1.0, false) + boltSVG(uid) + raindropsSVG(uid, 90, false);
      break;
    case 'snow':
      inner = cloudSVG(uid, 50, 44, 1.0, false) + snowflakesSVG(80);
      break;
    default:
      inner = cloudSVG(uid, 50, 48, 1.0, false);
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---- Pack 2: "Minimal" — flat, single/two-tone line icons. This is a
// second, independent icon set to demonstrate that the library is
// pluggable: swapping ICON_STYLES / adding a pack does not touch any of
// the app logic, only this file's icon builders. ----
function buildWeatherIconMinimal(category, isDay){
  const sun = `<circle class="icon-sun-core" cx="50" cy="50" r="18" fill="none" stroke="#ffcf4d" stroke-width="6"/>
    <g class="icon-rays" stroke="#ffcf4d" stroke-width="6" stroke-linecap="round">
      <line x1="50" y1="14" x2="50" y2="6"/><line x1="50" y1="94" x2="50" y2="86"/>
      <line x1="14" y1="50" x2="6" y2="50"/><line x1="94" y1="50" x2="86" y2="50"/>
      <line x1="25" y1="25" x2="19" y2="19"/><line x1="81" y1="19" x2="75" y2="25"/>
      <line x1="25" y1="75" x2="19" y2="81"/><line x1="81" y1="81" x2="75" y2="75"/>
    </g>`;
  const moon = `<path class="icon-moon" d="M62 30a24 24 0 1 0 8 38 20 20 0 0 1-8-38z" fill="#c9d0f0"/>`;
  const cloud = (cx=50, cy=56) => `<g class="icon-cloud-float-front"><path transform="translate(${cx-50} ${cy-56})"
    d="M32 72a16 16 0 0 1 2-31.9A20 20 0 0 1 72 46a14 14 0 0 1-4 26z"
    fill="none" stroke="#e7eaf7" stroke-width="6" stroke-linejoin="round"/></g>`;
  const rain = (n=3) => Array.from({length:n}).map((_,i) => {
    const x = 38 + i*12;
    return `<line class="icon-raindrop" style="animation-delay:${(i*0.22).toFixed(2)}s" x1="${x}" y1="80" x2="${x-4}" y2="94" stroke="#5eb6ff" stroke-width="5" stroke-linecap="round"/>`;
  }).join('');
  const bolt = `<path class="icon-bolt" d="M53 74 44 90 53 90 47 100 62 80 54 80 58 74z" fill="#ffcf4d"/>`;
  const snow = [38,50,62].map((x,i) => `<circle class="icon-snowflake" style="animation-delay:${(i*0.5).toFixed(2)}s" cx="${x}" cy="90" r="3.5" fill="#eaf3ff"/>`).join('');
  const fog = [70,80,90].map((y,i) => `<line class="icon-fog-line" style="animation-delay:${(i*0.4).toFixed(2)}s" x1="20" y1="${y}" x2="80" y2="${y}" stroke="#b9c0d8" stroke-width="5" stroke-linecap="round"/>`).join('');

  let inner = '';
  switch(category){
    case 'clear':          inner = isDay ? sun : moon; break;
    case 'partly-cloudy':  inner = `<g transform="translate(10,-6) scale(0.6)">${isDay ? sun : moon}</g>${cloud()}`; break;
    case 'cloudy':         inner = cloud(44,44) + cloud(58,62); break;
    case 'fog':            inner = cloud(50,40) + fog; break;
    case 'drizzle':        inner = cloud() + rain(2); break;
    case 'rain':           inner = cloud() + rain(4); break;
    case 'storm':          inner = cloud() + bolt; break;
    case 'snow':           inner = cloud() + snow; break;
    default:               inner = cloud();
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function hPaToMmHg(hpa){ return Math.round(hpa * 0.750062); }

function formatDate(d){
  const opts = { weekday:'long', day:'numeric', month:'short' };
  const str = d.toLocaleDateString('fr-FR', opts);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---- Reverse geocoding: coords -> city name (used only for "Ma position") ----
async function getCityName(lat, lon){
  try{
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    const data = await res.json();
    return data.city || data.locality || data.principalSubdivision || 'Position actuelle';
  }catch(e){
    return 'Position actuelle';
  }
}

// ---- City search API (Open-Meteo Geocoding) ----------------------------
async function searchCities(query){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=fr&format=json`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Erreur API de recherche');
  const data = await res.json();
  return data.results || [];
}

// ---- Forecast fetch ------------------------------------------
async function getForecast(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code,is_day` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Erreur API météo');
  return res.json();
}

// ---- Unit conversion ------------------------------------------
let unit = localStorage.getItem('weatherUnit') || 'C';
function convertTemp(celsius){
  return unit === 'F' ? Math.round(celsius * 9/5 + 32) : Math.round(celsius);
}

// Wind speed (km/h) above which the card switches to "storm" mode even
// if the weather code itself isn't a thunderstorm.
const STRONG_WIND_KMH = 45;

// ---- Card mood: picks which gradient palette the card wears, based on
// the actual conditions. Only one mood class is ever applied at a time. ----
const CARD_MOODS = ['mood-hot', 'mood-mild', 'mood-cold', 'mode-storm'];
function cardMoodFor(tempC, category, windKmh){
  if(category === 'storm' || windKmh >= STRONG_WIND_KMH) return 'mode-storm';
  if(category === 'snow' || tempC <= 5) return 'mood-cold';
  if(tempC >= 27) return 'mood-hot';
  return 'mood-mild';
}

// ---- Render main card ------------------------------------------
function renderCurrent(cityName, data){
  const cur = data.current;
  const w = weatherFromCode(cur.weather_code, cur.is_day === 1);
  const windKmh = Math.round(cur.wind_speed_10m);

  els.city.textContent = cityName;
  els.date.textContent = formatDate(new Date());
  els.temp.textContent = convertTemp(cur.temperature_2m);
  els.icon.innerHTML = w.icon;
  els.icon.setAttribute('title', w.label);
  els.pressure.textContent = `${hPaToMmHg(cur.surface_pressure)} mmHg`;
  els.wind.textContent = `${windKmh} km/h`;
  els.humidity.textContent = `${Math.round(cur.relative_humidity_2m)} %`;

  // Card color mood: warm sunny days stay pink/orange (the reference
  // design), mild/cloudy days shift to violet/pink, cold or snowy days
  // shift to blue/violet, and storms/strong wind switch to the dark
  // lightning mode. Only one mood class is applied at a time.
  const mood = cardMoodFor(cur.temperature_2m, w.category, windKmh);
  els.weatherCard.classList.remove(...CARD_MOODS);
  els.weatherCard.classList.add(mood);

  if(data.daily){
    const max = convertTemp(data.daily.temperature_2m_max[0]);
    const min = convertTemp(data.daily.temperature_2m_min[0]);
    els.minMax.textContent = `Max: ${max}° — Min: ${min}°`;
  }
}

// ---- Build a list of forecast points at 30-min resolution --------------
// Open-Meteo only gives hourly data, so for the 30-min view we linearly
// interpolate the temperature between two consecutive hours and reuse the
// nearest hour's weather code for the icon.
function buildEntries(data, day, stepMinutes){
  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const codes = data.hourly.weather_code;
  const now = new Date();

  const targetDateStr = new Date(now.getTime() + (day === 'tomorrow' ? 86400000 : 0))
    .toISOString().slice(0,10);

  const hourlyPoints = times.map((t, i) => ({ t: new Date(t), temp: temps[i], code: codes[i] }));

  let points = [];
  if(stepMinutes === 60){
    points = hourlyPoints.filter(p => p.t.toISOString().slice(0,10) === targetDateStr);
  }else{
    for(let i = 0; i < hourlyPoints.length - 1; i++){
      const a = hourlyPoints[i];
      const b = hourlyPoints[i+1];
      if(a.t.toISOString().slice(0,10) !== targetDateStr) continue;
      points.push(a);
      const midTime = new Date(a.t.getTime() + 30 * 60000);
      const midTemp = (a.temp + b.temp) / 2;
      points.push({ t: midTime, temp: midTemp, code: a.code });
    }
  }

  if(day === 'today') points = points.filter(p => p.t >= now);
  return points.slice(0, 16);
}

// ---- Render hourly carousel ----------------------------------------
function renderHourly(data, day, stepMinutes){
  const entries = buildEntries(data, day, stepMinutes);
  els.hourly.innerHTML = '';

  if(entries.length === 0){
    els.hourly.innerHTML = `<p class="status-msg">Aucune donnée disponible.</p>`;
    return;
  }

  // Render the list twice back-to-back so the auto-scroll can loop seamlessly.
  const renderSet = () => entries.map(e => {
    const hour = e.t.getHours();
    const minute = e.t.getMinutes();
    const isDay = hour >= 6 && hour < 19;
    const w = weatherFromCode(e.code, isDay);
    return `
      <div class="hour-card">
        <p class="hour-time">${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}</p>
        <p class="hour-temp"><span class="hour-temp-value">${convertTemp(e.temp)}</span><span class="hour-temp-deg">°</span></p>
        <div class="hour-icon" title="${w.label}">${w.icon}</div>
      </div>
    `;
  }).join('');

  els.hourly.innerHTML = renderSet() + renderSet();
  resetCarouselScroll();
}

// ---- Slow ambient auto-scroll for the hourly carousel -------------------
function startCarouselScroll(){
  if(scrollRAF) cancelAnimationFrame(scrollRAF);

  function step(){
    if(!scrollPaused && els.carousel){
      els.carousel.scrollLeft += scrollSpeed;
      const halfWidth = els.hourly.scrollWidth / 2;
      if(els.carousel.scrollLeft >= halfWidth){
        els.carousel.scrollLeft -= halfWidth; // seamless loop back to start
      }
    }
    scrollRAF = requestAnimationFrame(step);
  }
  scrollRAF = requestAnimationFrame(step);
}

function resetCarouselScroll(){
  if(els.carousel) els.carousel.scrollLeft = 0;
}

els.carousel?.addEventListener('mouseenter', () => scrollPaused = true);
els.carousel?.addEventListener('mouseleave', () => { scrollPaused = false; stopDrag(); });
els.carousel?.addEventListener('touchstart', () => scrollPaused = true, { passive:true });
els.carousel?.addEventListener('touchend', () => setTimeout(() => scrollPaused = false, 1500));

// ---- Manual click-and-drag support (desktop mouse) — touch already
// scrolls natively since the carousel now uses overflow-x:auto instead
// of overflow:hidden. ----
let isDragging = false;
let dragStartX = 0;
let dragStartScroll = 0;

function stopDrag(){
  isDragging = false;
  els.carousel?.classList.remove('dragging');
}

els.carousel?.addEventListener('mousedown', (ev) => {
  isDragging = true;
  scrollPaused = true;
  els.carousel.classList.add('dragging');
  dragStartX = ev.pageX;
  dragStartScroll = els.carousel.scrollLeft;
});
window.addEventListener('mousemove', (ev) => {
  if(!isDragging) return;
  ev.preventDefault();
  els.carousel.scrollLeft = dragStartScroll - (ev.pageX - dragStartX);
});
window.addEventListener('mouseup', () => {
  if(isDragging){ stopDrag(); setTimeout(() => scrollPaused = false, 1500); }
});

// ---- City tabs rendering -----------------------------------------
function renderTabs(){
  els.cityTabs.innerHTML = '';

  cities.forEach(city => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (city.id === activeCityId ? ' active' : '');
    tab.dataset.cityId = city.id;

    const label = document.createElement('span');
    label.textContent = city.name;
    tab.appendChild(label);

    if(city.removable){
      const remove = document.createElement('span');
      remove.className = 'tab-remove';
      remove.textContent = '✕';
      remove.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeCity(city.id);
      });
      tab.appendChild(remove);
    }

    tab.addEventListener('click', () => selectCity(city.id));
    els.cityTabs.appendChild(tab);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.id = 'addCityBtn';
  addBtn.setAttribute('aria-label', 'Ajouter une ville');
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => els.searchInput.focus());
  els.cityTabs.appendChild(addBtn);
}

function removeCity(id){
  cities = cities.filter(c => c.id !== id);
  if(activeCityId === id){
    selectCity('current');
  }else{
    renderTabs();
  }
}

function selectCity(id){
  activeCityId = id;
  renderTabs();
  const city = cities.find(c => c.id === id);
  if(!city) return;

  if(city.isCurrentLocation){
    locateAndLoad();
  }else{
    loadWeather(city.lat, city.lon, city.name);
  }
}

// ---- Full load pipeline ----------------------------------------
async function loadWeather(lat, lon, knownName){
  els.status.textContent = 'Chargement des données météo…';
  try{
    const [cityName, data] = await Promise.all([
      knownName ? Promise.resolve(knownName) : getCityName(lat, lon),
      getForecast(lat, lon)
    ]);
    lastForecast = data;
    renderCurrent(cityName, data);
    renderHourly(data, activeDay, activeRes);
    startCarouselScroll();
    els.status.textContent = '';
  }catch(e){
    els.status.textContent = "Impossible de récupérer la météo. Réessaie.";
    console.error(e);
  }
}

// ---- Geolocation ---------------------------------------------
function locateAndLoad(){
  els.status.textContent = 'Localisation en cours…';
  if(!navigator.geolocation){
    els.status.textContent = "La géolocalisation n'est pas supportée par ce navigateur.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      console.warn(err);
      els.status.textContent = "Localisation refusée — affichage de Paris par défaut.";
      loadWeather(48.8566, 2.3522, 'Paris'); // fallback
    },
    { enableHighAccuracy:true, timeout:10000 }
  );
}

// ---- Search dropdown logic ----------------------------------------
function closeSearchResults(){
  els.searchResults.classList.remove('open');
  els.searchResults.innerHTML = '';
}

function renderSearchResults(results){
  els.searchResults.innerHTML = '';

  if(results.length === 0){
    els.searchResults.innerHTML = `<div class="search-result-empty">Aucune ville trouvée.</div>`;
    els.searchResults.classList.add('open');
    return;
  }

  results.forEach(r => {
    const item = document.createElement('button');
    item.className = 'search-result-item';
    const region = [r.admin1, r.country].filter(Boolean).join(', ');
    item.innerHTML = `<span class="r-name">${r.name}</span><span class="r-region">${region}</span>`;
    item.addEventListener('click', () => {
      const id = `city-${r.id}`;
      if(!cities.find(c => c.id === id)){
        cities.push({
          id,
          name: r.name,
          country: r.country,
          lat: r.latitude,
          lon: r.longitude,
          removable: true,
        });
      }
      els.searchInput.value = '';
      closeSearchResults();
      selectCity(id);
    });
    els.searchResults.appendChild(item);
  });

  els.searchResults.classList.add('open');
}

els.searchInput.addEventListener('input', () => {
  const q = els.searchInput.value.trim();
  clearTimeout(searchDebounce);

  if(q.length < 2){
    closeSearchResults();
    return;
  }

  els.searchResults.innerHTML = `<div class="search-result-loading">Recherche…</div>`;
  els.searchResults.classList.add('open');

  searchDebounce = setTimeout(async () => {
    try{
      const results = await searchCities(q);
      renderSearchResults(results);
    }catch(e){
      els.searchResults.innerHTML = `<div class="search-result-empty">Erreur de recherche.</div>`;
      console.error(e);
    }
  }, 400);
});

document.addEventListener('click', (ev) => {
  if(!ev.target.closest('.search-wrap')) closeSearchResults();
});

// ---- Events ------------------------------------------------
els.refreshBtn.addEventListener('click', () => selectCity(activeCityId));

els.dayBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.dayBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDay = btn.dataset.day;
    if(lastForecast) renderHourly(lastForecast, activeDay, activeRes);
  });
});

els.resBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.resBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRes = parseInt(btn.dataset.res, 10);
    if(lastForecast) renderHourly(lastForecast, activeDay, activeRes);
  });
});

// ============================================================
// Avatar picker — utilise la librairie d'avatars open-source DiceBear
// (style "Avataaars") pour proposer de vrais visages modernes, variés
// (hommes, femmes, styles différents), plutôt que des silhouettes plates.
// Nécessite une connexion internet côté navigateur (l'app va chercher les
// images sur api.dicebear.com), comme pour les polices Google Fonts.
// Le choix est mémorisé dans le navigateur (localStorage).
// ============================================================
// Pour ajouter un avatar : une ligne ici (seed = graine qui détermine le
// visage généré, bg = couleur de fond pastel). Voir https://dicebear.com
// pour explorer d'autres seeds/styles (personas, notionists, lorelei...).
const AVATARS = [
  { id:'a1',  seed:'Aiden',   bg:'b6e3f4' },
  { id:'a2',  seed:'Amara',   bg:'ffd5dc' },
  { id:'a3',  seed:'Felix',   bg:'c0aede' },
  { id:'a4',  seed:'Sofia',   bg:'ffdfbf' },
  { id:'a5',  seed:'Marcus',  bg:'d1d4f9' },
  { id:'a6',  seed:'Elena',   bg:'b6e3f4' },
  { id:'a7',  seed:'Kwame',   bg:'ffd5dc' },
  { id:'a8',  seed:'Nadia',   bg:'c0aede' },
  { id:'a9',  seed:'Diego',   bg:'ffdfbf' },
  { id:'a10', seed:'Priya',   bg:'d1d4f9' },
  { id:'a11', seed:'Louis',   bg:'b6e3f4' },
  { id:'a12', seed:'Chloe',   bg:'ffd5dc' },
];

function avatarUrl(a){
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(a.seed)}&backgroundColor=${a.bg}`;
}

function initAvatar(){
  const savedId = localStorage.getItem('weatherAvatarId') || AVATARS[0].id;
  const savedAvatar = AVATARS.find(a => a.id === savedId) || AVATARS[0];
  els.avatarDisplay.innerHTML = `<img src="${avatarUrl(savedAvatar)}" alt="Avatar">`;

  els.avatarGrid.innerHTML = AVATARS.map(a => `
    <button class="avatar-option${a.id === savedAvatar.id ? ' selected' : ''}" data-avatar="${a.id}">
      <img src="${avatarUrl(a)}" alt="Avatar" loading="lazy">
    </button>
  `).join('');

  els.avatarGrid.querySelectorAll('.avatar-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = AVATARS.find(a => a.id === btn.dataset.avatar);
      localStorage.setItem('weatherAvatarId', chosen.id);
      els.avatarDisplay.innerHTML = `<img src="${avatarUrl(chosen)}" alt="Avatar">`;
      els.avatarGrid.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      closeAvatarPicker();
    });
  });
}

function openAvatarPicker(){ els.avatarPicker.classList.add('open'); }
function closeAvatarPicker(){ els.avatarPicker.classList.remove('open'); }

els.avatarBtn.addEventListener('click', (ev) => {
  ev.stopPropagation();
  els.avatarPicker.classList.toggle('open');
});
document.addEventListener('click', (ev) => {
  if(!ev.target.closest('.avatar-wrap')) closeAvatarPicker();
});

// ============================================================
// Settings panel — unité °C/°F + thème sombre/clair.
// Ouvert par le bouton ☰ (menuBtn) ET par le bouton "Réglages" du bas.
// ============================================================
function openSettings(){
  els.settingsPanel.classList.add('open');
  els.settingsOverlay.classList.add('open');
  setActiveNav('settings');
}
function closeSettingsPanel(){
  els.settingsPanel.classList.remove('open');
  els.settingsOverlay.classList.remove('open');
  setActiveNav('home');
}

els.menuBtn.addEventListener('click', openSettings);
els.navSettings.addEventListener('click', openSettings);
els.closeSettings.addEventListener('click', closeSettingsPanel);
els.settingsOverlay.addEventListener('click', closeSettingsPanel);

els.unitToggle.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    els.unitToggle.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    unit = btn.dataset.unit;
    localStorage.setItem('weatherUnit', unit);
    if(lastForecast){
      renderCurrent(els.city.textContent, lastForecast);
      renderHourly(lastForecast, activeDay, activeRes);
    }
  });
});

els.iconStyleToggle.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    els.iconStyleToggle.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    iconStyle = btn.dataset.iconStyle;
    localStorage.setItem('weatherIconStyle', iconStyle);
    if(lastForecast){
      renderCurrent(els.city.textContent, lastForecast);
      renderHourly(lastForecast, activeDay, activeRes);
    }
  });
});

function applyTheme(theme){
  document.body.classList.toggle('theme-light', theme === 'light');
  localStorage.setItem('weatherTheme', theme);
}

els.themeToggle.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    els.themeToggle.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyTheme(btn.dataset.theme);
  });
});

// ============================================================
// Favorites sheet — liste complète des villes enregistrées,
// avec sélection et suppression rapides.
// ============================================================
function openFavorites(){
  renderFavoritesList();
  els.favoritesSheet.classList.add('open');
  els.favoritesOverlay.classList.add('open');
  setActiveNav('favorites');
}
function closeFavoritesSheet(){
  els.favoritesSheet.classList.remove('open');
  els.favoritesOverlay.classList.remove('open');
  setActiveNav('home');
}

function renderFavoritesList(){
  if(cities.length === 0){
    els.favoritesList.innerHTML = `<p class="favorites-empty">Aucune ville enregistrée pour le moment.</p>`;
    return;
  }
  els.favoritesList.innerHTML = cities.map(city => `
    <div class="favorite-row${city.id === activeCityId ? ' active' : ''}" data-city-id="${city.id}">
      <div>
        <p class="favorite-name">${city.name}</p>
        <p class="favorite-sub">${city.isCurrentLocation ? 'Position actuelle' : (city.country || '')}</p>
      </div>
      ${city.removable ? `<button class="favorite-remove" data-remove="${city.id}">✕</button>` : ''}
    </div>
  `).join('');

  els.favoritesList.querySelectorAll('.favorite-row').forEach(row => {
    row.addEventListener('click', (ev) => {
      if(ev.target.closest('[data-remove]')) return;
      selectCity(row.dataset.cityId);
      closeFavoritesSheet();
    });
  });
  els.favoritesList.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeCity(btn.dataset.remove);
      renderFavoritesList();
    });
  });
}

els.navFavorites.addEventListener('click', openFavorites);
els.closeFavorites.addEventListener('click', closeFavoritesSheet);
els.favoritesOverlay.addEventListener('click', closeFavoritesSheet);

// ============================================================
// Bottom nav wiring — chaque bouton a désormais une action propre.
// ============================================================
function setActiveNav(which){
  [els.navHome, els.navLocate, els.navFavorites, els.navSettings].forEach(b => b.classList.remove('active'));
  const map = { home: els.navHome, locate: els.navLocate, favorites: els.navFavorites, settings: els.navSettings };
  map[which]?.classList.add('active');
}

els.navHome.addEventListener('click', () => {
  closeSettingsPanel();
  closeFavoritesSheet();
  setActiveNav('home');
  window.scrollTo({ top: 0, behavior:'smooth' });
});

els.navLocate.addEventListener('click', () => {
  closeSettingsPanel();
  closeFavoritesSheet();
  setActiveNav('home'); // "Ma position" redevient la ville active dans les onglets
  selectCity('current');
});

// ---- Init ----------------------------------------------------
initAvatar();
applyTheme(localStorage.getItem('weatherTheme') || 'dark');
if(localStorage.getItem('weatherTheme') === 'light'){
  els.themeToggle.querySelector('[data-theme="light"]').classList.add('active');
  els.themeToggle.querySelector('[data-theme="dark"]').classList.remove('active');
}
if(unit === 'F'){
  els.unitToggle.querySelector('[data-unit="F"]').classList.add('active');
  els.unitToggle.querySelector('[data-unit="C"]').classList.remove('active');
}
if(iconStyle === 'minimal'){
  els.iconStyleToggle.querySelector('[data-icon-style="minimal"]').classList.add('active');
  els.iconStyleToggle.querySelector('[data-icon-style="gloss"]').classList.remove('active');
}
renderTabs();
selectCity('current');
