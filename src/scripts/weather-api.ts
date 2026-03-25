/**
 * Weather API client using Open-Meteo (free, no API key required).
 * Perfect for a project that deploys to Cloudflare Pages with no backend.
 */

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  name: string;
  region?: string;
  country?: string;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  weatherCode: number;
  isDay: boolean;
  precipitation: number;
  cloudCover: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
}

export interface HourlyForecast {
  time: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  weatherCode: number;
  precipitation: number;
  precipitationProbability: number;
  cloudCover: number;
  visibility: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  weatherCode: number;
  sunrise: Date;
  sunset: Date;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  uvIndexMax: number;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  fetchedAt: Date;
}

// WMO Weather interpretation codes
const WEATHER_DESCRIPTIONS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: 'clear' },
  1: { label: 'Mainly clear', icon: 'clear' },
  2: { label: 'Partly cloudy', icon: 'partly-cloudy' },
  3: { label: 'Overcast', icon: 'overcast' },
  45: { label: 'Foggy', icon: 'fog' },
  48: { label: 'Rime fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  55: { label: 'Dense drizzle', icon: 'drizzle' },
  56: { label: 'Freezing drizzle', icon: 'freezing' },
  57: { label: 'Dense freezing drizzle', icon: 'freezing' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'freezing' },
  67: { label: 'Heavy freezing rain', icon: 'freezing' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Light showers', icon: 'rain' },
  81: { label: 'Showers', icon: 'rain' },
  82: { label: 'Heavy showers', icon: 'rain' },
  85: { label: 'Light snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'storm' },
};

export function getWeatherDescription(code: number): { label: string; icon: string } {
  return WEATHER_DESCRIPTIONS[code] ?? { label: 'Unknown', icon: 'clear' };
}

export function getWindDirectionLabel(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Get user's current location via Geolocation API
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 minute cache
    });
  });
}

/**
 * Reverse geocode coordinates to a place name using Open-Meteo's geocoding
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; region: string; country: string }> {
  // Use Nominatim for reverse geocoding (free, no key)
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Meridian/1.0' },
  });

  if (!res.ok) {
    return { name: 'Unknown', region: '', country: '' };
  }

  const data = await res.json();
  const addr = data.address || {};

  const name = addr.city || addr.town || addr.village || addr.county || addr.state || 'Unknown';
  const region = addr.state || '';
  const country = addr.country_code?.toUpperCase() || '';

  return { name, region, country };
}

/**
 * Search for locations by name using Open-Meteo geocoding
 */
export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);

  if (!res.ok) return [];

  const data = await res.json();
  if (!data.results) return [];

  return data.results.map((r: any) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    name: r.name,
    region: r.admin1 || '',
    country: r.country || '',
  }));
}

/**
 * Fetch complete weather data from Open-Meteo
 */
export async function fetchWeather(lat: number, lon: number): Promise<Omit<WeatherData, 'location'>> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      'weather_code', 'is_day', 'precipitation', 'cloud_cover',
      'surface_pressure', 'visibility', 'uv_index',
    ].join(','),
    hourly: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      'weather_code', 'precipitation', 'precipitation_probability',
      'cloud_cover', 'visibility', 'is_day',
    ].join(','),
    daily: [
      'temperature_2m_max', 'temperature_2m_min', 'weather_code',
      'sunrise', 'sunset', 'precipitation_sum',
      'precipitation_probability_max', 'wind_speed_10m_max',
      'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'uv_index_max',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '7',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const data = await res.json();

  const current: CurrentWeather = {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    windGusts: data.current.wind_gusts_10m,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    precipitation: data.current.precipitation,
    cloudCover: data.current.cloud_cover,
    pressure: data.current.surface_pressure,
    visibility: data.current.visibility,
    uvIndex: data.current.uv_index,
  };

  const hourly: HourlyForecast[] = data.hourly.time.map((t: string, i: number) => ({
    time: new Date(t),
    temperature: data.hourly.temperature_2m[i],
    feelsLike: data.hourly.apparent_temperature[i],
    humidity: data.hourly.relative_humidity_2m[i],
    windSpeed: data.hourly.wind_speed_10m[i],
    windDirection: data.hourly.wind_direction_10m[i],
    windGusts: data.hourly.wind_gusts_10m[i],
    weatherCode: data.hourly.weather_code[i],
    precipitation: data.hourly.precipitation[i],
    precipitationProbability: data.hourly.precipitation_probability[i],
    cloudCover: data.hourly.cloud_cover[i],
    visibility: data.hourly.visibility[i],
    isDay: data.hourly.is_day[i] === 1,
  }));

  const daily: DailyForecast[] = data.daily.time.map((t: string, i: number) => ({
    date: new Date(t),
    temperatureMax: data.daily.temperature_2m_max[i],
    temperatureMin: data.daily.temperature_2m_min[i],
    weatherCode: data.daily.weather_code[i],
    sunrise: new Date(data.daily.sunrise[i]),
    sunset: new Date(data.daily.sunset[i]),
    precipitationSum: data.daily.precipitation_sum[i],
    precipitationProbabilityMax: data.daily.precipitation_probability_max[i],
    windSpeedMax: data.daily.wind_speed_10m_max[i],
    windGustsMax: data.daily.wind_gusts_10m_max[i],
    windDirectionDominant: data.daily.wind_direction_10m_dominant[i],
    uvIndexMax: data.daily.uv_index_max[i],
  }));

  return { current, hourly, daily, fetchedAt: new Date() };
}

/**
 * Persist weather data to localStorage for offline access
 */
export function cacheWeatherData(data: WeatherData): void {
  try {
    localStorage.setItem('meridian_weather', JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Load cached weather data
 */
export function loadCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem('meridian_weather');
    if (!raw) return null;

    const data = JSON.parse(raw);
    // Reconstitute dates
    data.fetchedAt = new Date(data.fetchedAt);
    data.hourly = data.hourly.map((h: any) => ({ ...h, time: new Date(h.time) }));
    data.daily = data.daily.map((d: any) => ({
      ...d,
      date: new Date(d.date),
      sunrise: new Date(d.sunrise),
      sunset: new Date(d.sunset),
    }));

    return data;
  } catch {
    return null;
  }
}

/**
 * Save last known location
 */
export function saveLocation(location: WeatherLocation): void {
  try {
    localStorage.setItem('meridian_location', JSON.stringify(location));
  } catch {
    // Storage unavailable
  }
}

/**
 * Load last known location
 */
export function loadLocation(): WeatherLocation | null {
  try {
    const raw = localStorage.getItem('meridian_location');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
