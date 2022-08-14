const token = "pk.eyJ1IjoicmFtaW5lbG51bmV6IiwiYSI6ImNreDZzcWt5ZTA1Znkyb254MWZxdGk0ODUifQ.rDi0UeZg7jDeR8_ryr7FuA";
const apiKey = "1vbBsFqGS6MWA0hvpBq0";
const winnipegTransit = "https://api.winnipegtransit.com/v3/";
const mapBox = "https://api.mapbox.com/geocoding/v5/mapbox.places/";

const coords = {
  latitude: 49.895077,
  longitude: -97.138451,

  get log() {
    console.log(`latitde, longitude`)
    console.log(`${this.latitude}, ${this.longitude}`)
  }
};

const html = {
  originForm: document.getElementsByClassName('origin-form')[0],
  originInput: document.getElementsByTagName('input')[0],
  originsContainer: document.getElementsByClassName('origins')[0],
  destinationForm: document.getElementsByClassName('destination-form')[0],
  destinationInput: document.getElementsByTagName('input')[1],
  destinationContainer: document.getElementsByClassName('destinations')[0],
  planTrip: document.getElementsByClassName('plan-trip')[0],
  myTrip: document.getElementsByClassName('my-trip')[0],
  map: document.getElementById('map'),
  errors: document.getElementsByClassName('errors')[0],
  currentConditions: document.getElementsByClassName('current-conditions')[0],
  forecast: document.getElementsByClassName('forecast')[0]
}

const info = {
  origins: [],
  destinations: [],
}

const selected = {
  origin: undefined,
  destination: undefined,
}

let errors = 0;

let routes = [];

async function getGeocode (qString) {
  const targetURL =`${mapBox}${qString}.json?types=address&access_token=${token}&proximity=${coords.longitude},${coords.latitude}&types=poi`
  const response = await fetch(targetURL);
  const data = await response.json();
  return data.features;
};

async function search(search_text, location) {
  const searchResults = await getGeocode(search_text);
  let results = [];
  for (let item of searchResults) {
    let itemInfo = item.place_name.split(', ')
    let name = itemInfo[0];
    let address = itemInfo[1];
    let coords = item.geometry.coordinates
    let key = await getKey(coords.reverse());
    if (itemInfo.includes('Winnipeg') === true) {
      results.push(new Result(name, address, coords, key))
    }
  }
  if (results.length === 0) {
    error(300);
  }
  if (location === 'origin') {
    info.origins = results;
  }
  if (location === 'destination') {
    info.destinations = results;
  }
  render(location)
}

class Result {
  constructor(name, address, coords, key) {
    this.name = name;
    this.address = address;
    this.coords = coords;
    this.key = key;
  }
}

class Walk {
  constructor(duration, destination) {
    this.message = `Walk for ${duration} minutes to ${destination[0]}${destination[1]}${destination[2]}${destination[3]}`;
    this.icon = 'walking';
  }
}

class Ride {
  constructor (route, duration) {
    this.message = `Ride the ${route} for ${duration} minutes`;
    this.icon = 'bus';
  }
}

class Transfer {
  constructor(origin, destination) {
    this.message = `Transfer from stop #${origin[0]} - ${origin[1]} to stop #${destination[0]} - ${destination[1]}`
    this.icon = 'ticket-alt'
  }
}

async function getKey(coords) {
  const targetURL = `${winnipegTransit}locations.json?api-key=${apiKey}&lat=${coords[0]}&lon=${coords[1]}`;
  const response = await fetch(targetURL);
  const data = await response.json();
  if (data.locations.length > 0) {
    if (data.locations[0].type === "address") {
      return data.locations[0].key;
    }
    if (data.locations[0].type === "monument") {
      return data.locations[0].address.key;
    }
  } else {
    return 'there was some error';
  }
}

async function getRoute(origKey, destKey) {
  const targetURL = `${winnipegTransit}trip-planner.json?api-key=${apiKey}&origin=addresses/${origKey}&destination=addresses/${destKey}`
  const response = await fetch(targetURL);
  const data = await response.json();
  parseRoute(data);
}

async function parseRoute(data) {
  routes = []
  for (let plan of data.plans) {
    let route = [];
    let i = 0
    for (let segment of plan.segments) {
      i++
      if (segment.type === 'walk') {
        if (i === plan.segments.length) {
          route.push(new Walk(segment.times.durations.total, ["your ", "destination.", "", ""] ));
        } else if (i < plan.segments.length) {
          route.push(new Walk(segment.times.durations.total, ["stop #", segment.to.stop.key, " - ",segment.to.stop.name]));
        }
      }
      if (segment.type === 'ride') {
        route.push(new Ride(segment.route.name, segment.times.durations.total));
      }
      if (segment.type === 'transfer') {
        route.push(new Transfer([segment.from.stop.key, segment.from.stop.name], [segment.to.stop.key, segment.to.stop.name] ));
      }
    }
    if (route[0] !== undefined) {
      routes.push(route)
    } 
  }
  return routes;
}

