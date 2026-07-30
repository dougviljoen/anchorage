import { corsHeaders } from '../_shared/cors.ts'

type ComposeRequest = {
  mode: 'drift' | 'follow' | 'go'
  user_taste_summary: string
  context: {
    location: string
    observed_at: string
    weather: string
    next_anchor: string
    minutes_available: number
  }
  facts: {
    stops: Array<{
      name: string
      category: string
      opening_note: string
      route_note: string
      evidence_confidence: 'verified' | 'strong' | 'estimated'
    }>
    return_note: string
    fallback_fact: string
  }
}

const outputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    eyebrow: { type: 'string' },
    summary: { type: 'string' },
    why_now: { type: 'string' },
    fallback: { type: 'string' },
  },
  required: ['title', 'eyebrow', 'summary', 'why_now', 'fallback'],
  additionalProperties: false,
} as const

const isComposeRequest = (value: unknown): value is ComposeRequest => {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<ComposeRequest>

  return (
    ['drift', 'follow', 'go'].includes(input.mode ?? '') &&
    typeof input.user_taste_summary === 'string' &&
    Boolean(input.context) &&
    Boolean(input.facts) &&
    Array.isArray(input.facts?.stops) &&
    input.facts.stops.length > 0
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders },
    )
  }

  const input: unknown = await request.json().catch(() => null)

  if (!isComposeRequest(input)) {
    return Response.json(
      { error: 'Invalid composition request' },
      { status: 400, headers: corsHeaders },
    )
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_COMPOSER_MODEL') ?? 'gpt-5.6-terra'

  if (!apiKey) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not configured' },
      { status: 503, headers: corsHeaders },
    )
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'developer',
          content: [
            'Role: You are the field editor for Anchorage.',
            'Goal: Give a feasible, factual route a calm and memorable shape.',
            'Constraints: Use only the supplied facts. Do not add places, times,',
            'weather, availability, crowd claims, costs, or travel details.',
            'Treat estimated evidence as estimated. Keep the language observant,',
            'specific, and unpromotional.',
            'Output: A compact title, eyebrow, two-sentence summary, one-sentence',
            'why-now explanation, and a concise fallback.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(input),
        },
      ],
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'anchorage_thread_copy',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    return Response.json(
      { error: 'Composition failed', detail: result?.error?.message },
      { status: 502, headers: corsHeaders },
    )
  }

  const outputText = result.output
    ?.flatMap((item: { type: string; content?: unknown[] }) =>
      item.type === 'message' ? (item.content ?? []) : [],
    )
    .find((content: { type?: string }) => content.type === 'output_text')?.text

  if (typeof outputText !== 'string') {
    return Response.json(
      { error: 'Composition returned no structured output' },
      { status: 502, headers: corsHeaders },
    )
  }

  return Response.json(JSON.parse(outputText), {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
    },
  })
})
