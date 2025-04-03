import { App, Notice } from "obsidian";

import { ProjectData } from "../types/types";
import { DeadlinePluginSettings } from "../types/types";
import { ProjectManager } from "../project/projectManager";
import { SettingsUtils } from "../ui/settings";
import {
	LogTimeModal,
	NameInputModal,
	SelectProjectModal,
} from "../ui/inputModal";

export class UIManager {
	private app: App;
	private settingsUtils: SettingsUtils;
	private projectManager: ProjectManager;
	private settings: DeadlinePluginSettings;

	constructor(
		app: App,
		settingsUtils: SettingsUtils,
		projectManager: ProjectManager,
	) {
		this.app = app;
		this.projectManager = projectManager;
		this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings;
	}

	promptNewProject() {
		new NameInputModal(
			this.app,
			this.settings,
			async (projectData: ProjectData) => {
				await this.projectManager.createProject(projectData);
			},
		).open();
	}

	async promptNewSubProject() {
		const projects = await this.projectManager.getProjectList();
		if (projects.length === 0) {
			new Notice("No existing projects found.");
			return;
		}

		new SelectProjectModal(this.app, projects, async (projectId) => {
			new NameInputModal(
				this.app,
				this.settings,
				async (projectData: ProjectData) => {
					await this.projectManager.createProject(
						projectData,
						projectId,
					);
				},
			).open();
		}).open();
	}

	async promptLogTime() {
		const projects = await this.projectManager.getAllProjectList();
		if (projects.length === 0) {
			new Notice("No existing projects found.");
			return;
		}

		new SelectProjectModal(this.app, projects, async (projectId) => {
			new LogTimeModal(this.app, async (timeSpent, description) => {
				console.log(projectId, timeSpent, description);
				// 	// Implement logTime logic separately
				await this.projectManager.logTime(
					projectId,
					timeSpent,
					description,
				);
			}).open();
		}).open();
	}
}