function handleInput(e, calledFunction) {
  e.preventDefault();
  calledFunction;
  render();
} 

html.originForm.addEventListener('submit', (e) => handleInput(e, search(html.originInput.value, 'origin')))
html.destinationForm.addEventListener('submit', (e) => handleInput(e, search(html.destinationInput.value, 'destination')))
html.planTrip.addEventListener('click', (e) => planTrip())

async function planTrip() {
  if (selected.origin !== undefined && selected.destination !== undefined) {
    if (routes.length === 0) {
      error(404);
    }
    await getRoute(selected.origin, selected.destination);
    html.myTrip.innerHTML = "";
    for (let segment of routes[0]) {
      html.myTrip.insertAdjacentHTML('beforeend', `
      <li>
        <i class="fas fa-${segment.icon}" aria-hidden="true"></i>
        ${segment.message}
      </li>
      `)
    }
  } else {
    error(100);
  }
}

function render(what) {
  if (what === 'origin' || what === 'all') {
    html.originsContainer.innerHTML = "";
    for (let place of info.origins) {
      html.originsContainer.insertAdjacentHTML('beforeend', `
        <li key="${place.key}" data-long="${place.coords[1]}" data-lat="${place.coords[0]}" class="origin-result">
          <div class="name">${place.name}</div>
          <div>${place.address}</div>
        </li>
      `)
    }
    let originResults = document.getElementsByClassName('origin-result');
    for (let result of originResults) {
      result.addEventListener('click', () => select(result)); //result.setAttribute('class', 'selected'), selected.origin = result.getAttribute('key')
    }
  }

  if (what === 'destination' || what === 'all') {
    html.destinationContainer.innerHTML = "";
    for (let place of info.destinations) {
      html.destinationContainer.insertAdjacentHTML('beforeend', `
        <li key="${place.key}" data-long="${place.coords[1]}" data-lat="${place.coords[0]}" class="destination-result">
          <div class="name">${place.name}</div>
          <div>${place.address}</div>
        </li>
      `)
    }
    let destinationResults = document.getElementsByClassName('destination-result');
    for (let result of destinationResults) {
      result.addEventListener('click', () => select(result));
    }
  }

  if (what === 'routes' || what === 'all') {
    html.myTrip.innerHTML = "";
  }
}


let lat;
let lon;

render('all')

function error(index) {
  errors++;
  if (index === 100) {
    html.errors.insertAdjacentHTML('afterbegin', `
      <hr>
      <h3 class="error-message"> ERROR #${errors}: Please select both starting place and destination </h3>
    `);
  }

  if (index === 300) {
    html.errors.insertAdjacentHTML('afterbegin', `
      <hr>
      <h3 class="error-message"> ERROR #${errors}: No search results available on that</h3>
    `);
  }

  if (index === 404) {
    html.errors.insertAdjacentHTML('afterbegin', `
      <hr>
      <h3 class="error-message"> ERROR #${errors}: There are no buses running there at this time...</h3>
    `);
  }
  clearErrors();
}

function clearErrors() {
  setTimeout(function(){ html.errors.innerHTML = "";}, 3000);
}

//---------------------------------------------------------------------------//


const mapToken = 'pk.eyJ1IjoicmFtaW5lbG51bmV6IiwiYSI6ImNreDZzb2NsYzA1NDQyd3J5d2hjc3F1cm4ifQ.jlQUIyabKSE-JeAVBU_YbA';

mapboxgl.accessToken = mapToken;
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [coords.longitude, coords.latitude],
  zoom: 12,
});

const markerLocation = new mapboxgl.Marker();

markerLocation.setLngLat([coords.longitude, coords.latitude]).addTo(map)

