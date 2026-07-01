import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Responsive modal: a bottom-sheet that slides up on mobile (full-width, rounded
 * top, up to 92vh) and a centered dialog on desktop. Footer is sticky so primary
 * actions stay reachable with one thumb on small screens.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-deep-forest/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]" />
        <Dialog.Content
          className="fixed z-50 flex flex-col bg-paper-white border border-black/10 overflow-hidden
            inset-x-0 bottom-0 max-h-[92vh] rounded-t-[16px] animate-[sheetUp_220ms_cubic-bezier(0.32,0.72,0,1)]
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[92vw] sm:max-w-lg
            sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[16px] sm:animate-[fadeIn_150ms_ease-out]"
        >
          {/* Grab handle (mobile only) */}
          <div className="sm:hidden flex justify-center pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-black/15" />
          </div>

          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 sm:px-6 sm:pt-5">
            <Dialog.Title className="font-display text-[22px] text-deep-forest">{title}</Dialog.Title>
            <Dialog.Close className="rounded-[4px] p-1.5 text-charcoal hover:bg-pale-sage">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 sm:px-6 space-y-4">{children}</div>

          {footer ? (
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-black/10 bg-paper-white px-5 py-3 sm:px-6 pb-safe">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
