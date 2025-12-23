"use client";

import { init } from "react-grab/core";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useCompletion } from "@ai-sdk/react";
import { GeneratedTestModal } from "./GeneratedTestModal";

type InteractionType = "click" | "hover" | "grabStart" | "grabRelease" | "input" | "display" | "url";

interface RecordedStep {
  id: number;
  interaction: InteractionType;
  tagName: string;
  className: string;
  textContent: string;
  url?: string;
  inputValue?: string;
  inputType?: string;
  testId?: string;
  elementId?: string;
  timestamp: Date;
}

const SIDEBAR_ID = "react-grab-sidebar";
const HOVER_DELAY = 3000; // ms to wait before recording hover

interface HotkeyConfig {
  display: string;
  url: string;
}

const DEFAULT_HOTKEYS: HotkeyConfig = {
  display: "d",
  url: "u",
};

export const Miki = () => {
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSelectingAssert, setIsSelectingAssert] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(DEFAULT_HOTKEYS);
  const [editingHotkey, setEditingHotkey] = useState<keyof HotkeyConfig | null>(null);
  const apiRef = useRef<ReturnType<typeof init> | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoveredRef = useRef<HTMLElement | null>(null);
  const lastGrabbedRef = useRef<HTMLElement | null>(null); // Track last grabbed element to skip click
  const lastInputRef = useRef<{ element: HTMLElement; value: string } | null>(null);
  const isSelectingAssertRef = useRef(false);
  const isTypingRef = useRef(false);

  const { completion, complete, isLoading, stop } = useCompletion({
    api: "/api/generate-test",
    streamProtocol: "text",
  });

  const generateTest = useCallback(async () => {
    const logsText = steps.map((step, i) => {
      const parts = [`${i + 1}. [${step.interaction.toUpperCase()}]`];
      if (step.interaction === "url") {
        parts.push(`URL: ${step.url}`);
      } else if (step.interaction === "input") {
        parts.push(`<${step.tagName}>`);
        if (step.testId) parts.push(`data-testid="${step.testId}"`);
        if (step.elementId) parts.push(`id="${step.elementId}"`);
        if (step.inputType) parts.push(`type="${step.inputType}"`);
        if (step.className) parts.push(`class="${step.className}"`);
        if (step.inputValue) parts.push(`value="${step.inputValue}"`);
      } else {
        parts.push(`<${step.tagName}>`);
        if (step.testId) parts.push(`data-testid="${step.testId}"`);
        if (step.elementId) parts.push(`id="${step.elementId}"`);
        if (step.className) parts.push(`class="${step.className}"`);
        if (step.textContent) parts.push(`text="${step.textContent}"`);
      }
      return parts.join(" ");
    }).join("\n");

    setIsModalOpen(true);
    await complete(logsText);
  }, [steps, complete]);

  const recordStep = useCallback((interaction: InteractionType, el: HTMLElement) => {
    // Handle SVG elements where className is SVGAnimatedString
    const className = typeof el.className === "string" 
      ? el.className 
      : el.getAttribute("class") || "";
    
    const tagName = el.tagName.toLowerCase();
    const textContent = el.textContent?.slice(0, 50) || "";
    const testId = el.getAttribute("data-testid") || undefined;
    const elementId = el.id || undefined;
    
    setSteps((prev) => [
      ...prev,
      {
        id: Date.now(),
        interaction,
        tagName,
        className,
        textContent: el.textContent?.slice(0, 100) || "",
        testId,
        elementId,
        timestamp: new Date(),
      },
    ]);

    // Show toast notification
    const icons: Record<InteractionType, string> = {
      click: "👆",
      hover: "🖱️",
      grabStart: "✊",
      grabRelease: "🖐️",
      input: "⌨️",
      display: "👁️",
      url: "🔗",
    };
    // Build description with testId/id priority
    const identifier = testId 
      ? `[data-testid="${testId}"]` 
      : elementId 
        ? `#${elementId}` 
        : textContent 
          ? `"${textContent.trim().slice(0, 30)}${textContent.length > 30 ? "..." : ""}"` 
          : "";
    
    toast.success(`${icons[interaction]} ${interaction}`, {
      description: `<${tagName}>${identifier ? ` ${identifier}` : ""}`,
      duration: 2000,
    });
  }, []);

  // Click handler for recording mode
  const handleClick = useCallback((e: MouseEvent) => {
    // Skip if selecting for assert (to avoid double-recording)
    if (isSelectingAssertRef.current) return;
    
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;
    
    // Skip click if this element was just grabbed (to avoid double-recording grab + click)
    if (lastGrabbedRef.current === el) {
      lastGrabbedRef.current = null;
      return;
    }
    
    console.log("Recorded click:", el);
    recordStep("click", el);
  }, [recordStep]);

  // Hover handler for recording mode
  const handleMouseOver = useCallback((e: MouseEvent) => {
    // Skip hover recording while typing
    if (isTypingRef.current) return;
    
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;
    
    // Skip if same element
    if (lastHoveredRef.current === el) return;
    lastHoveredRef.current = el;

    // Clear previous timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Debounce hover - only record if hovering for HOVER_DELAY ms
    hoverTimerRef.current = setTimeout(() => {
      console.log("Recorded hover:", el);
      recordStep("hover", el);
    }, HOVER_DELAY);
  }, [recordStep]);

  // Grab start handler for recording mode
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (isSelectingAssertRef.current) return;
    
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;

    // Check if element is draggable/grabbable
    const isDraggable = 
      el.draggable ||
      el.getAttribute("draggable") === "true" ||
      (el instanceof HTMLInputElement && el.type === "range") ||
      el.closest("[draggable=true]") ||
      el.classList.contains("draggable") ||
      getComputedStyle(el).cursor.includes("grab");

    if (isDraggable) {
      console.log("Recorded grabStart:", el);
      recordStep("grabStart", el);
      // Mark this element as grabbed to skip the subsequent click event
      lastGrabbedRef.current = el;
    }
  }, [recordStep]);

  // Grab release handler for recording mode
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isSelectingAssertRef.current) return;
    
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;

    // Only record grabRelease if we previously recorded a grabStart
    if (lastGrabbedRef.current) {
      console.log("Recorded grabRelease:", el);
      recordStep("grabRelease", el);
    }
  }, [recordStep]);

  // Record input step with value
  const recordInputStep = useCallback((el: HTMLElement, value: string) => {
    const className = typeof el.className === "string" 
      ? el.className 
      : el.getAttribute("class") || "";
    
    const tagName = el.tagName.toLowerCase();
    const inputType = el instanceof HTMLInputElement ? el.type : 
                      el instanceof HTMLTextAreaElement ? "textarea" :
                      el instanceof HTMLSelectElement ? "select" : "text";
    const testId = el.getAttribute("data-testid") || undefined;
    const elementId = el.id || undefined;
    
    setSteps((prev) => [
      ...prev,
      {
        id: Date.now(),
        interaction: "input",
        tagName,
        className,
        textContent: "",
        inputValue: value,
        inputType,
        testId,
        elementId,
        timestamp: new Date(),
      },
    ]);

    toast.success("⌨️ input", {
      description: `<${tagName}> "${value.slice(0, 30)}${value.length > 30 ? "..." : ""}"`,
      duration: 2000,
    });
  }, []);

  // Input handler for recording mode (debounced)
  const handleInput = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;

    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      return;
    }

    const value = el.value;

    if (inputTimerRef.current) {
      clearTimeout(inputTimerRef.current);
    }

    lastInputRef.current = { element: el, value };

    inputTimerRef.current = setTimeout(() => {
      if (lastInputRef.current?.value) {
        console.log("Recorded input:", el, value);
        recordInputStep(lastInputRef.current.element, lastInputRef.current.value);
        lastInputRef.current = null;
      }
    }, 500);
  }, [recordInputStep]);

  // Change handler for select elements
  const handleChange = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.contains(el)) return;

    if (el instanceof HTMLSelectElement) {
      const value = el.options[el.selectedIndex]?.text || el.value;
      console.log("Recorded select change:", el, value);
      recordInputStep(el, value);
    }
  }, [recordInputStep]);

  // Focus handler - track typing to skip hover
  const handleFocus = useCallback((e: FocusEvent) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      isTypingRef.current = true;
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    }
  }, []);

  // Blur handler - stopped typing
  const handleBlur = useCallback(() => {
    isTypingRef.current = false;
  }, []);

  // Toggle recording mode
  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Effect to attach/detach event listeners for recording
  useEffect(() => {
    if (isRecording) {
      document.addEventListener("click", handleClick, true);
      document.addEventListener("mouseover", handleMouseOver, true);
      document.addEventListener("mousedown", handleMouseDown, true);
      document.addEventListener("mouseup", handleMouseUp, true);
      document.addEventListener("input", handleInput, true);
      document.addEventListener("change", handleChange, true);
      document.addEventListener("focus", handleFocus, true);
      document.addEventListener("blur", handleBlur, true);
    }
    
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("focus", handleFocus, true);
      document.removeEventListener("blur", handleBlur, true);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      if (inputTimerRef.current) {
        clearTimeout(inputTimerRef.current);
      }
      isTypingRef.current = false;
    };
  }, [isRecording, handleClick, handleMouseOver, handleMouseDown, handleMouseUp, handleInput, handleChange, handleFocus, handleBlur]);

  // Initialize react-grab for assert mode only
  useEffect(() => {
    if (apiRef.current) return;

    apiRef.current = init({
      theme: {
        enabled: true,
        hue: 180,
      },

      onElementSelect: (element) => {
        const el = element as HTMLElement;

        console.log("Selected element:", el);

        const sidebar = document.getElementById(SIDEBAR_ID);
        if (sidebar?.contains(el)) {
          console.log("Ignoring sidebar element");
          return;
        }

        // Handle assert selection (display)
        if (isSelectingAssertRef.current) {
          console.log("Selected for display assert:", el);
          recordStep("display", el);

          apiRef.current?.deactivate?.();
          isSelectingAssertRef.current = false;
          setIsSelectingAssert(false);
        }
      },

      onStateChange: (state) => {
        console.log("Assert mode active:", state.isActive);
      },
    });

    return () => {
      apiRef.current?.deactivate?.();
    };
  }, [recordStep]);

  const clearSteps = () => setSteps([]);
  const removeStep = (id: number) => setSteps((prev) => prev.filter((s) => s.id !== id));

  const startAssertDisplay = useCallback(() => {
    isSelectingAssertRef.current = true;
    setIsSelectingAssert(true);
    apiRef.current?.activate();
    toast("HOTKEY: d", {
      description: "Display selector activated. Click on an element to assert its display. Press Esc to cancel.",
      duration: 2000,
    });
  }, []);

  const cancelAssert = useCallback(() => {
    isSelectingAssertRef.current = false;
    setIsSelectingAssert(false);
    apiRef.current?.deactivate?.();
  }, []);

  const recordCheckUrl = useCallback(() => {
    const url = window.location.href;
    setSteps((prev) => [
      ...prev,
      {
        id: Date.now(),
        interaction: "url",
        tagName: "window",
        className: "",
        textContent: "",
        url,
        timestamp: new Date(),
      },
    ]);
    toast.success("HOTKEY: u", {
      description: url,
      duration: 2000,
    });
  }, []);

  // Hotkey listener for quick actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Don't trigger if cursor is within the sidebar
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (sidebar?.contains(target)) {
        return;
      }

      // Don't trigger if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Display assert hotkey
      if (e.key.toLowerCase() === hotkeys.display.toLowerCase() && !isSelectingAssert) {
        e.preventDefault();
        startAssertDisplay();
      }

      // URL assert hotkey
      if (e.key.toLowerCase() === hotkeys.url.toLowerCase() && !isSelectingAssert) {
        e.preventDefault();
        recordCheckUrl();
      }

      // Escape to cancel selection mode
      if (e.key === "Escape" && isSelectingAssert) {
        e.preventDefault();
        cancelAssert();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSelectingAssert, startAssertDisplay, cancelAssert, recordCheckUrl, hotkeys]);

  // Auto-minimize when recording, selecting assert, or sidebar closed
  const shouldMinimize = isRecording || isSelectingAssert || !isOpen;

  // Minimized state - small button in top right
  if (shouldMinimize) {
    return typeof document !== "undefined"
      ? createPortal(
          <div id={SIDEBAR_ID} className="fixed right-4 top-4 z-[9999] flex items-center gap-2">
            {isRecording ? (
              <>
                {/* Recording indicator */}
                <div className="flex items-center gap-2 rounded-lg bg-rose-500 px-3 py-2 shadow-lg">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="text-sm font-medium text-white">Recording</span>
                </div>
                {/* Stop button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 shadow-lg transition-all hover:bg-slate-700"
                >
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <title>Stop recording</title>
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              </>
            ) : isSelectingAssert ? (
              <>
                {/* Assert indicator */}
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 shadow-lg">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="text-sm font-medium text-white">Select for display</span>
                </div>
                {/* Cancel button */}
                <button
                  type="button"
                  onClick={cancelAssert}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 shadow-lg transition-all hover:bg-slate-700"
                >
                  <span className="text-white">✕</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 shadow-lg transition-all hover:bg-slate-700 hover:scale-110"
              >
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <title>Open recorder</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>,
          document.body
        )
      : null;
  }

  const sidebar = (
    <div
      id={SIDEBAR_ID}
      className="fixed right-0 top-0 z-[9999] flex h-screen flex-col"
    >
      {/* Sidebar Content */}
      <div className="flex h-full w-80 flex-col border-l border-white/10 bg-slate-900/95 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-lg shadow-violet-500/30" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Configure hotkeys"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Settings</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Minimize sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Minimize</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hotkey Config Modal */}
        {isConfigOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
            <div className="w-full max-w-xs rounded-xl p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Configure Hotkeys</h3>
              </div>
              
              <div className="space-y-3">
                {/* Display hotkey */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">👁️ Display</span>
                  {editingHotkey === "display" ? (
                    <input
                      type="text"
                      ref={(el) => el?.focus()}
                      className="w-12 rounded bg-slate-700 px-2 py-1 text-center text-sm text-white outline-none ring-2 ring-violet-500"
                      placeholder={hotkeys.display.toUpperCase()}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        if (e.key === "Escape") {
                          setEditingHotkey(null);
                          return;
                        }
                        // Only accept single character keys (letters, numbers)
                        if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
                          setHotkeys((prev) => ({ ...prev, display: e.key.toLowerCase() }));
                          setEditingHotkey(null);
                        }
                      }}
                      onBlur={() => setEditingHotkey(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingHotkey("display")}
                      className="rounded bg-slate-700 px-3 py-1 text-sm font-mono text-slate-300 transition-colors hover:bg-slate-600"
                    >
                      {hotkeys.display.toUpperCase()}
                    </button>
                  )}
                </div>

                {/* URL hotkey */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">🔗 URL</span>
                  {editingHotkey === "url" ? (
                    <input
                      type="text"
                      ref={(el) => el?.focus()}
                      className="w-12 rounded bg-slate-700 px-2 py-1 text-center text-sm text-white outline-none ring-2 ring-violet-500"
                      placeholder={hotkeys.url.toUpperCase()}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        if (e.key === "Escape") {
                          setEditingHotkey(null);
                          return;
                        }
                        // Only accept single character keys (letters, numbers)
                        if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
                          setHotkeys((prev) => ({ ...prev, url: e.key.toLowerCase() }));
                          setEditingHotkey(null);
                        }
                      }}
                      onBlur={() => setEditingHotkey(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingHotkey("url")}
                      className="rounded bg-slate-700 px-3 py-1 text-sm font-mono text-slate-300 transition-colors hover:bg-slate-600"
                    >
                      {hotkeys.url.toUpperCase()}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setHotkeys(DEFAULT_HOTKEYS)}
                  className="flex-1 rounded-lg bg-slate-700 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-600"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfigOpen(false);
                    setEditingHotkey(null);
                  }}
                  className="flex-1 rounded-lg bg-violet-500 py-2 text-xs text-white transition-colors hover:bg-violet-400"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions Grid */}
        <div className="border-b border-white/10 px-3 py-2">
          <div className="flex flex-row gap-2 justify-between">
            {/* Recording Toggle */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                isRecording
                  ? "bg-rose-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isRecording ? "bg-white animate-pulse" : "bg-rose-500"}`} />
              {isRecording ? "■" : "REC"}
            </button>
            {/* Assert Buttons */}
            <div className="flex flex-row items-center gap-1">
              <span className="text-xs text-slate-300 mr-1">Capture</span>
            <button
              type="button"
              onClick={startAssertDisplay}
              disabled={isRecording}
              className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              Text <kbd className="text-[10px] size-4 text-center flex justify-center items-center opacity-70 bg-emerald-500/20 rounded-xs">{hotkeys.display.toUpperCase()}</kbd>
            </button>
            <button
              type="button"
              onClick={recordCheckUrl}
              className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1.5 text-xs text-amber-300 hover:bg-amber-500/30"
            >
              URL <kbd className="text-[10px] size-4 text-center flex justify-center items-center opacity-70 bg-amber-500/20 rounded-xs">{hotkeys.url.toUpperCase()}</kbd>
            </button>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-4">
          {steps.length === 0 ? (
            <p className="text-center text-sm text-slate-500">
              No steps recorded yet.<br />Click &quot;REC&quot; and interact with the page.
            </p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-white/5 bg-slate-800/50 p-3 transition-all hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-xs font-medium text-slate-300">
                        {index + 1}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        step.interaction === "click" ? "bg-violet-500/20 text-violet-400" :
                        step.interaction === "hover" ? "bg-cyan-500/20 text-cyan-400" :
                        step.interaction === "grabStart" ? "bg-orange-500/20 text-orange-400" :
                        step.interaction === "grabRelease" ? "bg-amber-600/20 text-amber-400" :
                        step.interaction === "input" ? "bg-sky-500/20 text-sky-400" :
                        step.interaction === "display" ? "bg-pink-500/20 text-pink-400" :
                        "bg-amber-500/20 text-amber-400"
                      }`}>
                        {step.interaction}
                      </span>
                      {step.tagName !== "window" && (
                        <span className="rounded bg-slate-700 px-2 py-0.5 font-mono text-xs text-slate-400">
                          {step.tagName}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
                      className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                  {(step.testId || step.elementId) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {step.testId && (
                        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                          [data-testid=&quot;{step.testId}&quot;]
                        </span>
                      )}
                      {step.elementId && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                          #{step.elementId}
                        </span>
                      )}
                    </div>
                  )}
                  {step.url && (
                    <p className="mt-2 truncate font-mono text-xs text-amber-300">
                      {step.url}
                    </p>
                  )}
                  {step.inputValue && (
                    <p className="mt-2 truncate font-mono text-xs text-sky-300">
                      {step.inputType && <span className="text-slate-500">[{step.inputType}] </span>}
                      &quot;{step.inputValue}&quot;
                    </p>
                  )}
                  {step.className && typeof step.className === "string" && !step.testId && !step.elementId && (
                    <p className="mt-2 truncate font-mono text-xs text-slate-500">
                      .{step.className.split(" ").slice(0, 3).join(" .")}
                      {step.className.split(" ").length > 3 && "..."}
                    </p>
                  )}
                  {step.textContent && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                      &quot;{step.textContent}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-2">
          {steps.length > 0 ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateTest}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-violet-500 py-1 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Generating..." : "Generate Test"}
                </button>
                <button
                  type="button"
                  onClick={clearSteps}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <p className="text-center text-xs text-slate-500">
                {steps.length} step{steps.length !== 1 && "s"} recorded
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500">
              Record your actions to generate tests
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(
        <>
          {sidebar}
          <GeneratedTestModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            completion={completion}
            isLoading={isLoading}
            onStop={stop}
          />
        </>,
        document.body
      )
    : null;
};
