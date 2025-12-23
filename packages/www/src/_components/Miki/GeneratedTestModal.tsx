"use client";

import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface GeneratedTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  completion: string;
  isLoading: boolean;
  onStop: () => void;
}

export const GeneratedTestModal = ({
  isOpen,
  onClose,
  completion,
  isLoading,
  onStop,
}: GeneratedTestModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <h3 className="text-lg font-semibold text-white">Generated Playwright Test</h3>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/30"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(completion).then(() => {
                  toast.success("📋 Copied to clipboard!");
                });
              }}
              disabled={!completion}
              className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm font-medium text-violet-400 transition-colors hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && !completion ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <span>Generating test...</span>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  pre: ({ children }) => (
                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-sm leading-relaxed">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="rounded bg-slate-800 px-1.5 py-0.5 text-violet-300">{children}</code>
                    ) : (
                      <code className="text-slate-300">{children}</code>
                    );
                  },
                }}
              >
                {completion || "No code generated yet."}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {isLoading && (
          <div className="border-t border-white/10 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Streaming response...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