const getGeocode2 = async function (qString) {
  const targetUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${qString}.json?access_token=${mapToken}&limit=10&proximity=${coords.longitude},${coords.latitude}&types=poi`;
  const response = await fetch(targetUrl);
  const data = await response.json();
  return data;
};

const getDistance = function (arr) {
  const [long, lat] = arr;
  const longDiffKM = Math.abs(long - coords.longitude) * 111.319;
  const latDiffKM = Math.abs(lat - coords.latitude) * 111.319;
  const distance = Math.sqrt(longDiffKM ** 2 + latDiffKM ** 2);

  return distance;
};


// ------------------------------------------------------------------------------------------------------------------//

const form = document.getElementsByTagName('form')[0];
const button = document.getElementsByTagName('button')[0];

const WeatherBaseURL = 'http://api.openweathermap.org/data/2.5/';
let WeatherAPIKey = 'a230cd15bf0b29b71caeacb711a2ada6';
const kelvin = 273.15;
const date = new Date();
const week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let currentWeather;
let weeklyWeather = [];


function getCurrentWeather() {
  return fetch(`${WeatherBaseURL}weather?lat=${lat}&lon=${lon}&appid=${WeatherAPIKey}`)
  .then((response) => response.json())
  .then((data) => currentWeather = new CurrentWeather(
    data.weather[0].icon, data.main.temp, data.weather[0].description))
};

function getForecast() {
  return fetch(`${WeatherBaseURL}forecast?lat=${lat}&lon=${lon}&appid=${WeatherAPIKey}`)
  .then((response) => response.json())
  .then((data) => parseForecast(data.list))
  .then(() => renderWeather(currentWeather, weeklyWeather))
  .then(() => weeklyWeather = []);
};

function parseForecast(array) {
  let dates = []
  let datesInfoArray = [[],[],[],[],[]];
  for (let i = 0; i < 5; i++) {
    let earlyMonth = false
    if (date.getMonth % 2 == 0 && date.getMonth != 8) {
      earlyMonth = true;
    }
    dates[i] = (date.getDate() + i + 1)
    if (earlyMonth && date.getDate() + i + 1 > 30) {
      dates[i] = (date.getDate() + i + 1) - 30;
    }
    if (!earlyMonth && date.getDate() + i + 1 > 31) {
      dates[i] = (date.getDate() + i + 1) - 31;
    }
    if (date.getMonth == 2) {
      dates[i] = (date.getDate() + i + 1) - 28;
    }
  };
  
  for (let item of array) {
    let itemDate = parseInt(item.dt_txt[8].toString() + item.dt_txt[9].toString());
    for(let i = 0; i < dates.length; i++) {
      if (itemDate === dates[i]) {
        datesInfoArray[i].push(item)
      }
    }
  }

  let weekDayInt = date.getDay();
  let dateInt = date.getDate();
  for (let day of datesInfoArray) {
    weekDayInt++
    dateInt++
    let minTemp = undefined;
    let maxTemp = undefined;
    for (let trihour of day) {
      if (minTemp === undefined || trihour.main.temp_min < minTemp) {
        minTemp = trihour.main.temp_min
      }
      if (maxTemp === undefined || trihour.main.temp_max > maxTemp) {
        maxTemp = trihour.main.temp_max
      }
    }
    let icon = day[4].weather[0].icon; 
    let description = day[4].weather[0].description;
    weeklyWeather.push(new DailyWeather(week[weekDayInt], dateInt, icon, description, maxTemp, minTemp))
  }
};

class CurrentWeather {
  constructor(icon, temperature, description) {
    this.imageURL = `http://openweathermap.org/img/wn/${icon}@2x.png`;
    this.temp = temperature;
    this.desc = description;
  };
};

class DailyWeather {
  constructor(day, date, icon, description, maxTemperature, minTemperature) {
    this.day = day;
    this.date = date;
    this.imageURL = `http://openweathermap.org/img/wn/${icon}@2x.png`;
    this.desc = description;
    this.maxTemp = maxTemperature;
    this.minTemp = minTemperature;
  };
};

function renderWeather(currentWeather, weeklyWeather) {
  html.currentConditions.innerHTML = "";
  html.currentConditions.insertAdjacentHTML('afterbegin', `
  <h2>Current Conditions</h2>
  <img src="${currentWeather.imageURL}" />
  <div class="current">
    <div class="temp">${(currentWeather.temp - kelvin).toFixed(0)}℃</div>
    <div class="condition">${currentWeather.desc}</div>
  </div>
  `);

  html.forecast.innerHTML = "";
  weeklyWeather.forEach((day) => {
    html.forecast.insertAdjacentHTML('beforeend', `
    <div class="day">
      <h3>${day.day}</h3>
      <img src="${day.imageURL}" />
      <div class="description">${day.desc}</div>
      <div class="temp">
        <span class="high">${(day.maxTemp - kelvin).toFixed(0)}℃</span>/<span class="low">${(day.minTemp - kelvin).toFixed(0)}℃</span>
      </div>
    </div>
    `);
  });
};

function runWeatherApp() {
  if (lat == null || lon == null) {
    lat = coords.latitude;
    lon = coords.longitude;
  }
    getCurrentWeather();
    getForecast();
}


function select(result) {
  if (result.getAttribute('class') === 'origin-result') {
    let selectedOrigins = document.getElementsByClassName('origin-result selected');
    for (let each of selectedOrigins) {
      each.classList.remove("selected")
    }
    selected.origin = result.getAttribute('key');
    result.setAttribute('class', 'origin-result selected');
  }

  if (result.getAttribute('class') === 'destination-result') {
    let selectedDestinations = document.getElementsByClassName('destination-result selected');
    for (let each of selectedDestinations) {
      each.classList.remove("selected")
    }
    selected.destination = result.getAttribute('key');
    result.setAttribute('class', 'destination-result selected');
  }

    lon = result.dataset.long;
    lat = result.dataset.lat;
    runWeatherApp();

    markerLocation.setLngLat([lon, lat]);
    map.flyTo({ center: [lon, lat] });
}