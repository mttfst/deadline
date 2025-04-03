export interface DeadlinePluginSettings {
	projectPath: string;
	workingHoursPerWeek: number;
	workingDaysPerWeek: number;
	priorityLevels: number;
	prioritySplit: number[];
	dirPrefix: string;
}

export interface Timelog {
	date: string;
	time: number;
	info?: string;
}

export interface ProjectData {
	id: string;
	name: string;
	path?: string;
	file?: string;
	deadline?: string;
	priority?: ProjectPriority;
	workload?: number;
	status: ProjectStatus;
}

export interface Project {
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

	totalTime(): number;
}

export enum ProjectStatus {
	Open = "open",
	InProgress = "in_progress",
	Done = "done",
}

export enum ProjectPriority {
	High = "High",
	Medium = "Medium",
	Low = "Low",
	None = "None",
}

export enum ProjectPriority5 {
	Highest = "highest",
	High = "high",
	Medium = "medium",
	Low = "low",
	Lowest = "lowest",
}

// 2. Default values for the settings
export const DEFAULT_SETTINGS: DeadlinePluginSettings = {
	projectPath: "Projects",
	workingHoursPerWeek: 40,
	workingDaysPerWeek: 5,
	priorityLevels: 3,
	prioritySplit: [50, 35, 15],
	dirPrefix: "{{id}}",
};
