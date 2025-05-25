import { redis } from '../data-access/redis-connection'

const API_KEY = process.env.WEATHER_API_KEY
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall'
const TEN_MINUTES = 1000 * 60 * 10 // in milliseconds

interface FetchWeatherDataParams {
  lat: number
  lon: number
  units: 'standard' | 'metric' | 'imperial'
}
export async function fetchWeatherData({
  lat,
  lon,
  units
}: FetchWeatherDataParams) {
  const queryString = `lat=${lat}&lon=${lon}&units=${units}`

  const cacheEntry = await redis.get(queryString)
  if (cacheEntry) return JSON.parse(cacheEntry)

  const response = await fetch(`${BASE_URL}?${queryString}&appid=${API_KEY}`)
  const data = await response.text() // avoid an unnecessary extra JSON.stringify
  await redis.set(queryString, data, {PX: TEN_MINUTES}) // The PX option sets the expiry time
  return JSON.parse(data)
}