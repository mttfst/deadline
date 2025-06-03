import { Plugin, TFile, EventRef } from "obsidian";

import { DeadlinePluginSettings } from "./types/types";
import { ProjectCache } from "./data/cache";
import { JsonUtils } from "./utils/jsonUtils";
import { ProjectManager } from "./project/projectManager";
import { ProjectSync } from "./project/projectSync";
import { MarkdownManager } from "./editor/markdownManager";
import { createDeadlineRenderer } from "./editor/renderEngine";
import { UIManager } from "./ui/uiManager";
import { DeadlineAPI } from "./api/api";
import { SettingsUtils, DeadlineSettingTab } from "./ui/settings";

export default class DeadlinePlugin extends Plugin {
	settingsUtils: SettingsUtils;
	projectManager: ProjectManager;
	uiManager: UIManager;
	settings: DeadlinePluginSettings;
	jsonUtils: JsonUtils;

	private projectSync: ProjectSync;
	private projectCache: ProjectCache;

	private renameHandler: EventRef;
	private modifyHandler: EventRef;
	private queue = Promise.resolve();

	// Plugin initialization
	async onload() {
		console.log("Loading Deadline Plugin...");

		this.projectCache = new ProjectCache();
		await this.projectCache.load();

		this.settingsUtils = new SettingsUtils(this);
		await this.settingsUtils.loadSettings();
		this.settings = this.settingsUtils.settings;

		// Add settings tab to the Obsidian interface
		this.addSettingTab(new DeadlineSettingTab(this.app, this));

		this.projectManager = new ProjectManager(
			this.app,
			this.settingsUtils,
			this.projectCache,
		);
		this.uiManager = new UIManager(
			this.app,
			this.settingsUtils,
			this.projectManager,
		);
		this.projectSync = new ProjectSync(this.app, this.projectCache);

		this.addCommand({
			id: "new_project",
			name: "Create New Project",
			callback: async () => this.uiManager.promptNewProject(),
		});

		this.addCommand({
			id: "new_subproject",
			name: "Create New Subproject",
			callback: async () => this.uiManager.promptNewSubProject(),
		});

		this.addCommand({
			id: "log_time",
			name: "Log Work Time",
			callback: async () => this.uiManager.promptLogTime(),
		});

		this.app.workspace.on("file-open", (file) => {
			if (file instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.tags?.includes("deadline")) {
					this.projectSync.cacheYamlData(file);
				}
			}
		});

		this.modifyHandler = this.app.metadataCache.on(
			"changed",
			async (file) => {
				if (file instanceof TFile) {
					// console.log(`modify file ${file}`);
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.tags?.includes("deadline")) {
						// console.log(`modify deadlinefile ${file}`);
						await this.projectSync.syncProjectFromYaml(file);
					}
				}
			},
		);

		this.renameHandler = this.app.vault.on(
			"rename",
			async (file, oldPath) => {
				console.log("rename");
				if (file instanceof TFile) {
					// console.log(`rename folder of file ${file.path}`);
					// console.log(file)
					const cache = this.app.metadataCache.getFileCache(file);
					if (cache?.frontmatter?.tags?.includes("deadline")) {
						this.queue = this.queue
							.then(async () => {
								console.log(
									`Starte Verarbeitung für ${file.path}`,
								);
								await this.projectSync.handleFileRename(
									file,
									oldPath,
								);
								console.log(
									`Verarbeitung abgeschlossen für ${file.path}`,
								);
							})
							.catch((err) => {
								console.error(
									`Fehler bei der Verarbeitung von ${file.path}:`,
									err,
								);
							});
					}
				}
			},
		);



		;
	}
	onunload() {
		console.log("Unloading Deadline Plugin...");

		this.projectCache.clear();

		this.app.vault.offref(this.renameHandler);
		this.app.metadataCache.offref(this.modifyHandler);
	}
}
