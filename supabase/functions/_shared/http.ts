const maximumBodyBytes = 24_000

export async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > maximumBodyBytes) {
    throw new Error('REQUEST_TOO_LARGE')
  }

  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > maximumBodyBytes) {
    throw new Error('REQUEST_TOO_LARGE')
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error('INVALID_JSON')
  }
}

export function noStoreJson(
  body: unknown,
  init: Omit<ResponseInit, 'headers'> & { headers?: HeadersInit } = {},
) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
}

export function methodNotAllowed() {
  return noStoreJson(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
