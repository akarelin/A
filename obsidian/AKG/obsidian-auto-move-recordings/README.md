# Auto Move Recordings - Obsidian Plugin

Automatically moves voice recordings (`.webm` files) from your Obsidian vault root to a specified folder when they are created.

## Features

- **Automatic file moving**: Watches for new `.webm` files in vault root and moves them automatically
- **Auto-process existing files**: On plugin load, automatically moves any existing recordings in vault root
- **Safe copy-first approach**: Copies files first, verifies the copy, then deletes the original (if copy fails, original remains untouched)
- **Configurable target folder**: Set any destination folder (e.g., `D:\SD\Transcripts.incoming`)
- **Manual trigger**: Command to move all existing recordings at once
- **Activity log**: Optional logging of all file moves to `auto-move-log.md`
- **Notifications**: Visual feedback when files are moved
- **Toggle on/off**: Easy command to enable/disable auto-move

## Installation

### Method 1: Manual Installation (Recommended)

1. **Download the plugin files**:
   - `main.js`
   - `manifest.json`
   - `versions.json`

2. **Locate your Obsidian plugins folder**:
   - Open Obsidian
   - Go to Settings → Community plugins → Click the folder icon next to "Installed plugins"
   - This will open your vault's `.obsidian/plugins/` folder

3. **Create plugin folder**:
   - Inside `.obsidian/plugins/`, create a new folder named `auto-move-recordings`

4. **Copy files**:
   - Copy the three downloaded files into `.obsidian/plugins/auto-move-recordings/`

5. **Enable the plugin**:
   - Go back to Obsidian
   - Go to Settings → Community plugins
   - Find "Auto Move Recordings" in the list
   - Toggle it on

### Method 2: Using BRAT (Beta Reviewers Auto-update Tester)

If you have BRAT installed, you can add this plugin from a GitHub repository (if published).

## Configuration

After installing, configure the plugin:

1. Go to **Settings → Auto Move Recordings**

2. Configure the following options:

   - **Enable auto-move**: Toggle automatic moving on/off (default: enabled)
   - **Target folder**: Set the destination folder (default: `D:\SD\Transcripts.incoming`)
   - **File extension**: File type to watch for (default: `.webm`)
   - **Show notifications**: Display notification when files are moved (default: enabled)
   - **Log moves**: Keep a log of all moves in `auto-move-log.md` (default: enabled)

### Important Notes

- The target folder path should use the format appropriate for your operating system:
  - **Windows**: `D:\SD\Transcripts.incoming` or `D:/SD/Transcripts.incoming`
  - **macOS/Linux**: `/Users/username/Transcripts.incoming` or `/home/username/Transcripts.incoming`
- The plugin will create the target folder if it doesn't exist
- Only files in the **vault root** are processed (not in subdirectories)

## Usage

### Automatic Mode

Once enabled, the plugin automatically:

**On Plugin Load:**
1. Scans vault root for existing `.webm` files
2. Moves all found recordings to target folder (2 seconds after load)
3. Shows summary notification of moved files

**For New Files:**
1. Watches for new `.webm` files created in vault root
2. Waits 1 second to ensure file is fully written
3. **Copies** the file to the target folder
4. **Verifies** the copy succeeded (checks file size)
5. **Deletes** the original only if copy was successful
6. Logs the move (if enabled)
7. Shows a notification (if enabled)

### Manual Commands

The plugin provides two commands accessible via Command Palette (Ctrl/Cmd + P):

1. **Move all recordings now**
   - Manually moves all `.webm` files currently in vault root
   - Useful for batch processing existing files

2. **Toggle auto-move**
   - Quickly enable/disable automatic moving
   - Current status shown in notification

## Safety Features

### Copy-First Approach

The plugin uses a safe copy-first strategy:

1. **Copy**: File is copied to destination
2. **Verify**: File sizes are compared to ensure complete copy
3. **Delete**: Original is deleted only if verification passes
4. **Rollback**: If copy fails, incomplete copy is deleted and original remains

This ensures you never lose recordings due to copy failures.

### Error Handling

- If the target folder cannot be created, the file remains in vault
- If the copy fails, the original file is not deleted
- If verification fails, the incomplete copy is removed
- All errors are logged to console and shown in notifications

## Activity Log

When logging is enabled, all file moves are recorded in `auto-move-log.md` in your vault root:

```markdown
# Auto Move Recordings Log

- 2025-11-21T10:30:45.123Z: Moved `2025-11-09T11-09-44-688Z.webm` to `D:\SD\Transcripts.incoming\2025-11-09T11-09-44-688Z.webm`
- 2025-11-21T10:31:12.456Z: Moved `2025-11-09T11-10-59-811Z.webm` to `D:\SD\Transcripts.incoming\2025-11-09T11-10-59-811Z.webm`
```

This provides a complete audit trail of all moved files.

## Workflow Integration

This plugin is designed to work as part of a larger workflow:

1. **Record** voice notes in Obsidian (creates `.webm` in vault root)
2. **Auto-move** to `D:\SD\Transcripts.incoming` (this plugin)
3. **Monitor** the incoming folder with another process
4. **Upload** to Manus cloud storage (separate script)
5. **Transcribe** and process recordings

## Troubleshooting

### Files are not being moved

- Check that auto-move is enabled in settings
- Verify the target folder path is correct for your OS
- Check that files are in vault **root** (not subdirectories)
- Check that file extension matches (default: `.webm`)
- Look for error notifications

### Copy verification fails

- Ensure target drive has sufficient space
- Check target folder permissions
- Try a different target folder

### Plugin not appearing

- Ensure all three files are in `.obsidian/plugins/auto-move-recordings/`
- Restart Obsidian
- Check that Community plugins are enabled in Settings

## Technical Details

- **Platform**: Desktop only (requires Node.js `fs` module)
- **Obsidian version**: Requires 0.15.0 or higher
- **File operations**: Uses `fs.copyFileSync()` and `fs.unlinkSync()`
- **Verification**: Compares file sizes after copy

## License

MIT License - Free to use and modify

## Support

For issues or questions, please refer to the Manus documentation or support channels.
