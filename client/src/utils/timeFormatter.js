export function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function formatTimeMs(s) {
  if (!s || isNaN(s)) return '0:00.000';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const whole = Math.floor(sec);
  const ms = Math.round((sec - whole) * 1000);
  return `${m}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function parseTimeMs(str) {
  if (!str || typeof str !== 'string') return NaN;
  const parts = str.trim().split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const sec = parseFloat(parts[1]) || 0;
    return m * 60 + sec;
  }
  if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return NaN;
}

export function formatTimePrecise(s) {
  if (!s || isNaN(s)) return '0:00.000';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(3)}`;
}
