import { useState, useEffect } from 'react';
import api from '../services/api';

const DEFAULT_VOICE = 'en-US-AriaNeural';

let cachedVoices = null;

export default function VoiceSelector({ value, onChange, className = '' }) {
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

  // Group voices by locale
  const grouped = {};
  for (const v of voices) {
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
