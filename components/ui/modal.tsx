"use client";

import { useEffect, useRef } from "react";

// A small wrapper around the native <dialog> element, which supplies the
// focus trap, Esc handling, and top-layer rendering for free. The parent owns
// the open state; closing by any route (Esc, backdrop, close button) reports
// back through onClose, and focus returns to whatever opened the modal.
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      bodyRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleClose() {
      openerRef.current?.focus();
      openerRef.current = null;
      onClose();
    }

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      aria-labelledby={labelledBy}
      className="modal"
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself; clicks on
        // the content land on descendants.
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      ref={dialogRef}
    >
      <div className="modal-body" ref={bodyRef} tabIndex={-1}>
        <button
          aria-label="Close dialog"
          className="modal-close"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          ×
        </button>
        {children}
      </div>
    </dialog>
  );
}
