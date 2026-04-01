(function () {
  // WMO weather interpretation codes -> label + emoji
  const WMO = {
    0:  ['Clear sky',        '\u2600\uFE0F'],
    1:  ['Mainly clear',     '\uD83C\uDF24\uFE0F'],
    2:  ['Partly cloudy',    '\u26C5'],
    3:  ['Overcast',         '\u2601\uFE0F'],
    45: ['Foggy',            '\uD83C\uDF2B\uFE0F'],
    48: ['Icy fog',          '\uD83C\uDF2B\uFE0F'],
    51: ['Light drizzle',    '\uD83C\uDF26\uFE0F'],
    53: ['Drizzle',          '\uD83C\uDF26\uFE0F'],
    55: ['Heavy drizzle',    '\uD83C\uDF26\uFE0F'],
    61: ['Light rain',       '\uD83C\uDF27\uFE0F'],
    63: ['Rain',             '\uD83C\uDF27\uFE0F'],
    65: ['Heavy rain',       '\uD83C\uDF27\uFE0F'],
    71: ['Light snow',       '\u2744\uFE0F'],
    73: ['Snow',             '\u2744\uFE0F'],
    75: ['Heavy snow',       '\u2744\uFE0F'],
    77: ['Snow grains',      '\uD83C\uDF28\uFE0F'],
    80: ['Light showers',    '\uD83C\uDF26\uFE0F'],
    81: ['Showers',          '\uD83C\uDF27\uFE0F'],
    82: ['Heavy showers',    '\uD83C\uDF27\uFE0F'],
    85: ['Snow showers',     '\u2744\uFE0F'],
    86: ['Heavy snow showers','\u2744\uFE0F'],
    95: ['Thunderstorm',     '\u26C8\uFE0F'],
    96: ['Thunderstorm',     '\u26C8\uFE0F'],
    99: ['Thunderstorm',     '\u26C8\uFE0F'],
  };

  function setError(msg) {
    document.getElementById('w-desc').textContent = msg;
    document.getElementById('w-icon').textContent = '\u2013';
    document.getElementById('w-temp').textContent = '';
    document.getElementById('weather-widget').classList.remove('w-loading');
  }

  function setDenied() {
    var widget = document.getElementById('weather-widget');
    var body   = widget.querySelector('.w-body');
    body.innerHTML =
      '<span class="w-denied-icon">\uD83D\uDCCD</span>' +
      '<p class="w-denied-msg">' +
        '<strong>Location access off</strong>' +
        'Enable location in your browser to see local weather.' +
      '</p>';
    widget.classList.remove('w-loading');
    widget.classList.add('w-denied');
  }

  function fetchWeather(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecastbreakhere'
      + '?latitude='  + lat
      + '&longitude=' + lon
      + '&current=temperature_2m,weathercodebreakheretoo'
      + '&daily=weathercode,temperature_2m_max,temperature_2m_min'
      + '&temperature_unit=fahrenheit'
      + '&wind_speed_unit=mph'
      + '&forecast_days=5'
      + '&timezone=auto';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Weather fetch failed');
        return r.json();
      })
      .then(function (data) {
        // ── Today strip ──
        var temp    = Math.round(data.current.temperature_2m);
        var code    = data.current.weathercode;
        var info    = WMO[code] || ['Unknown', '\u2601\uFE0F'];
        document.getElementById('w-temp').textContent = temp + '\u00B0F';
        document.getElementById('w-desc').textContent = info[0];
        document.getElementById('w-icon').textContent = info[1];

        // ── 5-day rows ──
        var days    = data.daily.time;                   // ['2026-04-01', ...]
        var codes   = data.daily.weathercode;
        var highs   = data.daily.temperature_2m_max;
        var lows    = data.daily.temperature_2m_min;
        var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var container = document.getElementById('w-days');
        container.innerHTML = '';

        for (var i = 0; i < days.length; i++) {
          var d      = new Date(days[i] + 'T12:00:00'); // noon avoids TZ flip
          var label  = i === 0 ? 'Today' : DAY_NAMES[d.getDay()];
          var dInfo  = WMO[codes[i]] || ['', '\u2601\uFE0F'];
          var hi     = Math.round(highs[i]);
          var lo     = Math.round(lows[i]);

          var row = document.createElement('div');
          row.className = 'w-day';
          row.innerHTML =
            '<span class="w-day-name' + (i === 0 ? ' is-today' : '') + '">' + label + '</span>' +
            '<span class="w-day-icon">' + dInfo[1] + '</span>' +
            '<span class="w-day-temps">' + hi + '\u00B0' +
              '<span class="w-day-lo">' + lo + '\u00B0</span>' +
            '</span>';
          container.appendChild(row);
        }

        document.getElementById('weather-widget').classList.remove('w-loading');
      })
      .catch(function () { setError('Unavailable'); });
  }

  function fetchCity(lat, lon) {
    var url = 'https://nominatim.openstreetmap.org/reverse'
      + '?lat=' + lat
      + '&lon=' + lon
      + '&format=json';

    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var city = (data.address && (
          data.address.city ||
          data.address.town ||
          data.address.village ||
          data.address.county
        )) || '';
        if (city) document.getElementById('w-loc').textContent = city;
      })
      .catch(function () { /* city label is optional */ });
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        fetchWeather(lat, lon);
        fetchCity(lat, lon);
      },
      function () { setDenied(); }
    );
  } else {
    setDenied();
  }
})();

// ── Collapse / expand toggle ──
(function () {
  var widget = document.getElementById('weather-widget');
  var btn    = document.getElementById('w-toggle-btn');
  var STORAGE_KEY = 'wx-collapsed';

  // Restore last state
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    widget.classList.add('w-collapsed');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function () {
    var isCollapsed = widget.classList.toggle('w-collapsed');
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    localStorage.setItem(STORAGE_KEY, isCollapsed ? '1' : '0');
  });

  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
})();
