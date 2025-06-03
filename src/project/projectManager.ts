import { App, Notice, TFile } from "obsidian";

import { DeadlinePluginSettings, Project, ProjectData } from "../types/types";
import { ProjectCache } from "../data/cache";
import { JsonUtils } from "../utils/jsonUtils";
import { ProjectImpl } from "../project/projectImpl";
import { SettingsUtils } from "../ui/settings";

export class ProjectManager {
	app: App;
	settingsUtils: SettingsUtils;
	settings: DeadlinePluginSettings;
	projectCache: ProjectCache;

	constructor(
		app: App,
		settingsUtils: SettingsUtils,
		projectCache: ProjectCache,
	) {
		this.app = app;
		this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings;
		this.projectCache = projectCache;
	}

	// Get list of existing projects
	async getProjectList(): Promise<string[]> {
		const projects = this.projectCache.get();

		const projectNames = projects.map(
			(project: any) => `${project.id} ${project.name}`,
		);
		return projectNames;
	}

	async getAllProjectList(): Promise<string[]> {
		const projects = this.projectCache.get();

		const result: string[] = [];

		const collectProjects = (project: any, depth = 0) => {
			const indent = "  ".repeat(depth);
			result.push(`${indent}${project.id} ${project.name}`);
			if (Array.isArray(project.subprojects)) {
				for (const sub of project.subprojects) {
					collectProjects(sub, depth + 1);
				}
			}
		};

		for (const project of projects) {
			collectProjects(project);
		}

		return result;
	}

	findProjectById(projects: Project[], id: string): Project | undefined {
		for (const project of projects) {
			if (project.id === id) return project;
			if (project.subprojects?.length) {
				const found = this.findProjectById(project.subprojects, id);
				if (found) return found;
			}
		}
		return undefined;
	}

	async newProjectID(mainProjectId?: string): Promise<string> {
		const projectCount = await this.countProjects(mainProjectId ?? "");
		let newID: string = (projectCount + 1).toString();

		if (mainProjectId) {
			newID = `${mainProjectId}-${newID}`;
		}

		return newID;
	}

	async countProjects(projectId: string): Promise<number> {
		const projects = this.projectCache.get();
		let projectCount: number = 0;

		if (!projectId) {
			projectCount = projects.length;
		}

		const mainProject = projects.find((p: any) => p.id === projectId);
		if (mainProject) {
			projectCount = mainProject.subprojects.length;
		}

		return projectCount;
	}

	async createProject(projectData: ProjectData, mainProjectId?: string) {
		const projectId = await this.newProjectID(mainProjectId);
		projectData.id = projectId;

		const projectPath = await this.createProjectFolder(
			projectData,
			mainProjectId,
		);
		projectData.path = projectPath;

		const projectFile = await this.createProjectFile(
			projectData,
			mainProjectId,
		);
		projectData.file = projectFile;

		console.log(projectData);

		// New Main Project
		if (!mainProjectId) {
			console.log("load data fur neus projekt");
			const data = await JsonUtils.loadData();
			const project = new ProjectImpl(projectData);
			data.projects.push(project);
			await JsonUtils.saveData(data);
			console.log("try reload cache wegen neus projekt");
			this.projectCache.reload();
		}

		// New Sub-Project
		if (mainProjectId) {
			const data = await JsonUtils.loadData();
			const mainProject = data.projects.find(
				(p) => p.id === mainProjectId,
			);
			if (!mainProject) {
				console.log("Projekt nicht gefunden!");
				return;
			}
			mainProject.subprojects.push(new ProjectImpl(projectData));
			await JsonUtils.saveData(data);
			this.projectCache.reload();
		}
	}

