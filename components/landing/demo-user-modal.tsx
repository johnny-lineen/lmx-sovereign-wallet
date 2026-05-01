"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";

import { DemoRequestForm } from "@/components/landing/demo-request-form";
import { cn } from "@/lib/utils";

export function DemoUserModal() {
  const [open, setOpen] = useState(false);

  const closeModal = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-12 min-w-[11rem] items-center justify-center rounded-full border border-white/15 px-8",
          "text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-cyan-400/60 hover:text-cyan-300",
        )}
      >
        Become a Demo User
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#05070a] p-5 shadow-2xl shadow-black/60 sm:p-6">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full border border-white/10 text-slate-400 hover:text-white"
              aria-label="Close modal"
            >
              <X className="size-4" aria-hidden />
            </button>
            <div className="mb-4 space-y-1 pr-8">
              <h3 className="font-heading text-xl font-semibold text-white">Start your demo access</h3>
              <p className="text-sm text-slate-400">Answer 3 quick questions, verify email, and go straight into Search/Scan.</p>
            </div>
            <DemoRequestForm showFormHeader={false} surface="deep" onSubmitted={closeModal} />
          </div>
        </div>
      ) : null}
    </>
  );
}
