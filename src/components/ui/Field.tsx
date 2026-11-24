'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { parseNum } from '../../i18n/format';
import { useApp, useI18n } from '../../lib/repo-context';

/** Champ libellé + saisie + unité (legacy `field`). */
export function Field({ label, htmlFor, unit, refText, children }: {
  label: ReactNode; htmlFor: string; unit?: ReactNode; refText?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}{refText ? <> <span className="dim">· {refText}</span></> : null}</label>
      <div className="ib">{children}{unit ? <span className="unit">{unit}</span> : null}</div>
    </div>
  );
}

type Base = { id: string; label: string; readOnly?: boolean; className?: string; placeholder?: string };

const commitKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur();
};

/** Saisie numérique : formatée selon la langue, validée au blur / Entrée ; 'invalid' → message, valeur inchangée. */
export function NumInput({ id, label, value, onCommit, decimals = 1, raw = false, readOnly, className = '', placeholder = '—' }: Base & {
  value: number | null | undefined; onCommit(v: number | null): void; decimals?: number; raw?: boolean;
}) {
  const { locale, nf, t } = useI18n();
  const { toast } = useApp();
  const display = value == null || !Number.isFinite(value) ? '' : raw ? String(value) : nf(value, decimals);
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);
  useEffect(() => { if (!focused) setText(display); }, [display, focused]);
  const commit = () => {
    setFocused(false);
    if (text === display) return;
    const v = parseNum(locale, text);
    if (v === 'invalid') {
      setBad(true);
      setText(display);
      toast(t('Valeur non reconnue : saisissez un nombre.'), true);
      return;
    }
    setBad(false);
    if (v !== (value ?? null)) onCommit(v);
    else setText(display);
  };
  return (
    <input
      id={id}
      className={`in ${className}`}
      value={text}
      placeholder={placeholder}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      aria-invalid={bad || undefined}
      readOnly={readOnly}
      onFocus={() => setFocused(true)}
      onChange={(e) => { setText(e.target.value); setBad(false); }}
      onBlur={commit}
      onKeyDown={commitKey}
    />
  );
}

/** Saisie texte, enregistrée au blur / Entrée. */
export function TextInput({ id, label, value, onCommit, readOnly, className = '', placeholder = '—', multiline = false }: Base & {
  value: string | null | undefined; onCommit(v: string): void; multiline?: boolean;
}) {
  const display = value ?? '';
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(display); }, [display, focused]);
  const commit = () => { setFocused(false); if (text !== display) onCommit(text); };
  if (multiline) {
    return (
      <textarea id={id} className={`in ${className}`} value={text} aria-label={label} readOnly={readOnly} placeholder={placeholder}
        onFocus={() => setFocused(true)} onChange={(e) => setText(e.target.value)} onBlur={commit} />
    );
  }
  return (
    <input id={id} className={`in txt ${className}`} value={text} aria-label={label} readOnly={readOnly} placeholder={placeholder}
      autoComplete="off" onFocus={() => setFocused(true)} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={commitKey} />
  );
}

/** Liste déroulante : options [valeur, libellé]. */
export function Select<V extends string>({ id, label, value, options, onCommit, readOnly, className = '' }: Omit<Base, 'placeholder'> & {
  value: V | null; options: [V | '', string][]; onCommit(v: V | null): void;
}) {
  return (
    <select id={id} className={`in ${className}`} value={value ?? ''} aria-label={label} disabled={readOnly}
      onChange={(e) => onCommit((e.target.value || null) as V | null)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Check({ id, label, checked, onCommit, readOnly, children }: Omit<Base, 'placeholder'> & {
  checked: boolean; onCommit(v: boolean): void; children?: ReactNode;
}) {
  const box = <input type="checkbox" id={id} checked={checked} aria-label={label} disabled={readOnly} onChange={(e) => onCommit(e.target.checked)} />;
  return children ? <label className="check">{box}{children}</label> : box;
}

/** Date (AAAA-MM-JJ), enregistrée au changement complet / blur. */
export function DateInput({ id, label, value, onCommit, readOnly }: Omit<Base, 'placeholder'> & {
  value: string | null | undefined; onCommit(v: string | null): void;
}) {
  const display = value ? value.slice(0, 10) : '';
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(display); }, [display, focused]);
  const commit = (v: string) => { if (v !== display && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v))) onCommit(v || null); };
  return (
    <input type="date" id={id} className="in" value={text} aria-label={label} readOnly={readOnly}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setFocused(false); commit(text); }} />
  );
}
