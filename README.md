# Set Screens

A Figma-style editor for recreating iPhone and Mac app UIs for film and TV sets. The screens do more than look right. In **Present** mode you can type into real text fields, tap buttons to move between screens with iOS-style transitions, flip toggles, and send chat messages that get scripted replies. That makes it usable as playback on a phone or laptop that's on camera.

## Run it

```bash
npm install
npm run dev        # http://localhost:4317
npm test           # unit tests, including the Claude integration against mocked API responses
```

Projects are stored in your browser's `localStorage`. The first time you open the app, it loads a sample project with an iPhone Messages app and a Mac Notes window. Use **Set Screens menu → Export JSON / Import JSON** to back up a project or move it to another machine.

## What's in the first slice

**Editor** (`/`)
- An infinite canvas. Scroll or drag the background to pan, use ⌘/Ctrl + scroll to zoom, and press Shift+1 to fit everything in view.
- Device frames for iPhone (393×852), iPad, and Mac windows. Each frame is one screen. Drag a screen's label to move it, and double-click the label to play from that screen.
- Element library: text, rectangle, image (upload), button (filled, tinted, or plain, with icons), text field (rounded, iMessage pill, or search), text area, iOS toggle, list row (avatar or icon tile, subtitle, detail, chevron), nav bar, tab bar, status bar, chat bubble, chat thread, and Mac title bar.
- You can select, drag (hold Shift to lock the axis), resize from 8 handles, nudge with the arrow keys, duplicate (⌘D), delete (⌫), reorder layers, and undo/redo (⌘Z / ⇧⌘Z).
- A layers panel, and a properties panel for position, size, fill, radius, opacity, text, font, alignment, and type-specific settings.

**Variables and interactions**
- Project variables can hold text, an on/off value, or a list of messages. Text fields and toggles bind to a variable. Any text can include `{{name}}`, `{{messages.last}}`, or `{{messages.count}}`.
- Interactions run **on tap**, or **on return** for text fields. The available actions are *Go to screen* (push, modal, fade, or instant), *Go back*, *Toggle variable*, *Set variable*, and *Send message*. Send message appends the typed text to a message list, clears the field, and can play scripted replies with a typing indicator.
- **Show if** hides an element unless a variable is set. For example, the Send button only appears once something has been typed.
- **Keyboard-aware** elements slide up above the on-screen iOS keyboard.

**AI assistant** (the **AI** tab in the right panel, or ⌘K)
- Describe what you want in plain English, e.g. “make a WhatsApp-style chat screen with contact Anna”, “make the send button blue”, or “add a settings screen linked from the gear icon”. The assistant creates and edits screens, elements, variables and interactions, not just how things look.
- Claude (Anthropic) is the default provider, with a Claude Sonnet model preselected. OpenAI is available as an alternative. Claude needs an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys); a Claude.ai subscription doesn't include API access. To connect, paste the key into the AI tab. You can change the model in AI settings, or use **Load from key** to list the models your key can use.
- **No API calls are made until a key is saved.** Without a key, a small set of offline rules handles simple commands: recolor, change text, add a screen or element, link an element to a screen, and delete.
- How it works: the editor sends the project JSON (with image data removed), the current selection and your instruction to `POST /api/ai`. That route forwards them to the provider using the key sent with the request; the key is never stored on the server. The model replies with structured operations (`addScreen`, `addElement`, `updateElement`, `addInteraction`, `setVariable`, …). Each operation is checked against a zod schema in `src/lib/ai/ops.ts`, and invalid ones are skipped and reported. The rest are applied as **one undo step**, and the chat lists exactly what changed.
- The AI panel doesn't appear in Present mode.

**Present mode** (`/play?id=…&screen=…`)
- A full-screen device mockup with no editor UI. Everything on the screen is live.
- An optional on-screen iOS keyboard whose keys type into the focused field. A physical keyboard works too.
- Controls appear when you move the mouse and fade out on their own: exit (Esc), restart (Shift+R), device frame on/off (turn it off to fill the display edge to edge when filming a real device), keyboard on/off, hide cursor, and fullscreen.

## Data model

A project is plain JSON (`src/lib/model.ts`):

```
Project { id, version, name, startScreenId, variables[], screens[] }
Screen  { id, name, device: iphone|ipad|mac, x, y, width, height, background, elements[] }
Element { id, type, name, x, y, width, height, fill, textColor, font…, text, showIf?, props{}, interactions[] }
Interaction { trigger: tap|submit, action: navigate|back|toggleVariable|setVariable|sendMessage }
```

The renderer (`src/components/device/`) is the same code in the editor and in Present mode. Only the runtime context changes: a static runtime in the editor, and a live one in Present mode.

## Later: real apps

The model is meant to make these exports possible later. None of them are built yet:
- **PWA export**: bundle the player and one project JSON into a static site that can be installed on an iPhone home screen and launched full screen.
- **Native iPhone app**: map screens to SwiftUI views (a `NavigationStack` for push and modal), elements to SwiftUI primitives, variables to `@State` / `@Observable`, and interactions to actions.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), zustand + immer for editor state and undo history, zod for validating AI operations, vitest, and lucide icons. The only server code is the AI proxy route; there is no database.
