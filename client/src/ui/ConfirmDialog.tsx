import { useEffect, useRef, type ReactNode } from "react";
import { Button } from ".";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirm built on the native dialog element: focus is trapped and Esc cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="dialog-title">{title}</h2>
      <div>{children}</div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        <Button variant="danger" onClick={onConfirm} disabled={busy} autoFocus>{busy ? "Deleting…" : confirmLabel}</Button>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </dialog>
  );
}
