# Voice AI Assistant - Mobile App Design

## Overview
A voice-first iOS mobile assistant that enables hands-free interaction with an LLM and provides dictation capabilities with markdown/Obsidian integration. The app is designed for **mobile portrait orientation (9:16)** and **one-handed usage**, following Apple Human Interface Guidelines (HIG).

---

## Screen List

### 1. Home Screen (Main Voice Interface)
The primary interaction point with a large, central voice activation button.

### 2. Chat History Screen
View past conversations and queries with the LLM.

### 3. Dictation Screen
Dedicated dictation mode with real-time transcription and editing.

### 4. Notes Browser Screen
Browse, search, and manage markdown/Obsidian notes.

### 5. Note Detail Screen
View and edit individual notes with voice commands.

### 6. Settings Screen
Configure voice settings, LLM preferences, and notes folder location.

---

## Primary Content and Functionality

### Home Screen
- **Large circular voice button** (center-bottom, thumb zone) - tap to start/stop listening
- **Waveform visualization** - shows audio input levels during recording
- **Status indicator** - "Listening...", "Processing...", "Speaking..."
- **Response card** - displays LLM response with text and play/pause controls
- **Mode toggle** - switch between "Ask AI" and "Dictate" modes
- **Quick actions** - recent queries, search notes shortcut

### Chat History Screen
- **List of conversations** - grouped by date
- **Each item shows**: query preview, timestamp, response preview
- **Swipe actions**: delete, share, copy
- **Search bar** at top

### Dictation Screen
- **Real-time transcription area** - large text display
- **Voice control bar** (bottom):
  - Record/pause button
  - "Read back" button
  - "Rephrase" button (asks AI to improve)
  - "Save" button
- **Editing controls**: select text, voice commands for edit
- **Passage navigation**: "Read paragraph 2", "Go to beginning"

### Notes Browser Screen
- **Folder tree view** - expandable directories
- **Recent notes** section
- **Search bar** with voice search
- **Note cards**: title, preview, last modified date
- **Floating action button**: create new note

### Note Detail Screen
- **Note title** (editable)
- **Markdown content** (rendered or raw toggle)
- **Voice toolbar**:
  - "Read aloud" - TTS for note content
  - "Edit with voice" - start dictation at cursor
  - "Summarize" - ask AI to summarize
- **Share/export options**

### Settings Screen
- **Voice Settings**:
  - Speech rate slider
  - Voice selection (system voices)
  - Auto-listen toggle
  - Wake word enable/disable
- **AI Settings**:
  - Model selection
  - Response length preference
  - Custom system prompt
- **Notes Settings**:
  - Notes folder path
  - Sync options
  - File format preferences
- **About & Help**

---

## Key User Flows

### Flow 1: Ask AI a Question
1. User taps large voice button on Home Screen
2. App shows "Listening..." with waveform animation
3. User speaks: "What's the framework that does server-side rendering and static generation?"
4. App shows "Processing..." status
5. LLM response appears in response card
6. App automatically reads response aloud (TTS)
7. User can tap to stop, or ask follow-up

### Flow 2: Search Notes and Summarize
1. User taps voice button
2. User speaks: "Search my notes on machine learning and summarize"
3. App searches notes folder for "machine learning"
4. Matching notes displayed briefly
5. AI generates summary from found notes
6. Response read aloud with option to view source notes

### Flow 3: Dictation Session
1. User navigates to Dictation tab (or says "Start dictation")
2. Taps record button
3. Speaks freely - text appears in real-time
4. User says "Read back last paragraph"
5. App reads the last paragraph aloud
6. User says "Rephrase that more formally"
7. AI suggests rephrased version
8. User approves or requests another version
9. User says "Save to notes as meeting-notes.md"
10. File saved to notes folder

### Flow 4: Edit Existing Note
1. User opens Notes Browser
2. Taps on a note or says "Open my note about project ideas"
3. Note Detail screen opens
4. User taps "Read aloud" - app reads note
5. User says "Edit paragraph 3"
6. Cursor moves to paragraph 3, dictation mode activates
7. User dictates changes
8. User says "Done editing"
9. Changes saved automatically

---

## Color Choices

### Primary Palette
- **Accent Color**: `#007AFF` (iOS Blue) - primary actions, active states
- **Secondary Accent**: `#34C759` (iOS Green) - recording indicator, success states
- **Alert/Stop**: `#FF3B30` (iOS Red) - stop recording, errors

### Text Colors
- **Primary Text**: `#000000` (light mode) / `#FFFFFF` (dark mode)
- **Secondary Text**: `#8E8E93` - timestamps, hints
- **Disabled Text**: `#C7C7CC`

### Surface Colors
- **Background**: `#F2F2F7` (light) / `#000000` (dark)
- **Card/Elevated**: `#FFFFFF` (light) / `#1C1C1E` (dark)
- **Input Background**: `#E5E5EA` (light) / `#2C2C2E` (dark)

### Voice UI Specific
- **Waveform Active**: `#007AFF` with 60% opacity gradient
- **Waveform Inactive**: `#C7C7CC`
- **Pulse Animation**: `#007AFF` at 20% opacity expanding rings

---

## Typography

Following iOS system fonts:
- **Large Title**: 34pt, Bold - screen titles
- **Title 1**: 28pt, Bold - section headers
- **Title 2**: 22pt, Bold - card titles
- **Body**: 17pt, Regular - main content
- **Callout**: 16pt, Regular - secondary content
- **Caption**: 12pt, Regular - timestamps, hints

---

## Layout Specifications

### Voice Button (Home Screen)
- Size: 120pt diameter
- Position: center horizontally, 80pt from bottom safe area
- Touch target: 140pt (includes padding)
- States: idle (outline), listening (filled + pulse), processing (filled + spinner)

### Tab Bar
- Height: 49pt + safe area
- 4 tabs: Home, Dictate, Notes, Settings
- Icons: 28pt, filled style

### Cards
- Corner radius: 12pt
- Padding: 16pt
- Shadow: subtle (2pt y-offset, 8pt blur, 10% black)

### Spacing
- Screen padding: 16pt horizontal
- Section spacing: 24pt
- Item spacing: 12pt

---

## Accessibility Considerations

- All voice features have visual alternatives
- High contrast mode support
- VoiceOver compatible
- Haptic feedback for key actions
- Large touch targets (minimum 44pt)
- Clear status announcements

---

## Technical Notes

### Voice Recognition
- Use `expo-speech-recognition` or native iOS Speech framework
- Support continuous listening mode
- Handle background audio properly

### Text-to-Speech
- Use `expo-speech` for TTS
- Queue management for long responses
- Interrupt handling when user speaks

### LLM Integration
- Use server-side API to call LLM (via Forge API)
- Stream responses when possible
- Handle offline gracefully

### Notes Storage
- Use device file system via `expo-file-system`
- Support markdown parsing and rendering
- Index notes for fast search
