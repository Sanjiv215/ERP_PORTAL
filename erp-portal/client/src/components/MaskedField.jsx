import { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export function MaskedField({ value, maskedValue, label = 'Sensitive data' }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const display = revealed && value ? value : (maskedValue || '—');

  async function handleCopy(e) {
    e.stopPropagation();
    const textToCopy = value || maskedValue;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs border border-slate-200 dark:border-slate-700"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 6,
        background: '#F1F5F9',
        border: '1px solid #E2E8F0',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.82rem',
        color: '#334155'
      }}
    >
      <span>{display}</span>
      {value && value !== maskedValue && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          title={revealed ? 'Hide details' : 'Click to reveal'}
          aria-label={revealed ? 'Hide details' : 'Click to reveal'}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: '6px 8px',
            minHeight: 36,
            minWidth: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation'
          }}
        >
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
        style={{
          background: 'none',
          border: 'none',
          color: copied ? '#059669' : '#64748B',
          cursor: 'pointer',
          padding: '6px 8px',
          minHeight: 36,
          minWidth: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation'
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </span>
  );
}
