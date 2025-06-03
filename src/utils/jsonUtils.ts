import { promises as fs } from "fs";

import { Project, ProjectData } from "../types/types";
import { ProjectImpl } from "../project/projectImpl";

const FILE_PATH = "/Users/Faust/Documents/Arbeit/Testvalut2/projects.json";

export class JsonUtils {
	public static async loadData(): Promise<{ projects: ProjectImpl[] }> {
		console.log("loadData()");
		try {
			// Check if the file exists, otherwise create an empty one
			try {
				await fs.access(FILE_PATH, fs.constants.F_OK);
			} catch {
				await fs.writeFile(
					FILE_PATH,
					JSON.stringify({ projects: [] }, null, 2),
					"utf8",
				);
			}

			// Read and parse the JSON file
			const dataStr = await fs.readFile(FILE_PATH, "utf8");

			const data = JSON.parse(dataStr);

			// Convert JSON objects into ProjectImpl instances
			data.projects = data.projects.map((p: Project) =>
				this.restoreProject(p),
			);

			return data;
		} catch (error) {
			return { projects: [] };
		}
	}
	//  Helper function: Converts a JSON object into a `ProjectImpl` instance
	private static restoreProject(p: Project): ProjectImpl {
		const projectData: ProjectData = {
			id: p.id,
			name: p.name,
			status: p.status,
			path: p.path,
			file: p.file,
			deadline: p.deadline,
			priority: p.priority,
			workload: p.workload,
		};
		const project = new ProjectImpl(projectData);
		project.timelog = p.timelog || [];
		project.subprojects = p.subprojects.map((sub) =>
			this.restoreProject(sub),
		);
		return project;
	}

	public static async saveData(data: { projects: Project[] }): Promise<void> {
		try {
			await fs.writeFile(
				FILE_PATH,
				JSON.stringify(data, null, 2),
				"utf8",
			);
		} catch (error) {
			console.error("Error saving data to file:", error);
		}
	}
}
