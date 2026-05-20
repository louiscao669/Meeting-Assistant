/** Split transcript into completed sentences and a trailing live fragment. */
export function parseTranscriptSegments(text) {
  const t = (text || '').trim();
  if (!t) return { sentences: [], liveFragment: '' };

  const parts = t.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { sentences: [], liveFragment: '' };

  const last = parts[parts.length - 1];
  const lastIsComplete = /[.!?]$/.test(last);

  if (lastIsComplete) {
    return { sentences: parts, liveFragment: '' };
  }

  if (parts.length === 1) {
    return { sentences: [], liveFragment: last };
  }

  return {
    sentences: parts.slice(0, -1),
    liveFragment: last,
  };
}
