export async function syncAuthSession(accessToken: string, refreshToken: string) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error('Could not establish the secure MatchUp session.');
}

export async function clearAuthSession() {
  await fetch('/api/auth/sign-out', { method: 'POST' });
}
