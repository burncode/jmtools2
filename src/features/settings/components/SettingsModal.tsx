import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SettingsModalProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  header: ReactNode;
  onClose: () => void;
}

export function SettingsModal({
  ariaLabel,
  children,
  className,
  footer,
  header,
  onClose,
}: SettingsModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="settings-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-label={ariaLabel}
        className={["settings-modal", className].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="settings-modal-header">{header}</header>
        <div className="settings-modal-body">{children}</div>
        {footer ? <footer className="settings-modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
