import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 3800);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toast.kind === "success" ? Check : toast.kind === "error" ? AlertTriangle : Info;
  const accent =
    toast.kind === "success"
      ? "bg-chartreuse-lime text-ink-black"
      : toast.kind === "error"
        ? "bg-red-600 text-white"
        : "bg-deep-forest text-paper-white";
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[16px] border border-black/10 bg-paper-white px-4 py-3 shadow-[0_8px_30px_rgba(4,63,46,0.12)]",
        "animate-[toastIn_180ms_ease-out]",
      )}
      role="status"
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[4px]", accent)}>
        <Icon size={16} />
      </span>
      <span className="flex-1 text-[14px] text-deep-forest">{toast.message}</span>
      <button onClick={onClose} className="shrink-0 rounded-[4px] p-1 text-charcoal hover:bg-pale-sage">
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
