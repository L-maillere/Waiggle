import { z } from 'zod'

export const ErrorCode = z.enum(['not_found', 'validation', 'internal'])
export type ErrorCode = z.infer<typeof ErrorCode>

/** Every error the API returns has this shape; `message` is in the client's language. */
export const ErrorResponse = z
  .object({
    error: z.object({
      code: ErrorCode,
      message: z.string(),
    }),
  })
  .meta({ id: 'ErrorResponse' })

export type ErrorResponse = z.infer<typeof ErrorResponse>
