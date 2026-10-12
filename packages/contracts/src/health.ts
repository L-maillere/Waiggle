import { z } from 'zod'

export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
  })
  .meta({ id: 'HealthResponse', description: 'The API is up and running.' })

export type HealthResponse = z.infer<typeof HealthResponse>