	async createProjectFolder(
		projectData: ProjectData,
		mainProjectId?: string,
	): Promise<string> {
		const prefix = this.settings.dirPrefix.replace(
			"{{id}}",
			`${projectData.id}`,
		);
		let dirName = `${projectData.name}`;

		if (prefix) {
			dirName = `${prefix}-${projectData.name}`;
		}

		let path = `${this.settings.projectPath}/${dirName}`;

		if (mainProjectId) {
			const projects = this.projectCache.get();
			const mainProject = projects.find((p) => p.id === mainProjectId);
			path = `${mainProject?.path}/${dirName}`;
		}

		await this.app.vault.createFolder(path);

		return path;
	}

	async createProjectFile(projectData: ProjectData, mainProjectId?: string) {
		const projectFile = `${projectData.path}/${projectData.id}-${projectData.name}.md`;

		const yamlHeader = await this.makeYamlHeader(
			projectData,
			mainProjectId,
		);

		const newFile = await this.app.vault.create(projectFile, yamlHeader);
		await this.app.workspace.getLeaf().openFile(newFile);

		return projectFile;
	}

	async makeYamlHeader(
		projectData: ProjectData,
		mainProjectId?: string,
	): Promise<string> {
		let mainFile = "";

		if (mainProjectId) {
			const projects = this.projectCache.get();
			const mainProject = projects.find((p) => p.id === mainProjectId);
			mainFile = mainProject?.file || "";
		}

		const lines = [
			"---",
			`id: "${projectData.id}"`,
			`name: ${projectData.name}`,
			mainProjectId ? `link: "[[${mainFile}]]"` : "",
			`deadline: ${projectData.deadline}`,
			`priority: ${projectData.priority}`,
			`workload: ${projectData.workload}`,
			`status: ${projectData.status}`,
			"tags:",
			"  - deadline",
			"---",
		].filter(Boolean);

		return lines.join("\n");
	}

	// Function to update the main project note with subproject links
	async updateMainProjectList(mainProject: string) {
		const projectFolderPath = `${this.settings.projectPath}/${mainProject}`;
		const projectFilePath = `${projectFolderPath}/main_${mainProject}.md`;
		const subProjectFiles = (
			await this.app.vault.adapter.list(projectFolderPath)
		).files;
		const subProjects = subProjectFiles
			.filter((file) => file.includes("/sub_"))
			.map((file) => `- [[${file.split("/").pop()}]]`);

		try {
			let mainProjectFile = await this.app.vault.read(
				this.app.vault.getAbstractFileByPath(projectFilePath) as TFile,
			);
			const subProjectSection = `## Subprojects
${subProjects.join("\n")}`;

			if (mainProjectFile.includes("## Subprojects")) {
				mainProjectFile = mainProjectFile.replace(
					/## Subprojects[\s\S]*?(?=\n##|$)/,
					subProjectSection,
				);
			} else {
				mainProjectFile += `\n\n${subProjectSection}`;
			}

			await this.app.vault.modify(
				this.app.vault.getAbstractFileByPath(projectFilePath) as TFile,
				mainProjectFile,
			);
		} catch (error) {
			console.error("Failed to update main project note:", error);
			new Notice(
				"Failed to update main project note. Check console for details.",
			);
		}
	}

	async logTime(projectId: string, timeSpent: string, description: string) {
		const data = await JsonUtils.loadData();
		const project = this.findProjectById(data.projects, projectId);

		if (!project) {
			new Notice(`Projekt mit ID "${projectId}" nicht gefunden.`);
			return;
		}
		const timeStamp = this.getLocalTimestamp();

		project.timelog.push({
			date: timeStamp, // angepasst an dein Timelog-Interface
			time: parseFloat(timeSpent),
			info: description,
		});

		await JsonUtils.saveData(data);
		new Notice(`Added Timelog to Project "${project.name}".`);
	}
	getLocalTimestamp(): string {
		const now = new Date();

		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0"); // Monate 0-11
		const day = String(now.getDate()).padStart(2, "0");

		const hours = String(now.getHours()).padStart(2, "0");
		const minutes = String(now.getMinutes()).padStart(2, "0");

		return `${year}${month}${day} ${hours}:${minutes}`;
	}
}
