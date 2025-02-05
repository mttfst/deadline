import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// 1. Define the interface for plugin settings
interface DeadlinePluginSettings {
	projectPath: string;
	workingHoursPerWeek: number;
	workingDaysPerWeek: number;
	priorityLevels: number;
	prioritySplit: number[];
}

// 2. Default values for the settings
const DEFAULT_SETTINGS: DeadlinePluginSettings = {
	projectPath: './Projects',
	workingHoursPerWeek: 40,
	workingDaysPerWeek: 5,
	priorityLevels: 3,
	prioritySplit: [50, 35, 15]
};

// 3. Main plugin class
export default class DeadlinePlugin extends Plugin {
	settings: DeadlinePluginSettings;

	// Plugin initialization
	async onload() {
		console.log('Loading Deadline Plugin...');
		
		// Load saved settings or use default values
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Add settings tab to the Obsidian interface
		this.addSettingTab(new DeadlineSettingTab(this.app, this));
	}

	// Save the current settings
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// 4. Define the settings tab
class DeadlineSettingTab extends PluginSettingTab {
	plugin: DeadlinePlugin;

	constructor(app: App, plugin: DeadlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty(); // Clear the container to load new settings
		containerEl.createEl('h2', { text: 'Deadline Plugin Settings' });

		// 5. Input fields for the settings

		// Project Path
		new Setting(containerEl)
			.setName('Project Path')
			.setDesc('Directory where your projects will be stored.')
			.addText(text => text
				.setPlaceholder('./Projects')
				.setValue(this.plugin.settings.projectPath)
				.onChange(async (value) => {
					this.plugin.settings.projectPath = value;
					await this.plugin.saveSettings();
				}));

		// Working Hours Per Week
		new Setting(containerEl)
			.setName('Working Hours Per Week')
			.setDesc('Total working hours available each week.')
			.addText(text => text
				.setPlaceholder('40')
				.setValue(this.plugin.settings.workingHoursPerWeek.toString())
				.onChange(async (value) => {
					this.plugin.settings.workingHoursPerWeek = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Working Days Per Week
		new Setting(containerEl)
			.setName('Working Days Per Week')
			.setDesc('Number of working days in a week.')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.workingDaysPerWeek.toString())
				.onChange(async (value) => {
					this.plugin.settings.workingDaysPerWeek = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Priority Levels
		new Setting(containerEl)
			.setName('Priority Levels')
			.setDesc('Number of priority levels for your projects.')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(this.plugin.settings.priorityLevels.toString())
				.onChange(async (value) => {
					this.plugin.settings.priorityLevels = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Priority Split
		new Setting(containerEl)
			.setName('Priority Split')
			.setDesc('Percentage of time allocated to each priority level (e.g., 50,35,15).')
			.addText(text => text
				.setPlaceholder('50,35,15')
				.setValue(this.plugin.settings.prioritySplit.join(','))
				.onChange(async (value) => {
					this.plugin.settings.prioritySplit = value.split(',').map(Number);
					await this.plugin.saveSettings();
				}));
	}
}

