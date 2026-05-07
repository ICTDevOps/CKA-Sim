"use client";

import { vim } from "@replit/codemirror-vim";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ViEditorHandle {
  /** Returns the current buffer contents. */
  getBuffer: () => string;
  /** Returns the keystroke count since mount. */
  getKeystrokes: () => number;
  /** Resets the editor to a new buffer and zeros the keystroke counter. */
  reset: (buffer: string) => void;
  /** Focuses the editor. */
  focus: () => void;
}

interface ViEditorProps {
  initialBuffer: string;
  /** Disabled state — no input accepted. Used while feedback is shown. */
  disabled?: boolean;
}

/**
 * CodeMirror 6 editor running in vim mode, with line numbers and active-line
 * highlight. Tracks keystrokes via a `keydown` listener on the content DOM —
 * any non-modifier key press counts as one keystroke. This is a deliberate
 * proxy: counting CM transactions misses normal-mode movements (`hjkl`,
 * `gg`, etc.) that don't change the buffer but are real keystrokes.
 *
 * Modifier-only presses (Shift, Ctrl, Alt, Meta) are skipped. Repeated keys
 * (auto-repeat) ARE counted, since vim users routinely hold `j` to move
 * down — that's still effort.
 */
export const ViEditor = forwardRef<ViEditorHandle, ViEditorProps>(
  function ViEditor({ initialBuffer, disabled }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const keystrokesRef = useRef(0);

    useImperativeHandle(ref, () => ({
      getBuffer: () => viewRef.current?.state.doc.toString() ?? "",
      getKeystrokes: () => keystrokesRef.current,
      reset: (buffer: string) => {
        keystrokesRef.current = 0;
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: buffer }
        });
      },
      focus: () => viewRef.current?.focus()
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const state = EditorState.create({
        doc: initialBuffer,
        extensions: [
          // vim must come BEFORE other keymaps so its bindings win.
          vim(),
          lineNumbers(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.theme({
            "&": {
              fontSize: "13px",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              backgroundColor: "rgba(0,0,0,0.4)",
              color: "#d6deeb"
            },
            ".cm-content": { padding: "10px 8px" },
            ".cm-gutters": {
              backgroundColor: "rgba(0,0,0,0.3)",
              color: "#5f7e97",
              border: "none"
            },
            ".cm-activeLine": {
              backgroundColor: "rgba(127, 219, 202, 0.06)"
            },
            ".cm-activeLineGutter": {
              backgroundColor: "rgba(127, 219, 202, 0.08)"
            },
            "&.cm-focused": { outline: "none" },
            ".cm-cursor": { borderLeftColor: "#7fdbca" },
            ".cm-fat-cursor": {
              backgroundColor: "rgba(127, 219, 202, 0.55)",
              outline: "none"
            }
          })
        ]
      });

      const view = new EditorView({ state, parent: host });
      viewRef.current = view;

      const onKeyDown = (e: KeyboardEvent) => {
        if (disabled) return;
        // Skip modifier-only presses; these don't represent vim keystrokes.
        if (
          e.key === "Shift" ||
          e.key === "Control" ||
          e.key === "Alt" ||
          e.key === "Meta" ||
          e.key === "CapsLock"
        ) {
          return;
        }
        keystrokesRef.current += 1;
      };
      view.contentDOM.addEventListener("keydown", onKeyDown);
      // Auto-focus so the user can start typing immediately.
      view.focus();

      return () => {
        view.contentDOM.removeEventListener("keydown", onKeyDown);
        view.destroy();
        viewRef.current = null;
      };
      // initialBuffer change is handled via reset(); we deliberately mount
      // the editor only once per question (parent remounts via key prop).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // While `disabled`, swallow keypresses on the content DOM so the
    // editor doesn't accept further input. We don't reconfigure the
    // editable Compartment — the keydown gate is enough for the
    // post-submit "frozen feedback" window.
    useEffect(() => {
      const view = viewRef.current;
      if (!view || !disabled) return;
      const stop = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      view.contentDOM.addEventListener("keydown", stop, { capture: true });
      return () => {
        view.contentDOM.removeEventListener("keydown", stop, {
          capture: true
        } as EventListenerOptions);
      };
    }, [disabled]);

    return (
      <div
        ref={hostRef}
        className="overflow-hidden rounded border border-terminal-dim/50 focus-within:border-terminal-accent"
      />
    );
  }
);
