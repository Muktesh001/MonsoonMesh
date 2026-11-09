/**
 * Weather data adapter
 * Connects to external weather providers (IMD, OpenWeatherMap, NASA GPM)
 * Currently uses mock data with configurable providers
 */
import { pool } from '../db.js';
/**
 * Mock IMD (India Meteorological Department) data
 * Real implementation would call: https://mausam.imd.gov.in/
 */
export async function fetchIMDData() {
    // Mock Pune region weather stations
    const stations = [
        { id: 'imd-pune-1', lat: 18.5204, lon: 73.8567, name: 'Shivajinagar' },
        { id: 'imd-pune-2', lat: 18.5074, lon: 73.8077, name: 'Kothrud' },
        { id: 'imd-pune-3', lat: 18.4801, lon: 73.9266, name: 'Hadapsar' },
    ];
    return stations.map((station) => ({
        provider: 'IMD',
        location: { lat: station.lat, lon: station.lon },
        timestamp: new Date(),
        rainfall_mm: Math.random() * 50, // 0-50mm
        temperature_c: 20 + Math.random() * 15, // 20-35°C
        humidity_percent: 60 + Math.random() * 40, // 60-100%
        wind_speed_kmh: 5 + Math.random() * 25, // 5-30 km/h
    }));
}
/**
 * Mock NASA GPM (Global Precipitation Measurement) data
 * Real implementation would call: https://giovanni.gsfc.nasa.gov/
 */
export async function fetchNASAGPMData() {
    // Simulate satellite-based rainfall estimates
    return [
        {
            provider: 'NASA-GPM',
            location: { lat: 18.52, lon: 73.86 },
            timestamp: new Date(),
            rainfall_mm: Math.random() * 100,
        },
    ];
}
/**
 * Mock OpenWeatherMap data
 * Real implementation would call: https://api.openweathermap.org/
 */
export async function fetchOpenWeatherData() {
    return [
        {
            provider: 'OpenWeather',
            location: { lat: 18.5204, lon: 73.8567 },
            timestamp: new Date(),
            rainfall_mm: Math.random() * 30,
            temperature_c: 22 + Math.random() * 12,
            humidity_percent: 70 + Math.random() * 25,
            wind_speed_kmh: 8 + Math.random() * 20,
        },
    ];
}
/**
 * Ingest weather observation into database
 */
export async function ingestWeatherObservation(obs) {
    const dataSource = await pool.query(`SELECT id FROM data_sources WHERE provider_key = $1 LIMIT 1`, [obs.provider.toLowerCase()]);
    if (!dataSource.rowCount) {
        console.warn(`Data source ${obs.provider} not found in database`);
        return;
    }
    const sourceId = dataSource.rows[0].id;
    const providerKey = `${obs.provider.toLowerCase()}-${Date.now()}`;
    await pool.query(`INSERT INTO weather_observations(
      source_id, provider_record_key, observed_at, location,
      rainfall_mm, is_synthetic
    ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, false)
    ON CONFLICT(source_id, provider_record_key) DO UPDATE
    SET rainfall_mm = EXCLUDED.rainfall_mm,
        observed_at = EXCLUDED.observed_at`, [
        sourceId,
        providerKey,
        obs.timestamp,
        obs.location.lon,
        obs.location.lat,
        obs.rainfall_mm,
    ]);
}
/**
 * Fetch all available weather data from configured providers
 */
export async function fetchAllWeatherData() {
    const [imd, gpm, openweather] = await Promise.all([
        fetchIMDData(),
        fetchNASAGPMData(),
        fetchOpenWeatherData(),
    ]);
    return [...imd, ...gpm, ...openweather];
}
/**
 * Ingest all weather observations
 */
export async function ingestAllWeatherData() {
    const observations = await fetchAllWeatherData();
    let count = 0;
    for (const obs of observations) {
        try {
            await ingestWeatherObservation(obs);
            count++;
        }
        catch (error) {
            console.error(`Failed to ingest ${obs.provider} data:`, error);
        }
    }
    return count;
}
