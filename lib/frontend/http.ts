/** Browser-side transport shared by the migrated frontend. */
export function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    mode: 'same-origin',
    credentials: 'same-origin',
    cache: 'no-store',
  })
}

export async function throwFromResponse(response: Response): Promise<never> {
  const text = await response.text()
  let message = text || `Request failed (${response.status})`
  try {
    const data: unknown = JSON.parse(text)
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      message = data.message
    }
  } catch {
    // Keep a plain-text error if a proxy or server returns non-JSON content.
  }
  throw new Error(message)
}
