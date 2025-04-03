import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

import DeadlinePlugin from "../main";
import { DeadlinePluginSettings, DEFAULT_SETTINGS } from "../types/types";

export class SettingsUtils {
	private plugin: Plugin;
	settings: DeadlinePluginSettings;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.plugin.loadData(),
		);
		await this.checkSettings();
	}

	async checkSettings() {
		if (this.settings.projectPath.startsWith("./")) {
			this.settings.projectPath = this.settings.projectPath.replace(
				/^\.\//,
				"",
			);
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.plugin.saveData(this.settings);
	}
}

export class DeadlineSettingTab extends PluginSettingTab {
	plugin: DeadlinePlugin;
	settings: DeadlinePluginSettings;

	constructor(app: App, plugin: DeadlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = this.plugin.settingsUtils.settings;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty(); // Clear the container to load new settings
		containerEl.createEl("h2", { text: "Deadline Plugin Settings" });

		// 5. Input fields for the settings

		// Project Path
		new Setting(containerEl)
			.setName("Project Path")
			.setDesc("Directory where your projects will be stored.")
			.addText((text) =>
				text
					.setPlaceholder("./Projects")
					.setValue(this.settings.projectPath)
					.onChange(async (value) => {
						this.settings.projectPath = value;
						await this.plugin.settingsUtils.saveSettings();
					}),
			);

		// Working Hours Per Week
		new Setting(containerEl)
			.setName("Working Hours Per Week")
			.setDesc("Total working hours available each week.")
			.addText((text) =>
				text
					.setPlaceholder("40")
					.setValue(this.settings.workingHoursPerWeek.toString())
					.onChange(async (value) => {
						this.settings.workingHoursPerWeek = parseInt(value);
						await this.plugin.settingsUtils.saveSettings();
					}),
			);

		// Working Days Per Week
		new Setting(containerEl)
			.setName("Working Days Per Week")
			.setDesc("Number of working days in a week.")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(this.settings.workingDaysPerWeek.toString())
					.onChange(async (value) => {
						this.settings.workingDaysPerWeek = parseInt(value);
						await this.plugin.settingsUtils.saveSettings();
					}),
			);

		// Priority Levels
		new Setting(containerEl)
			.setName("Priority Levels")
			.setDesc("Number of priority levels for your projects.")
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue(this.settings.priorityLevels.toString())
					.onChange(async (value) => {
						this.settings.priorityLevels = parseInt(value);
						await this.plugin.settingsUtils.saveSettings();
					}),
			);

		// Priority Split
		new Setting(containerEl)
			.setName("Priority Split")
			.setDesc(
				"Percentage of time allocated to each priority level (e.g., 50,35,15).",
			)
			.addText((text) =>
				text
					.setPlaceholder("50,35,15")
					.setValue(this.settings.prioritySplit.join(","))
					.onChange(async (value) => {
						this.settings.prioritySplit = value
							.split(",")
							.map(Number);
						await this.plugin.settingsUtils.saveSettings();
					}),
			);
	}
}
