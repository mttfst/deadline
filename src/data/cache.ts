import { Project } from "../types/types";
import { JsonUtils } from "../utils/jsonUtils";

export class ProjectCache {
	private cachedProjects: Project[] | null = null;

	async load(): Promise<void> {
		const data = await JsonUtils.loadData();
		this.cachedProjects = data.projects;
		console.log("load cache");
	}

	get(): Project[] {
		console.log("get cache");
		if (!this.cachedProjects) {
			throw new Error(
				"Project cache not initialized. Did you forget to call load()?",
			);
		}
		return [...this.cachedProjects!];
	}

	clear(): void {
		console.log("clear cache");
		this.cachedProjects = null;
	}

	isInitialized(): boolean {
		return this.cachedProjects !== null;
	}

	reload(): Promise<void> {
		console.log("reload cache");
		this.clear();
		return this.load();
	}
}
