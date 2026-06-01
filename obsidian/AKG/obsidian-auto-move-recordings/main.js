const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
    targetFolder: 'D:\\SD\\Transcripts.incoming',
    fileExtension: '.webm',
    enableAutoMove: true,
    showNotifications: true,
    logMoves: true
};

module.exports = class AutoMoveRecordingsPlugin extends Plugin {
    async onload() {
        console.log('Loading Auto Move Recordings Plugin');
        
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new AutoMoveSettingTab(this.app, this));
        
        // Add ribbon icon
        this.addRibbonIcon('folder-input', 'Auto Move Recordings', () => {
            new Notice(`Auto Move: ${this.settings.enableAutoMove ? 'Enabled' : 'Disabled'}`);
        });
        
        // Register file creation event
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                this.handleFileCreation(file);
            })
        );
        
        // Add command to manually trigger move
        this.addCommand({
            id: 'move-recordings-now',
            name: 'Move all recordings now',
            callback: () => {
                this.moveAllRecordings();
            }
        });
        
        // Add command to toggle auto-move
        this.addCommand({
            id: 'toggle-auto-move',
            name: 'Toggle auto-move',
            callback: () => {
                this.settings.enableAutoMove = !this.settings.enableAutoMove;
                this.saveSettings();
                new Notice(`Auto-move ${this.settings.enableAutoMove ? 'enabled' : 'disabled'}`);
            }
        });
        
        // Move existing files on load if auto-move is enabled
        if (this.settings.enableAutoMove) {
            // Use setTimeout to avoid blocking plugin load
            setTimeout(() => {
                this.moveExistingFiles();
            }, 2000);
        }
        
        new Notice('Auto Move Recordings Plugin loaded');
    }
    
    async handleFileCreation(file) {
        // Only process if auto-move is enabled
        if (!this.settings.enableAutoMove) {
            return;
        }
        
        // Check if file is in vault root
        if (!file.parent || !file.parent.isRoot()) {
            return; // Not in root, skip
        }
        
        // Check if file has the target extension
        if (!file.name.endsWith(this.settings.fileExtension)) {
            return;
        }
        
        // Wait a bit to ensure file is fully written
        await this.sleep(1000);
        
        // Move the file
        await this.moveFile(file);
    }
    
    async moveFile(file) {
        let targetPath = null;
        
        try {
            // Ensure target folder exists
            await this.ensureTargetFolderExists();
            
            // Get full source path using Obsidian's adapter
            const sourcePath = this.app.vault.adapter.getFullPath(file.path);
            
            // Get target path
            targetPath = path.join(this.settings.targetFolder, file.name);
            
            // Check if source file exists
            if (!fsSync.existsSync(sourcePath)) {
                console.error(`Source file does not exist: ${sourcePath}`);
                return;
            }
            
            // Step 1: Read the file content from vault
            const fileContent = await this.app.vault.adapter.readBinary(file.path);
            
            // Step 2: Write to target location
            await fs.writeFile(targetPath, Buffer.from(fileContent));
            
            // Step 3: Verify the copy succeeded by checking file size
            const sourceStats = fsSync.statSync(sourcePath);
            const targetStats = fsSync.statSync(targetPath);
            
            if (sourceStats.size !== targetStats.size) {
                // Copy verification failed - delete the incomplete copy
                await fs.unlink(targetPath);
                throw new Error('Copy verification failed: file sizes do not match');
            }
            
            // Step 4: Only after successful copy and verification, delete the original from vault
            await this.app.vault.delete(file);
            
            // Log the move
            if (this.settings.logMoves) {
                await this.logMove(file.name, targetPath);
            }
            
            // Show notification
            if (this.settings.showNotifications) {
                new Notice(`Moved: ${file.name}`);
            }
            
            console.log(`Successfully moved ${file.name} to ${targetPath}`);
            
        } catch (error) {
            console.error('Error moving file:', error);
            
            // Clean up partial copy if it exists
            if (targetPath && fsSync.existsSync(targetPath)) {
                try {
                    await fs.unlink(targetPath);
                    console.log('Cleaned up partial copy');
                } catch (cleanupError) {
                    console.error('Error cleaning up partial copy:', cleanupError);
                }
            }
            
            new Notice(`Error moving ${file.name}: ${error.message}`);
        }
    }
    
    async ensureTargetFolderExists() {
        try {
            if (!fsSync.existsSync(this.settings.targetFolder)) {
                await fs.mkdir(this.settings.targetFolder, { recursive: true });
                console.log(`Created target folder: ${this.settings.targetFolder}`);
            }
        } catch (error) {
            throw new Error(`Cannot create target folder: ${error.message}`);
        }
    }
    
    async moveExistingFiles() {
        console.log('Checking for existing recordings to move...');
        const files = this.app.vault.getFiles();
        let movedCount = 0;
        let errorCount = 0;
        
        for (const file of files) {
            // Only process files in root with target extension
            if (file.parent && file.parent.isRoot() && file.name.endsWith(this.settings.fileExtension)) {
                try {
                    await this.moveFile(file);
                    movedCount++;
                    // Add small delay between files to avoid overwhelming the system
                    await this.sleep(100);
                } catch (error) {
                    errorCount++;
                    console.error(`Failed to move ${file.name}:`, error);
                }
            }
        }
        
        if (movedCount > 0 || errorCount > 0) {
            if (errorCount > 0) {
                new Notice(`Auto-moved ${movedCount} existing recording(s), ${errorCount} failed`);
            } else {
                new Notice(`Auto-moved ${movedCount} existing recording(s)`);
            }
            console.log(`Auto-moved ${movedCount} existing recordings, ${errorCount} errors`);
        } else {
            console.log('No existing recordings found to move');
        }
    }
    
    async moveAllRecordings() {
        const files = this.app.vault.getFiles();
        let movedCount = 0;
        let errorCount = 0;
        
        for (const file of files) {
            // Only process files in root with target extension
            if (file.parent && file.parent.isRoot() && file.name.endsWith(this.settings.fileExtension)) {
                try {
                    await this.moveFile(file);
                    movedCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`Failed to move ${file.name}:`, error);
                }
            }
        }
        
        if (errorCount > 0) {
            new Notice(`Moved ${movedCount} recording(s), ${errorCount} failed`);
        } else {
            new Notice(`Moved ${movedCount} recording(s)`);
        }
    }
    
    async logMove(fileName, targetPath) {
        const logFile = 'auto-move-log.md';
        const timestamp = new Date().toISOString();
        const logEntry = `- ${timestamp}: Moved \`${fileName}\` to \`${targetPath}\`\n`;
        
        try {
            // Check if log file exists
            const exists = await this.app.vault.adapter.exists(logFile);
            
            if (exists) {
                // Append to existing log
                const content = await this.app.vault.adapter.read(logFile);
                await this.app.vault.adapter.write(logFile, content + logEntry);
            } else {
                // Create new log file
                const header = '# Auto Move Recordings Log\n\n';
                await this.app.vault.adapter.write(logFile, header + logEntry);
            }
        } catch (error) {
            console.error('Error writing to log:', error);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    onunload() {
        console.log('Unloading Auto Move Recordings Plugin');
    }
};

class AutoMoveSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: 'Auto Move Recordings Settings' });
        
        containerEl.createEl('p', { 
            text: 'This plugin automatically moves voice recordings from vault root to an external folder.',
            cls: 'setting-item-description'
        });
        
        new Setting(containerEl)
            .setName('Enable auto-move')
            .setDesc('Automatically move recordings when created')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoMove)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoMove = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Target folder')
            .setDesc('Full path to folder where recordings will be moved (e.g., D:\\SD\\Transcripts.incoming or /home/user/transcripts)')
            .addText(text => text
                .setPlaceholder('D:\\SD\\Transcripts.incoming')
                .setValue(this.plugin.settings.targetFolder)
                .onChange(async (value) => {
                    this.plugin.settings.targetFolder = value;
                    await this.plugin.saveSettings();
                })
                .inputEl.setAttribute('style', 'width: 100%;'));
        
        new Setting(containerEl)
            .setName('File extension')
            .setDesc('File extension to watch for (e.g., .webm, .mp3)')
            .addText(text => text
                .setPlaceholder('.webm')
                .setValue(this.plugin.settings.fileExtension)
                .onChange(async (value) => {
                    this.plugin.settings.fileExtension = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Show notifications')
            .setDesc('Show notification when a file is moved')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.showNotifications = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Log moves')
            .setDesc('Keep a log of all moved files in auto-move-log.md')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.logMoves)
                .onChange(async (value) => {
                    this.plugin.settings.logMoves = value;
                    await this.plugin.saveSettings();
                }));
        
        // Add test section
        containerEl.createEl('h3', { text: 'Testing' });
        
        new Setting(containerEl)
            .setName('Test configuration')
            .setDesc('Check if target folder is accessible')
            .addButton(button => button
                .setButtonText('Test')
                .onClick(async () => {
                    try {
                        const fsSync = require('fs');
                        const targetFolder = this.plugin.settings.targetFolder;
                        
                        // Try to access the folder
                        if (fsSync.existsSync(targetFolder)) {
                            new Notice('✓ Target folder exists and is accessible');
                        } else {
                            // Try to create it
                            await require('fs').promises.mkdir(targetFolder, { recursive: true });
                            new Notice('✓ Target folder created successfully');
                        }
                    } catch (error) {
                        new Notice(`✗ Error: ${error.message}`);
                    }
                }));
    }
}
