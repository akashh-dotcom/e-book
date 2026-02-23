import { useState, useEffect } from 'react';
import api from '../services/api';

const DEFAULT_VOICE = 'en-US-AriaNeural';

let cachedVoices = null;

export default function VoiceSelector({ value, onChange, filterLang, className = '' }) {
  const [voices, setVoices] = useState(cachedVoices || []);
  const [loading, setLoading] = useState(!cachedVoices);

  useEffect(() => {
    if (cachedVoices) return;
    api.get('/audio/voices')
      .then(res => {
        cachedVoices = res.data;
        setVoices(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter voices by translation language if provided
  const filtered = filterLang
    ? voices.filter(v => v.locale.split('-')[0] === filterLang)
    : voices;

  // Auto-select first matching voice when filter changes
  useEffect(() => {
    if (!filterLang || filtered.length === 0) return;
    const currentMatch = filtered.some(v => v.name === value);
    if (!currentMatch) {
      onChange(filtered[0].name);
    }
  }, [filterLang, filtered, value, onChange]);

  // Group voices by locale
  const grouped = {};
  for (const v of filtered) {
    if (!grouped[v.locale]) grouped[v.locale] = [];
    grouped[v.locale].push(v);
  }
  const locales = Object.keys(grouped).sort();

  // Friendly locale label
  const localeLabel = (locale) => {
    try {
      const display = new Intl.DisplayNames(['en'], { type: 'language' });
      const [lang] = locale.split('-');
      const langName = display.of(lang) || lang;
      const region = locale.split('-')[1] || '';
      return region ? `${langName} (${region})` : langName;
    } catch {
      return locale;
    }
  };

  // Friendly voice label: "Aria (Female)" from "en-US-AriaNeural"
  const voiceLabel = (v) => {
    const short = v.name.replace(/Neural$/, '').split('-').slice(2).join('-') || v.name;
    return v.gender ? `${short} (${v.gender})` : short;
  };

  return (
    <select
      className={`voice-selector ${className}`}
      value={value || DEFAULT_VOICE}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
    >
      {loading && <option>Loading voices...</option>}
      {locales.map(locale => (
        <optgroup key={locale} label={localeLabel(locale)}>
          {grouped[locale].map(v => (
            <option key={v.name} value={v.name}>
              {voiceLabel(v)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export { DEFAULT_VOICE };
