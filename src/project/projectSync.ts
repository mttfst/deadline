import { App, Notice, TFile } from "obsidian";

import { ProjectCache } from "../data/cache";
import { JsonUtils } from "../utils/jsonUtils";
import { Project, ProjectData, ProjectStatus } from "../types/types";

export class ProjectSync {
	private app: App;
	private cachedYamlData: Map<string, string> = new Map();
	projectCache: ProjectCache;

	constructor(app: App, projectCache: ProjectCache) {
		this.app = app;
		this.projectCache = projectCache;
	}

	async syncProjectFromYaml(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return;

		const updatedId = cache.frontmatter.id;

		const projects = this.projectCache.get();
		const project = this.findProjectByPath(projects, file.path);
		console.log(file.path, file.name);

		if (!project) {
			new Notice(`Projekt mit Datei ${file.path} nicht gefunden.`);
			return;
		}

		if (updatedId !== project.id) {
			new Notice(
				`ID-Änderung nicht erlaubt. Setze ID auf ${project.id} zurück.`,
			);
			await this.restoreYamlId(file, project.id);
			return;
		}

		const updatedData: Partial<ProjectData> = {
			id: project.id,
			name: cache.frontmatter.name,
			deadline: cache.frontmatter.deadline,
			priority: cache.frontmatter.priority,
			workload: cache.frontmatter.workload,
			status: cache.frontmatter.status as ProjectStatus,
		};

		const updated = this.updateProject(project, updatedData);

		if (updated) {
			const data = await JsonUtils.loadData();
			const saveProject = this.findProjectByPath(
				data.projects,
				file.path,
			);
			if (saveProject) {
				saveProject.name = project.name;
				saveProject.deadline = project.deadline;
				saveProject.priority = project.priority;
				saveProject.workload = project.workload;
				saveProject.status = project.status;
			}

			await JsonUtils.saveData(data);
			// new Notice(`Projekt "${project.name}" erfolgreich aktualisiert.`);
		}
	}

	async restoreYamlId(file: TFile, correctId: string) {
		let content = await this.app.vault.read(file);
		const newContent = content.replace(/^id: .*/m, `id: "${correctId}"`);
		await this.app.vault.modify(file, newContent);
	}

	async handleFileRename(file: TFile, oldPath: string) {
		const data = await JsonUtils.loadData();

		console.log(`handle raname for ${oldPath}`);
		const project = this.findProjectByPath(data.projects, oldPath);
		console.log(project);
		if (!project) {
			console.log(`Project with path "${oldPath}" not found`);
			return;
		}

		console.log(
			`hier wird jetzt die json überschieben ${project.file} wird zu ${file.path}`,
		);

		project.file = file.path;
		project.path = file.parent?.path || "";

		await JsonUtils.saveData(data);
		this.projectCache.reload();
	}

	findProjectByPath(projects: Project[], path: string): Project | undefined {
		// console.log(`find project by path, ${path}`);
		// console.log(projects);
		for (const project of projects) {
			if (project.file === path) {
				return project;
			}
			if (project.subprojects.length > 0) {
				const subproject = this.findProjectByPath(
					project.subprojects,
					path,
				);
				if (subproject) return subproject;
			}
		}
		return undefined;
	}

	// Optional: Beim Öffnen einer Datei den aktuellen YAML-Header cachen
	cacheYamlData(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.tags?.includes("deadline")) {
			this.cachedYamlData.set(
				file.path,
				JSON.stringify(cache.frontmatter),
			);
		}
	}

	// Hilfsfunktion für die Übernahme von Werten aus updatedData
	updateProject(
		project: ProjectData,
		updatedData: Partial<ProjectData>,
	): boolean {
		let updated = false;

		if (
			updatedData.name !== undefined &&
			updatedData.name !== project.name
		) {
			project.name = updatedData.name;
			updated = true;
		}
		if (
			updatedData.deadline !== undefined &&
			updatedData.deadline !== project.deadline
		) {
			project.deadline = updatedData.deadline;
			updated = true;
		}
		if (
			updatedData.priority !== undefined &&
			updatedData.priority !== project.priority
		) {
			project.priority = updatedData.priority;
			updated = true;
		}
		if (
			updatedData.workload !== undefined &&
			updatedData.workload !== project.workload
		) {
			project.workload = updatedData.workload;
			updated = true;
		}
		if (
			updatedData.status !== undefined &&
			updatedData.status !== project.status
		) {
			project.status = updatedData.status;
			updated = true;
		}

		return updated;
	}
}
