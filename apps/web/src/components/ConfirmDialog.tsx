import { Modal } from "./Modal";
import { Button } from "./ui";

/**
 * In-app confirmation dialog (replaces the native window.confirm). Renders on top
 * of other modals via the Modal portal. `danger` styles the confirm button red.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onCancel()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
            {loading ? "…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-deep-forest">{message}</p>
    </Modal>
  );
}
