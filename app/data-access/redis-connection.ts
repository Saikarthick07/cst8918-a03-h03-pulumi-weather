import { createClient } from 'redis'

const url = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = await createClient({ url })
  .on('error', err => console.error('Redis client connection error', err))
  .connect()
