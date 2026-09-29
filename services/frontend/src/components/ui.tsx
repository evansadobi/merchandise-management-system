import { useState, type ReactNode } from 'react';

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const tones = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function Pill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Banner({ kind, text, onClose }: { kind: 'success' | 'error'; text: string; onClose: () => void }) {
  const cls = kind === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div className={`mb-4 flex items-start justify-between rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <span>{text}</span>
      <button onClick={onClose} className="ml-4 opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

/** Small single-input dialog, used instead of window.prompt. */
export function QuickInput(props: {
  title: string;
  label: string;
  type?: 'text' | 'number';
  defaultValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await props.onSubmit(value);
          } finally {
            setBusy(false);
            props.onClose();
          }
        }}
      >
        <Field label={props.label}>
          <input autoFocus required type={props.type ?? 'text'} className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Working…' : props.submitLabel ?? 'Confirm'}
        </button>
      </form>
    </Modal>
  );
}

export function WarnTriangle() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-red-500" fill="currentColor" aria-label="Out of stock">
      <path d="M10 2 1 18h18L10 2Zm1 12H9v-2h2v2Zm0-3H9V7h2v4Z" />
    </svg>
  );
}

export function WarnCircle() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-amber-400" fill="currentColor" aria-label="Low stock">
      <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 13H9v-2h2v2Zm0-3H9V6h2v5Z" />
    </svg>
  );
}