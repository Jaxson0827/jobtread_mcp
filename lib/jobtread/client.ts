// Core Pave API client — handles auth, fetch, and error parsing

const JOBTREAD_API = 'https://api.jobtread.com/pave';

export async function paveQuery(query: object): Promise<any> {
  const grantKey = process.env.JOBTREAD_GRANT_KEY;
  if (!grantKey) throw new Error('JOBTREAD_GRANT_KEY environment variable is not set');

  const body = {
    query: {
      $: { grantKey },
      ...query,
    },
  };

  const res = await fetch(JOBTREAD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    // Pave returns plain-text error messages even on 4xx — include them in the exception
    let message = `JobTread API error: ${res.status} ${res.statusText}`;
    if (text) message += ` — ${text.slice(0, 300)}`;
    throw new Error(message);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`JobTread API returned non-JSON response: ${text.slice(0, 200)}`);
  }

  if (data['errors']) throw new Error(JSON.stringify(data['errors']));
  return data;
}
