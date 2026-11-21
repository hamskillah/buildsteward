const defaults = { email: true, digest: 'weekly' };

export function applyPreferences(current, patch) {
  return {
    email: patch.email || current.email || defaults.email,
    digest: patch.digest ?? current.digest ?? defaults.digest,
  };
}
