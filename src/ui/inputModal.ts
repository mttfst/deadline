import {
	App,
	Notice,
	Modal,
	SuggestModal,
	TextComponent,
	DropdownComponent,
} from "obsidian";

import {
	ProjectData,
	ProjectStatus,
	ProjectPriority,
	DeadlinePluginSettings,
} from "../types/types";

// Modal for entering project name
export class NameInputModal extends Modal {
	private settings: DeadlinePluginSettings;
	// private callback: (name: string, deadline: string, priority: string, estimatedHours: string) => void;
	private callback: (projectData: ProjectData) => void;

	constructor(
		app: App,
		settings: DeadlinePluginSettings,
		callback: (projectData: ProjectData) => void,
	) {
		super(app);
		this.settings = settings;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Create New Project" });

		contentEl.createEl("h3", { text: "Project Title" });
		const inputEl = new TextComponent(contentEl);
		inputEl.inputEl.style.width = "100%";
		inputEl.inputEl.placeholder = "Project Name";

		contentEl.createEl("h4", { text: "Deadline (optional)" });
		const deadlineEl = new TextComponent(contentEl);
		deadlineEl.inputEl.type = "date";
		deadlineEl.inputEl.style.width = "100%";

		contentEl.createEl("h4", { text: "Priority Level (optional)" });
		const priorityEl = new DropdownComponent(contentEl);
		priorityEl.selectEl.style.width = "100%";
		priorityEl.addOption(ProjectPriority.High, "High");
		priorityEl.addOption(ProjectPriority.Medium, "Medium");
		priorityEl.addOption(ProjectPriority.Low, "Low");
		priorityEl.addOption(ProjectPriority.None, "None");
		priorityEl.setValue(ProjectPriority.Medium); // default selection

		contentEl.createEl("h4", { text: "Work Load (optional)" });
		const estimatedHoursEl = new TextComponent(contentEl);
		estimatedHoursEl.inputEl.style.width = "100%";
		estimatedHoursEl.setPlaceholder("Hours");

		const submitButton = contentEl.createEl("button", { text: "Create" });
		submitButton.style.marginTop = "10px";

		const submit = () => {
			const projectData: ProjectData = {
				id: "",
				name: inputEl.getValue().trim(),
				deadline: deadlineEl.getValue().trim(),
				priority: priorityEl.getValue() as ProjectPriority,
				workload: parseFloat(estimatedHoursEl.getValue().trim()) || 0,
				status: ProjectStatus.Open,
			};
			if (projectData.name) {
				this.callback(projectData);
				this.close();
			} else {
				new Notice(`Please enter a valid name.`);
			}
		};

		submitButton.addEventListener("click", submit);
		inputEl.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				submit();
			}
		});
	}
}

// SuggestModal for selecting a main project
export class SelectProjectModal extends SuggestModal<string> {
	projects: string[];
	callback: (mainProject: string) => void;

	constructor(
		app: App,
		projects: string[],
		callback: (mainProject: string) => void,
	) {
		super(app);
		this.projects = projects;
		this.callback = callback;
	}

	// Provide suggestions based on input
	getSuggestions(query: string): string[] {
		return this.projects.filter((proj) =>
			proj.toLowerCase().includes(query.toLowerCase()),
		);
	}

	// Render each suggestion in the list
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}

	// Handle user selection
	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.callback(item.trimStart().split(" ")[0]);
	}
}

// Modal for logging time
export class LogTimeModal extends Modal {
	private projects: string[];
	private callback: (timeSpent: string, description: string) => void;

	constructor(
		app: App,
		callback: (timeSpent: string, description: string) => void,
	) {
		super(app);
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Log Work Time" });

		const timeInput = new TextComponent(contentEl);
		timeInput.setPlaceholder("Time spent in hours");

		const descriptionInput = new TextComponent(contentEl);
		descriptionInput.setPlaceholder("Work description");

		const submitButton = contentEl.createEl("button", { text: "Log Time" });
		submitButton.style.marginTop = "10px";

		submitButton.addEventListener("click", () => {
			const timeSpent = timeInput.getValue().trim();
			const description = descriptionInput.getValue().trim();
			if (timeSpent) {
				this.callback(timeSpent, description);
				this.close();
			} else {
				new Notice("Please fill in required fields.");
			}
		});
	}
}
