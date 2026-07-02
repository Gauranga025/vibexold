"use client"

import { useRef, useEffect, useCallback } from "react"
import Editor, { type Monaco } from "@monaco-editor/react"
import { TemplateFile } from "../lib/path-to-json"
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from "../lib/editor-config"


interface PlaygroundEditorProps {
  activeFile: TemplateFile | undefined
  content: string
  onContentChange: (value: string) => void
  // Canonical paths of every currently-open tab. Used only to know which
  // cached Monaco models are stale and safe to dispose (e.g. after a tab
  // is closed) — never to identify "the" file, that's activeFile.path.
  openFilePaths?: string[]
  suggestion: string | null
  suggestionLoading: boolean
  suggestionPosition: { line: number; column: number } | null
  onAcceptSuggestion: (editor: any, monaco: any) => void
  onRejectSuggestion: (editor: any) => void
  onTriggerSuggestion: (type: string, editor: any) => void
}

export const PlaygroundEditor = ({
  activeFile,
  content,
  onContentChange,
  openFilePaths,
  suggestion,
  suggestionLoading,
  suggestionPosition,
  onAcceptSuggestion,
  onRejectSuggestion,
  onTriggerSuggestion,
}: PlaygroundEditorProps) => {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const inlineCompletionProviderRef = useRef<any>(null)
  const currentSuggestionRef = useRef<{
    text: string
    position: { line: number; column: number }
    id: string
  } | null>(null)
  const isAcceptingSuggestionRef = useRef(false)
  const suggestionAcceptedRef = useRef(false)
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // tabCommandRef stores the command id returned by addCommand for debugging only;
  // it is not an IDisposable (see handleEditorDidMount for why).
  const tabCommandRef = useRef<any>(null)
  // These two DO return real IDisposable objects and must be disposed on unmount,
  // otherwise every additional mount of the editor stacks a duplicate listener.
  const cursorPositionListenerRef = useRef<{ dispose: () => void } | null>(null)
  const modelContentListenerRef = useRef<{ dispose: () => void } | null>(null)

  // One Monaco text model per canonical file path (never per filename —
  // "app/page.tsx" and "app/dashboard/page.tsx" each get their own model
  // even though they'd share a filename). Keeping a real model per file,
  // instead of one shared editor whose `value` is swapped, means each
  // file keeps its own undo/redo history, cursor position, and scroll
  // offset when you switch tabs and back.
  const modelsRef = useRef<Map<string, any>>(new Map())
  // Kept up to date via a plain assignment (not state) so the content-change
  // listener attached once per model always calls the latest onContentChange
  // without needing to be re-attached every render.
  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  const modelUri = useCallback((monaco: Monaco, filePath: string) => monaco.Uri.parse(`file:///${filePath}`), [])

  // Returns the cached model for this path, creating it (seeded with
  // `initialContent`) if it doesn't exist yet. Never creates a second
  // model for the same path.
  const getOrCreateModel = useCallback(
    (monaco: Monaco, filePath: string, initialContent: string, language: string) => {
      const cached = modelsRef.current.get(filePath)
      if (cached && !cached.isDisposed()) return cached

      const uri = modelUri(monaco, filePath)
      const existing = monaco.editor.getModel(uri)
      const model = existing ?? monaco.editor.createModel(initialContent, language, uri)

      if (!existing) {
        model.onDidChangeContent(() => {
          onContentChangeRef.current(model.getValue())
        })
      }

      modelsRef.current.set(filePath, model)
      return model
    },
    [modelUri]
  )

  // Point the editor at the model for `activeFile`, creating it on first
  // visit. Safe to call multiple times — it's a no-op if the editor is
  // already showing that model.
  const syncActiveModel = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !activeFile) return

    const language = getEditorLanguage(activeFile.fileExtension || "")
    const model = getOrCreateModel(monaco, activeFile.path, activeFile.content ?? content, language)

    if (editor.getModel() !== model) {
      editor.setModel(model)
    }
  }, [activeFile, content, getOrCreateModel])

  // Generate unique ID for each suggestion
  const generateSuggestionId = () => `suggestion-${Date.now()}-${Math.random()}`

  // Create inline completion provider
  const createInlineCompletionProvider = useCallback(
    (monaco: Monaco) => {
      return {
        provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
          console.log("provideInlineCompletions called", {
            hasSuggestion: !!suggestion,
            hasPosition: !!suggestionPosition,
            currentPos: `${position.lineNumber}:${position.column}`,
            suggestionPos: suggestionPosition ? `${suggestionPosition.line}:${suggestionPosition.column}` : null,
            isAccepting: isAcceptingSuggestionRef.current,
            suggestionAccepted: suggestionAcceptedRef.current,
          })

          // Don't provide completions if we're currently accepting or have already accepted
          if (isAcceptingSuggestionRef.current || suggestionAcceptedRef.current) {
            console.log("Skipping completion - already accepting or accepted")
            return { items: [] }
          }

          // Only provide suggestion if we have one
          if (!suggestion || !suggestionPosition) {
            console.log("No suggestion or position available")
            return { items: [] }
          }

          // Check if current position matches suggestion position (with some tolerance)
          const currentLine = position.lineNumber
          const currentColumn = position.column

          const isPositionMatch =
            currentLine === suggestionPosition.line &&
            currentColumn >= suggestionPosition.column &&
            currentColumn <= suggestionPosition.column + 2 // Small tolerance

          if (!isPositionMatch) {
            console.log("Position mismatch", {
              current: `${currentLine}:${currentColumn}`,
              expected: `${suggestionPosition.line}:${suggestionPosition.column}`,
            })
            return { items: [] }
          }

          const suggestionId = generateSuggestionId()
          currentSuggestionRef.current = {
            text: suggestion,
            position: suggestionPosition,
            id: suggestionId,
          }

          console.log("Providing inline completion", { suggestionId, suggestion: suggestion.substring(0, 50) + "..." })

          // Clean the suggestion text (remove \r characters)
          const cleanSuggestion = suggestion.replace(/\r/g, "")

          return {
            items: [
              {
                insertText: cleanSuggestion,
                range: new monaco.Range(
                  suggestionPosition.line,
                  suggestionPosition.column,
                  suggestionPosition.line,
                  suggestionPosition.column,
                ),
                kind: monaco.languages.CompletionItemKind.Snippet,
                label: "AI Suggestion",
                detail: "AI-generated code suggestion",
                documentation: "Press Tab to accept",
                sortText: "0000", // High priority
                filterText: "",
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              },
            ],
          }
        },
        freeInlineCompletions: (completions: any) => {
          console.log("freeInlineCompletions called")
        },
      }
    },
    [suggestion, suggestionPosition],
  )

  // Clear current suggestion
  const clearCurrentSuggestion = useCallback(() => {
    console.log("Clearing current suggestion")
    currentSuggestionRef.current = null
    suggestionAcceptedRef.current = false
    if (editorRef.current) {
      editorRef.current.trigger("ai", "editor.action.inlineSuggest.hide", null)
    }
  }, [])

  // Accept current suggestion with double-acceptance prevention
  const acceptCurrentSuggestion = useCallback(() => {
    console.log("acceptCurrentSuggestion called", {
      hasEditor: !!editorRef.current,
      hasMonaco: !!monacoRef.current,
      hasSuggestion: !!currentSuggestionRef.current,
      isAccepting: isAcceptingSuggestionRef.current,
      suggestionAccepted: suggestionAcceptedRef.current,
    })

    if (!editorRef.current || !monacoRef.current || !currentSuggestionRef.current) {
      console.log("Cannot accept suggestion - missing refs")
      return false
    }

    // CRITICAL: Prevent double acceptance with immediate flag setting
    if (isAcceptingSuggestionRef.current || suggestionAcceptedRef.current) {
      console.log("BLOCKED: Already accepting/accepted suggestion, skipping")
      return false
    }

    // Set flags IMMEDIATELY to prevent any race conditions
    isAcceptingSuggestionRef.current = true
    suggestionAcceptedRef.current = true

    const editor = editorRef.current
    const monaco = monacoRef.current
    const currentSuggestion = currentSuggestionRef.current

    try {
      // Clean the suggestion text (remove \r characters)
      const cleanSuggestionText = currentSuggestion.text.replace(/\r/g, "")

      console.log("ACCEPTING suggestion:", cleanSuggestionText.substring(0, 50) + "...")

      // Get current cursor position to validate
      const currentPosition = editor.getPosition()
      const suggestionPos = currentSuggestion.position

      // Verify we're still at the suggestion position
      if (
        currentPosition.lineNumber !== suggestionPos.line ||
        currentPosition.column < suggestionPos.column ||
        currentPosition.column > suggestionPos.column + 5
      ) {
        console.log("Position changed, cannot accept suggestion")
        return false
      }

      // Insert the suggestion text at the correct position
      const range = new monaco.Range(suggestionPos.line, suggestionPos.column, suggestionPos.line, suggestionPos.column)

      // Use executeEdits to insert the text
      const success = editor.executeEdits("ai-suggestion-accept", [
        {
          range: range,
          text: cleanSuggestionText,
          forceMoveMarkers: true,
        },
      ])

      if (!success) {
        console.error("Failed to execute edit")
        return false
      }

      // Calculate new cursor position
      const lines = cleanSuggestionText.split("\n")
      const endLine = suggestionPos.line + lines.length - 1
      const endColumn =
        lines.length === 1 ? suggestionPos.column + cleanSuggestionText.length : lines[lines.length - 1].length + 1

      // Move cursor to end of inserted text
      editor.setPosition({ lineNumber: endLine, column: endColumn })

      console.log("SUCCESS: Suggestion accepted, new position:", `${endLine}:${endColumn}`)

      // Clear the suggestion
      clearCurrentSuggestion()

      // Call the parent's accept handler
      onAcceptSuggestion(editor, monaco)

      return true
    } catch (error) {
      console.error("Error accepting suggestion:", error)
      return false
    } finally {
      // Reset accepting flag immediately
      isAcceptingSuggestionRef.current = false

      // Keep accepted flag for longer to prevent immediate re-acceptance
      setTimeout(() => {
        suggestionAcceptedRef.current = false
        console.log("Reset suggestionAcceptedRef flag")
      }, 1000) // Increased delay to 1 second
    }
  }, [clearCurrentSuggestion, onAcceptSuggestion])

  // Check if there's an active inline suggestion at current position
  const hasActiveSuggestionAtPosition = useCallback(() => {
    if (!editorRef.current || !currentSuggestionRef.current) return false

    const position = editorRef.current.getPosition()
    const suggestion = currentSuggestionRef.current

    return (
      position.lineNumber === suggestion.position.line &&
      position.column >= suggestion.position.column &&
      position.column <= suggestion.position.column + 2
    )
  }, [])

  // Update inline completions when suggestion changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return

    const editor = editorRef.current
    const monaco = monacoRef.current

    console.log("Suggestion changed", {
      hasSuggestion: !!suggestion,
      hasPosition: !!suggestionPosition,
      isAccepting: isAcceptingSuggestionRef.current,
      suggestionAccepted: suggestionAcceptedRef.current,
    })

    // Don't update if we're in the middle of accepting a suggestion
    if (isAcceptingSuggestionRef.current || suggestionAcceptedRef.current) {
      console.log("Skipping update - currently accepting/accepted suggestion")
      return
    }

    // Dispose previous provider
    if (inlineCompletionProviderRef.current) {
      inlineCompletionProviderRef.current.dispose()
      inlineCompletionProviderRef.current = null
    }

    // Clear current suggestion reference
    currentSuggestionRef.current = null

    // Register new provider if we have a suggestion
    if (suggestion && suggestionPosition) {
      console.log("Registering new inline completion provider")

      const language = getEditorLanguage(activeFile?.fileExtension || "")
      const provider = createInlineCompletionProvider(monaco)

      inlineCompletionProviderRef.current = monaco.languages.registerInlineCompletionsProvider(language, provider)

      // Small delay to ensure editor is ready, then trigger suggestions
      setTimeout(() => {
        if (editorRef.current && !isAcceptingSuggestionRef.current && !suggestionAcceptedRef.current) {
          console.log("Triggering inline suggestions")
          editor.trigger("ai", "editor.action.inlineSuggest.trigger", null)
        }
      }, 50)
    }

    return () => {
      if (inlineCompletionProviderRef.current) {
        inlineCompletionProviderRef.current.dispose()
        inlineCompletionProviderRef.current = null
      }
    }
  }, [suggestion, suggestionPosition, activeFile, createInlineCompletionProvider])

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    console.log("Editor instance mounted:", !!editorRef.current)

    // @monaco-editor/react auto-creates a placeholder model (an
    // "inmemory://" URI, not one of ours) before onMount fires. Swap it
    // for the real per-path model, then dispose the placeholder so it
    // doesn't leak.
    const placeholderModel = editor.getModel()
    syncActiveModel()
    if (placeholderModel && placeholderModel !== editor.getModel() && !placeholderModel.isDisposed()) {
      placeholderModel.dispose()
    }

    editor.updateOptions({
      ...defaultEditorOptions,
      // Enable inline suggestions but with specific settings to prevent conflicts
      inlineSuggest: {
        enabled: true,
        mode: "prefix",
        suppressSuggestions: false,
      },
      // Disable some conflicting suggest features
      suggest: {
        preview: false, // Disable preview to avoid conflicts
        showInlineDetails: false,
        insertMode: "replace",
      },
      // Quick suggestions
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      // Smooth cursor
      cursorSmoothCaretAnimation: "on",
    })

    configureMonaco(monaco)

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      console.log("Ctrl+Space pressed, triggering suggestion")
      onTriggerSuggestion("completion", editor)
    })

    // Override Tab key with high priority and prevent default Monaco behavior.
    // NOTE: editor.addCommand() returns a command-id string (or null) — not an
    // IDisposable — so there is nothing to dispose here. Commands registered via
    // addCommand are torn down automatically when the editor instance itself is
    // disposed (handled by @monaco-editor/react on unmount), so no manual
    // cleanup is needed or possible for this ref.
    tabCommandRef.current = editor.addCommand(
      monaco.KeyCode.Tab,
      () => {
        console.log("TAB PRESSED", {
          hasSuggestion: !!currentSuggestionRef.current,
          hasActiveSuggestion: hasActiveSuggestionAtPosition(),
          isAccepting: isAcceptingSuggestionRef.current,
          suggestionAccepted: suggestionAcceptedRef.current,
        })

        // CRITICAL: Block if already processing
        if (isAcceptingSuggestionRef.current) {
          console.log("BLOCKED: Already in the process of accepting, ignoring Tab")
          return
        }

        // CRITICAL: Block if just accepted
        if (suggestionAcceptedRef.current) {
          console.log("BLOCKED: Suggestion was just accepted, using default tab")
          editor.trigger("keyboard", "tab", null)
          return
        }

        // If we have an active suggestion at the current position, try to accept it
        if (currentSuggestionRef.current && hasActiveSuggestionAtPosition()) {
          console.log("ATTEMPTING to accept suggestion with Tab")
          const accepted = acceptCurrentSuggestion()
          if (accepted) {
            console.log("SUCCESS: Suggestion accepted via Tab, preventing default behavior")
            return // CRITICAL: Return here to prevent default tab behavior
          }
          console.log("FAILED: Suggestion acceptance failed, falling through to default")
        }

        // Default tab behavior (indentation)
        console.log("DEFAULT: Using default tab behavior")
        editor.trigger("keyboard", "tab", null)
      },
      // CRITICAL: Use specific context to override Monaco's built-in Tab handling
      "editorTextFocus && !editorReadonly && !suggestWidgetVisible",
    )

    // Escape to reject
    editor.addCommand(monaco.KeyCode.Escape, () => {
      console.log("Escape pressed")
      if (currentSuggestionRef.current) {
        onRejectSuggestion(editor)
        clearCurrentSuggestion()
      }
    })

    // Listen for cursor position changes to hide suggestions when moving away.
    // onDidChangeCursorPosition returns a real IDisposable — capture it so it can
    // be disposed on unmount instead of leaking.
    if (cursorPositionListenerRef.current) {
      cursorPositionListenerRef.current.dispose()
      cursorPositionListenerRef.current = null
    }
    cursorPositionListenerRef.current = editor.onDidChangeCursorPosition((e: any) => {
      if (isAcceptingSuggestionRef.current) return

      const newPosition = e.position

      // Clear existing suggestion if cursor moved away
      if (currentSuggestionRef.current && !suggestionAcceptedRef.current) {
        const suggestionPos = currentSuggestionRef.current.position

        // If cursor moved away from suggestion position, clear it
        if (
          newPosition.lineNumber !== suggestionPos.line ||
          newPosition.column < suggestionPos.column ||
          newPosition.column > suggestionPos.column + 10
        ) {
          console.log("Cursor moved away from suggestion, clearing")
          clearCurrentSuggestion()
          onRejectSuggestion(editor)
        }
      }

      // Trigger new suggestion if appropriate (simplified)
      if (!currentSuggestionRef.current && !suggestionLoading) {
        // Clear any existing timeout
        if (suggestionTimeoutRef.current) {
          clearTimeout(suggestionTimeoutRef.current)
        }

        // Trigger suggestion with a delay
        suggestionTimeoutRef.current = setTimeout(() => {
          onTriggerSuggestion("completion", editor)
        }, 300)
      }
    })

    // Listen for content changes to detect manual typing over suggestions.
    // onDidChangeModelContent also returns a real IDisposable — same reasoning as above.
    if (modelContentListenerRef.current) {
      modelContentListenerRef.current.dispose()
      modelContentListenerRef.current = null
    }
    modelContentListenerRef.current = editor.onDidChangeModelContent((e: any) => {
      if (isAcceptingSuggestionRef.current) return

      // If user types while there's a suggestion, clear it (unless it's our insertion)
      if (currentSuggestionRef.current && e.changes.length > 0 && !suggestionAcceptedRef.current) {
        const change = e.changes[0]

        // Check if this is our own suggestion insertion
        if (
          change.text === currentSuggestionRef.current.text ||
          change.text === currentSuggestionRef.current.text.replace(/\r/g, "")
        ) {
          console.log("Our suggestion was inserted, not clearing")
          return
        }

        // User typed something else, clear the suggestion
        console.log("User typed while suggestion active, clearing")
        clearCurrentSuggestion()
      }

      // Trigger context-aware suggestions on certain typing patterns
      if (e.changes.length > 0 && !suggestionAcceptedRef.current) {
        const change = e.changes[0]

        // Trigger suggestions after specific characters
        if (
          change.text === "\n" || // New line
          change.text === "{" || // Opening brace
          change.text === "." || // Dot notation
          change.text === "=" || // Assignment
          change.text === "(" || // Function call
          change.text === "," || // Parameter separator
          change.text === ":" || // Object property
          change.text === ";" // Statement end
        ) {
          setTimeout(() => {
            if (editorRef.current && !currentSuggestionRef.current && !suggestionLoading) {
              onTriggerSuggestion("completion", editor)
            }
          }, 100) // Small delay to let the change settle
        }
      }
    })

    updateEditorLanguage()
  }

  const updateEditorLanguage = () => {
    if (!activeFile || !monacoRef.current || !editorRef.current) return
    const model = editorRef.current.getModel()
    if (!model) return

    const language = getEditorLanguage(activeFile.fileExtension || "")
    try {
      monacoRef.current.editor.setModelLanguage(model, language)
    } catch (error) {
      console.warn("Failed to set editor language:", error)
    }
  }

  // Switch the editor to the active file's own model whenever which file
  // is active changes. Keyed on activeFile.path specifically (not the
  // whole object) so this doesn't re-fire on every keystroke — content
  // changes flow through the model itself, not through this effect.
  useEffect(() => {
    syncActiveModel()
    updateEditorLanguage()
  }, [activeFile?.path])

  // Dispose models for tabs that are no longer open. Without this,
  // closing a tab would leak its Monaco model forever.
  useEffect(() => {
    if (!openFilePaths) return
    const openSet = new Set(openFilePaths)
    for (const [path, model] of modelsRef.current.entries()) {
      if (!openSet.has(path)) {
        if (!model.isDisposed()) model.dispose()
        modelsRef.current.delete(path)
      }
    }
  }, [openFilePaths])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }
      if (inlineCompletionProviderRef.current) {
        inlineCompletionProviderRef.current.dispose()
        inlineCompletionProviderRef.current = null
      }
      // tabCommandRef intentionally NOT disposed here: it holds a command-id
      // string from addCommand, not an IDisposable. Calling .dispose() on it
      // threw "tabCommandRef.current.dispose is not a function" on every
      // unmount. Monaco tears down addCommand registrations itself when the
      // editor instance is disposed.
      tabCommandRef.current = null
      if (cursorPositionListenerRef.current) {
        cursorPositionListenerRef.current.dispose()
        cursorPositionListenerRef.current = null
      }
      if (modelContentListenerRef.current) {
        modelContentListenerRef.current.dispose()
        modelContentListenerRef.current = null
      }
      // Dispose every cached model — the editor instance itself is being
      // torn down, so nothing will reference these afterwards.
      for (const model of modelsRef.current.values()) {
        if (!model.isDisposed()) model.dispose()
      }
      modelsRef.current.clear()
    }
  }, [])

  return (
    <div className="h-full relative">
      {/* Loading indicator */}
      {suggestionLoading && (
        <div className="absolute top-2 right-2 z-10 bg-red-100 dark:bg-red-900 px-2 py-1 rounded text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          AI thinking...
        </div>
      )}

      {/* Active suggestion indicator */}
      {currentSuggestionRef.current && !suggestionLoading && (
        <div className="absolute top-2 right-2 z-10 bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Press Tab to accept
        </div>
      )}

      <Editor
        height="100%"
        // No `value`/`onChange`: content is owned by the per-path Monaco
        // model (see modelsRef/getOrCreateModel above), not by React state
        // pushed down into the editor. This is what gives each file its
        // own undo history and cursor/scroll position across tab switches.
        // `defaultValue`/`language` only matter for the transient
        // placeholder model that exists for the instant before onMount
        // swaps in the real one.
        defaultValue={content}
        onMount={handleEditorDidMount}
        language={activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"}
        // @ts-ignore
        options={defaultEditorOptions}
      />
    </div>
  )
}
