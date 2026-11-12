const STORAGE_KEY = 'ashley_feedback_submitted_pins_v1';

function readMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode errors
  }
}

export function getClientSubmissionIds(pin: string): string[] {
  const clean = (pin || '').trim();
  if (!clean) return [];
  const map = readMap();
  const list = map[clean];
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string' && id.length > 0) : [];
}

export function recordSubmittedPinOnClient(pin: string, submissionId: string): void {
  const clean = (pin || '').trim();
  const id = (submissionId || '').trim();
  if (!clean || !id) return;
  const map = readMap();
  const existing = Array.isArray(map[clean]) ? map[clean] : [];
  if (!existing.includes(id)) {
    map[clean] = [...existing, id].slice(-20);
    writeMap(map);
  }
}

export function clearClientSubmissionIds(pin: string): void {
  const clean = (pin || '').trim();
  if (!clean) return;
  const map = readMap();
  if (clean in map) {
    delete map[clean];
    writeMap(map);
  }
}
