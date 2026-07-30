import { z } from 'zod'

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
)

const browserEnvSchema = z.object({
  VITE_APP_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  VITE_DEMO_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
  VITE_GOOGLE_MAPS_BROWSER_API_KEY: z.string().optional(),
  VITE_GOOGLE_MAP_ID: z.string().optional(),
  VITE_GOOGLE_MAP_STYLE_MODE: z
    .enum(['embedded', 'cloud'])
    .default('embedded'),
  VITE_SENTRY_DSN: optionalUrl,
})

const result = browserEnvSchema.safeParse(import.meta.env)

if (!result.success) {
  throw new Error(`Invalid browser environment: ${z.prettifyError(result.error)}`)
}

export const env = result.data

export const supabaseBrowserKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY

export const hasLiveBackend =
  !env.VITE_DEMO_MODE &&
  Boolean(env.VITE_SUPABASE_URL && supabaseBrowserKey)
