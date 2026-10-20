import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { errorMessage, planLimitOf } from "@/lib/api";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Button ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
  secondary:
    "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────

const fieldBase =
  "block rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700";

/** Full width unless the caller sets its own width (avoids conflicting w-* classes). */
const width = (className?: string) => (/(^|\s)w-/.test(className ?? "") ? "" : "w-full");

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Input({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = rest.type === "password";
  const input = isPassword ? (
    // Password fields get a show/hide toggle.
    <div className={cx("relative", width(className), className)}>
      <input id={id} {...rest} type={reveal ? "text" : "password"} className={cx(fieldBase, "w-full pr-10")} />
      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        aria-label={reveal ? "Hide password" : "Show password"}
        aria-pressed={reveal}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <EyeIcon off={reveal} />
      </button>
    </div>
  ) : (
    <input id={id} {...rest} className={cx(fieldBase, width(className), className)} />
  );
  return label ? <Field label={label} hint={hint} htmlFor={id}>{input}</Field> : input;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function Textarea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode }) {
  const id = useId();
  const el = <textarea id={id} rows={3} {...rest} className={cx(fieldBase, width(className), className)} />;
  return label ? <Field label={label} hint={hint} htmlFor={id}>{el}</Field> : el;
}

export function Select({
  label,
  hint,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode }) {
  const id = useId();
  const el = (
    <select id={id} {...rest} className={cx(fieldBase, width(className), "pr-8", className)}>
      {children}
    </select>
  );
  return label ? <Field label={label} hint={hint} htmlFor={id}>{el}</Field> : el;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={cx("inline-flex items-center gap-2 text-sm", disabled ? "opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700")}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", checked && "translate-x-4")} />
      </button>
      {label}
    </label>
  );
}

// ── Layout bits ─────────────────────────────────────────────────────────────

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

type Tone = "gray" | "green" | "amber" | "red" | "blue";
const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  blue: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

const statusTone: Record<string, Tone> = {
  ACTIVE: "green",
  STARTED: "green",
  SUCCEEDED: "green",
  STOPPED: "gray",
  IDLE: "gray",
  DRAINING: "amber",
  PENDING: "amber",
  PENDING_START: "amber",
  STOPPING: "amber",
  OFFLINE: "red",
  FAILED: "red",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone[status] ?? "gray"}>
      {(status === "ACTIVE" || status === "STARTED") && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <span className={cx("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-label="Loading" />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Spinner className="size-4" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
      <span>
        {errorMessage(error)}
        {planLimitOf(error) && (
          <>
            {" "}
            <Link to="/app/billing" className="font-medium underline">
              {planLimitOf(error)!.code === "SUBSCRIPTION_EXPIRED" ? "Renew plan" : "Upgrade plan"} →
            </Link>
          </>
        )}
      </span>
      {onRetry && !planLimitOf(error) && (
        <button onClick={onRetry} className="shrink-0 font-medium underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "blue", children }: { tone?: "blue" | "amber" | "green"; children: ReactNode }) {
  const t = {
    blue: "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-500/30",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30",
  }[tone];
  return <div className={cx("rounded-lg px-3.5 py-2.5 text-sm ring-1", t)}>{children}</div>;
}

export function Empty({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, onRowClick }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {columns.map((c, i) => (
              <th key={i} className={cx("px-5 py-2 font-medium whitespace-nowrap", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx(onRowClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50")}
            >
              {columns.map((c, i) => (
                <td key={i} className={cx("px-5 py-2.5 align-middle", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900", wide ? "max-w-3xl" : "max-w-lg")}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </header>
        <div className="space-y-4 p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">{footer}</footer>}
      </div>
    </div>
  );
}

/** Confirm dialog; when `confirmText` is set the user must type it (destructive actions). */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  confirmText,
  danger,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
  error?: unknown;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} disabled={!!confirmText && typed !== confirmText} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      {confirmText && <Input label={`Type "${confirmText}" to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />}
      <ErrorBox error={error} />
    </Modal>
  );
}

// ── Copyable values & secrets ───────────────────────────────────────────────

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked — the value is still selectable
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CopyField({ label, value, mono = true }: { label?: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>}
      <div className="flex items-center gap-2">
        <code className={cx("min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800", mono && "font-mono")} title={value}>
          {value}
        </code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

/** Shows a one-time secret with an explicit acknowledgement. */
export function SecretRevealModal({ open, onClose, title, secrets, note }: { open: boolean; onClose: () => void; title: string; secrets: { label: string; value: string }[]; note?: ReactNode }) {
  const [ack, setAck] = useState(false);
  useEffect(() => setAck(false), [open]);
  return (
    <Modal
      open={open}
      onClose={() => ack && onClose()}
      title={title}
      footer={
        <Button disabled={!ack} onClick={onClose}>
          Done
        </Button>
      }
    >
      <Notice tone="amber">This secret is shown only once. Copy it now and store it securely — it can't be retrieved later, only rotated.</Notice>
      {secrets.map((s) => (
        <CopyField key={s.label} label={s.label} value={s.value} />
      ))}
      {note}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-4 rounded" />
        I've stored the secret somewhere safe
      </label>
    </Modal>
  );
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
        {language && <span className="absolute top-2 right-20 text-[10px] tracking-wide text-slate-500 uppercase">{language}</span>}
        <code className="font-mono">{code}</code>
      </pre>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton value={code} />
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "rounded-md px-3 py-1 text-xs font-medium",
            value === t.value ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export { cx };
