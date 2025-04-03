import {
	Project,
	ProjectData,
	ProjectStatus,
	ProjectPriority,
	Timelog,
} from "../types/types";

export class ProjectImpl implements Project {
	readonly id: string;
	name: string;
	path: string;
	file: string;
	deadline?: string;
	priority?: ProjectPriority;
	workload?: number;
	status: ProjectStatus;
	timelog: Timelog[];
	subprojects: Project[];

	constructor(projectData: ProjectData) {
		this.id = projectData.id;
		this.name = projectData.name;
		this.path = projectData.path || "";
		this.file = projectData.file || "";
		this.status = projectData.status;
		this.deadline = projectData.deadline || "";
		this.priority = projectData.priority || ProjectPriority.Medium;
		this.workload = projectData.workload || 0;
		this.timelog = [];
		this.subprojects = [];
	}

	totalTime(): number {
		const ownTime = this.timelog.reduce((sum, log) => sum + log.time, 0);
		const subprojectTime = this.subprojects.reduce(
			(sum, sub) => sum + sub.totalTime(),
			0,
		);
		return ownTime + subprojectTime;
	}

	addTimelog(date: string, time: number, info?: string): void {
		this.timelog.push({ date, time, info });
	}
}
