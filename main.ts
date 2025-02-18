import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Modal, SuggestModal, TextComponent, DropdownComponent} from 'obsidian';
import { promises as fs } from "fs";
import {projectTemplate, subprojectTemplate} from './templates';


const FILE_PATH = "./projects.json";


// 1. Define the interface for plugin settings
interface DeadlinePluginSettings {
	projectPath: string;
	workingHoursPerWeek: number;
	workingDaysPerWeek: number;
	priorityLevels: number;
	prioritySplit: number[];
	nextProjectId: number;
}

interface Timelog {
	date: string;
	time: number;
	info?: string;
}

interface Project {
  readonly id: string;
  name: string;
  deadline?: string;
  priority?: number;
  workload?: number;
  status: ProjectStatus;
  timelog: Timelog[];
  subprojects: Project[];

  totalTime(): number;
}

enum ProjectStatus {
  Open = "open",
  InProgress = "in_progress",
  Done = "done"
}

// 2. Default values for the settings
const DEFAULT_SETTINGS: DeadlinePluginSettings = {
	projectPath: 'Projects',
	workingHoursPerWeek: 40,
	workingDaysPerWeek: 5,
	priorityLevels: 3,
	prioritySplit: [50, 35, 15],
	nextProjectId: 1
};

class SettingsUtils {
	private plugin: Plugin;
    settings: DeadlinePluginSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
		await this.checkSettings();
    }

	async checkSettings() {
        if (this.settings.projectPath.startsWith('./')) {
            this.settings.projectPath = this.settings.projectPath.replace(/^\.\//, '');
            await this.saveSettings();
		}
	}

    async saveSettings() {
        await this.plugin.saveData(this.settings);
    }
}


class JsonUtils {
	projectManager: ProjectManager;
	settingsUtils: SettingsUtils;
	settings: DeadlinePluginSettings;

	constructor(projectManager: ProjectManager, settingsUtils: SettingsUtils) {
		this.projectManager = projectManager;
		this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings;
	}

async loadData(): Promise<{ projects: ProjectImpl[] }> {
		try {
			// Check if the file exists, otherwise create an empty one
			try {
				await fs.access(FILE_PATH, fs.constants.F_OK);
			} catch {
				await fs.writeFile(FILE_PATH, JSON.stringify({ projects: [] }, null, 2), "utf8");
			}

			// Read and parse the JSON file
			const dataStr = await fs.readFile(FILE_PATH, "utf8");
			const data = JSON.parse(dataStr);

			// Convert JSON objects into ProjectImpl instances
			data.projects = data.projects.map((p: Project) => this.restoreProject(p));

			return data;
		} catch (error) {
			console.error("Error loading data from file:", error);
			return { projects: [] };
		}
	}
	//  Helper function: Converts a JSON object into a `ProjectImpl` instance
	private restoreProject(p: Project): ProjectImpl {
		const project = new ProjectImpl(p.id, p.name, p.status, p.deadline, p.priority, p.workload);
		project.timelog = p.timelog || [];
		project.subprojects = p.subprojects.map(sub => this.restoreProject(sub));
		return project;
	}

	async saveData(data: { projects: Project[] }): Promise<void> {
		try {
			await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
		} catch (error) {
			console.error("Error saving data to file:", error);
		}
	}
}

class ProjectImpl implements Project {
  readonly id: string;
  name: string;
  deadline?: string;
  prio?: number;
  workload?: number;
  status: ProjectStatus;
  timelog: Timelog[];
  subprojects: Project[];

  constructor(id: string, name: string, status: ProjectStatus, deadline?: string, prio?: number, workload?: number) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.deadline = deadline;
    this.prio = prio;
    this.workload = workload;
    this.timelog = [];
    this.subprojects = [];
  }

  totalTime(): number {
    const ownTime = this.timelog.reduce((sum, log) => sum + log.time, 0);
    const subprojectTime = this.subprojects.reduce((sum, sub) => sum + sub.totalTime(), 0);
    return ownTime + subprojectTime;
  }

  addTimelog(date: string, time: number, info?: string): void {
    this.timelog.push({ date, time, info });
  }

  addSubproject(name: string, status: ProjectStatus): void {
    if (this.subprojects.length > 0) {
      throw new Error("Subprojekte dürfen keine eigenen Subprojekte haben!");
    }
    const subprojectId = `${this.id}-${this.subprojects.length + 1}`;
    const subproject = new ProjectImpl(subprojectId, name, status);
    this.subprojects.push(subproject);
  }
}

class UIManager {
    private app: App;
	private settingsUtils: SettingsUtils;
    private projectManager: ProjectManager;
	private settings: DeadlinePluginSettings;

    constructor(app: App, settingsUtils: SettingsUtils, projectManager: ProjectManager) {
        this.app = app;
        this.projectManager = projectManager;
		this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings
    }

    promptNewProject() {
        new NameInputModal(this.app, this.settings, 'Enter Project Details', 'Project short name', async (shortName: string, deadline: string, priority: string, estimatedHours: string) => {
            await this.projectManager.createProject(shortName, deadline, priority, estimatedHours);
        }).open();
    }

    promptNewSubProject() {
        const projects = this.projectManager.getProjectList();
        if (projects.length === 0) {
            new Notice('No existing projects found.');
            return;
        }

        new SelectProjectModal(this.app, projects, async (mainProject) => {
            new NameInputModal(this.app, this.settings, 'Enter Subproject Details', 'Subproject name', async (subProjectName: string, deadline: string, priority: string, estimatedHours: string) => {
                await this.projectManager.createProject(subProjectName, deadline, priority, estimatedHours);
            }).open();
        }).open();
    }

    promptLogTime() {
        const projects = this.projectManager.getProjectList();
        if (projects.length === 0) {
            new Notice('No existing projects found.');
            return;
        }

        new LogTimeModal(this.app, projects, async (selectedProject, subProject, timeSpent, description) => {
            // Implement logTime logic separately
        }).open();
    }
}

class ProjectManager {
    app: App;
    settingsUtils: SettingsUtils;
	settings: DeadlinePluginSettings

    constructor(app: App, settingsUtils: SettingsUtils) {
        this.app = app;
        this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings
    }	
	
	// Get list of existing projects
	getProjectList(): string[] {
		const projectFolder = this.app.vault.getFolderByPath(this.settings.projectPath);
		
		if (!projectFolder) {
			new Notice('No project folder found.');
			return [];
		}

		const projectFolders = projectFolder.children
			.filter(item => item instanceof TFolder)
			.map(folder => folder.name);

		return projectFolders;
	}


    async createProject(shortName: string, deadline: string, priority: string, estimatedHours: string) {
        const projectId = this.settings.nextProjectId.toString().padStart(3, '0');
        const folderName = `${shortName}`;
        const projectFolderPath = `${this.settings.projectPath}/${folderName}`;
        const projectFileName = `main_${shortName}.md`;
        const projectFilePath = `${projectFolderPath}/${projectFileName}`;
        // const parsedPriority = this.validatePriority(priority);
        // const parsedHours = this.validateHours(estimatedHours);

        try {
            await this.app.vault.createFolder(projectFolderPath);
            const projectContent = projectTemplate
                .replace(/\{\{projectId\}\}/g, `'${projectId}'`)
                .replace(/\{\{projectName\}\}/g, shortName)
                .replace("{{deadline}}", deadline || "")
                // .replace("{{priority}}", parsedPriority.toString())
                // .replace("{{estimatedHours}}", parsedHours.toFixed(1));

            const newFile = await this.app.vault.create(projectFilePath, projectContent);
            await this.app.workspace.getLeaf().openFile(newFile);


            new Notice(`New project created: ${folderName}`);
        } catch (error) {
            console.error('Failed to create new project:', error);
            new Notice(`Failed to create new project. ${error.message}`);
        }
    }



// Function to update the main project note with subproject links
	async updateMainProjectList(mainProject: string) {
		const projectFolderPath = `${this.settings.projectPath}/${mainProject}`;
		const projectFilePath = `${projectFolderPath}/main_${mainProject}.md`;
		const subProjectFiles = (await this.app.vault.adapter.list(projectFolderPath)).files;
		const subProjects = subProjectFiles.filter(file => file.includes('/sub_')).map(file => `- [[${file.split('/').pop()}]]`);

		try {
			let mainProjectFile = await this.app.vault.read(await this.app.vault.getAbstractFileByPath(projectFilePath) as TFile);
			const subProjectSection = `## Subprojects
${subProjects.join('\n')}`;

			if (mainProjectFile.includes('## Subprojects')) {
				mainProjectFile = mainProjectFile.replace(/## Subprojects[\s\S]*?(?=\n##|$)/, subProjectSection);
			} else {
				mainProjectFile += `\n\n${subProjectSection}`;
			}

			await this.app.vault.modify(await this.app.vault.getAbstractFileByPath(projectFilePath) as TFile, mainProjectFile);
		} catch (error) {
			console.error('Failed to update main project note:', error);
			new Notice('Failed to update main project note. Check console for details.');
		}
	}


// 3. Main plugin class
export default class DeadlinePlugin extends Plugin {
	settingsUtils: SettingsUtils
    projectManager: ProjectManager;
    uiManager: UIManager;
	settings: DeadlinePluginSettings

	// Plugin initialization
	async onload() {
		console.log('Loading Deadline Plugin...');
		this.settingsUtils = new SettingsUtils(this);
        await this.settingsUtils.loadSettings();
		this.settings = this.settingsUtils.settings
		
		// Add settings tab to the Obsidian interface
		this.addSettingTab(new DeadlineSettingTab(this.app, this));


        this.projectManager = new ProjectManager(this.app, this.settingsUtils);
        this.uiManager = new UIManager(this.app, this.settingsUtils, this.projectManager);



		this.addCommand({
            id: 'new_project',
            name: 'Create New Project',
            callback: async () => this.uiManager.promptNewProject()
        });

        this.addCommand({
            id: 'new_subproject',
            name: 'Create New Subproject',
            callback: async () => this.uiManager.promptNewSubProject()
        });

        this.addCommand({
            id: 'log_time',
            name: 'Log Work Time',
            callback: async () => this.uiManager.promptLogTime()
        });
	}
}


// Modal for entering project name
class NameInputModal extends Modal {
	private title: string;
	private placeholder: string;
	private settings: DeadlinePluginSettings;
	private callback: (name: string, deadline: string, priority: string, estimatedHours: string) => void;

	constructor(app: App, 
				settings: DeadlinePluginSettings, 
				title: string, 
				placeholder: string, 
				callback: (name: string, 
						   deadline: string, 
						   priority: string, 
						   estimatedHours: string) => void) {
		super(app);
		this.settings = settings;
		this.title = title;
		this.placeholder = placeholder;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.title });

		contentEl.createEl('h3', { text: 'Project Title' });
		const inputEl = new TextComponent(contentEl);
		inputEl.inputEl.style.width = '100%';
		inputEl.inputEl.placeholder = this.placeholder;

		contentEl.createEl('h4', { text: 'Deadline (optional)' });
		const deadlineEl = new TextComponent(contentEl);
        deadlineEl.inputEl.type = "date";  
        deadlineEl.inputEl.style.width = '100%';

		contentEl.createEl('h4', { text: 'Priority Level (optional)' });
		const priorityEl = new TextComponent(contentEl);
		priorityEl.inputEl.style.width = '100%';
		priorityEl.setPlaceholder(`1 - High, ${this.settings.priorityLevels.toString()} - Low`);

		contentEl.createEl('h4', { text: 'Work Load (optional)' });
		const estimatedHoursEl = new TextComponent(contentEl);
		estimatedHoursEl.inputEl.style.width = '100%';
		estimatedHoursEl.setPlaceholder('Hours');

		const submitButton = contentEl.createEl('button', { text: 'Create' });
		submitButton.style.marginTop = '10px';

		const submit = () => {
			const name = inputEl.getValue().trim();
			const deadline = deadlineEl.getValue().trim();
			const priority = priorityEl.getValue();
			const estimatedHours = estimatedHoursEl.getValue().trim();
			if (name) {
				this.callback(name, deadline, priority, estimatedHours);
				this.close();
			} else {
				new Notice(`Please enter a valid name.`);
			}
		};

		submitButton.addEventListener('click', submit);
		inputEl.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				submit();
			}
		});
	}
}

// SuggestModal for selecting a main project
class SelectProjectModal extends SuggestModal<string> {
	projects: string[];
	callback: (mainProject: string) => void;

	constructor(app: App, projects: string[], callback: (mainProject: string) => void) {
		super(app);
		this.projects = projects;
		this.callback = callback;
	}

	// Provide suggestions based on input
	getSuggestions(query: string): string[] {
		return this.projects.filter(proj => proj.toLowerCase().includes(query.toLowerCase()));
	}

	// Render each suggestion in the list
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}

	// Handle user selection
	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.callback(item);
	}
}

// Modal for logging time
class LogTimeModal extends Modal {
	private projects: string[];
	private callback: (project: string, subProject: string, timeSpent: string, description: string) => void;

	constructor(app: App, projects: string[], callback: (project: string, subProject: string, timeSpent: string, description: string) => void) {
		super(app);
		this.projects = projects;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Log Work Time' });

		const projectDropdown = new DropdownComponent(contentEl);
		this.projects.forEach(p => projectDropdown.addOption(p, p));

		const subProjectInput = new TextComponent(contentEl);
		subProjectInput.setPlaceholder('Subproject (optional)');

		const timeInput = new TextComponent(contentEl);
		timeInput.setPlaceholder('Time spent in hours');

		const descriptionInput = new TextComponent(contentEl);
		descriptionInput.setPlaceholder('Work description');

		const submitButton = contentEl.createEl('button', { text: 'Log Time' });
		submitButton.style.marginTop = '10px';

		submitButton.addEventListener('click', () => {
			const project = projectDropdown.getValue();
			const subProject = subProjectInput.getValue().trim();
			const timeSpent = timeInput.getValue().trim();
			const description = descriptionInput.getValue().trim();
			if (project && timeSpent) {
				this.callback(project, subProject, timeSpent, description);
				this.close();
			} else {
				new Notice('Please fill in required fields.');
			}
		});
	}
}

// 4. Define the settings tab
class DeadlineSettingTab extends PluginSettingTab {
	plugin: DeadlinePlugin;
	settings: DeadlinePluginSettings

	constructor(app: App, plugin: DeadlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = this.plugin.settingsUtils.settings
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty(); // Clear the container to load new settings
		containerEl.createEl('h2', { text: 'Deadline Plugin Settings' });

		// 5. Input fields for the settings

		// Project Path
		new Setting(containerEl)
			.setName('Project Path')
			.setDesc('Directory where your projects will be stored.')
			.addText(text => text
				.setPlaceholder('./Projects')
				.setValue(this.settings.projectPath)
				.onChange(async (value) => {
					this.settings.projectPath = value;
					await this.plugin.settingsUtils.saveSettings();
				}));

		// Working Hours Per Week
		new Setting(containerEl)
			.setName('Working Hours Per Week')
			.setDesc('Total working hours available each week.')
			.addText(text => text
				.setPlaceholder('40')
				.setValue(this.settings.workingHoursPerWeek.toString())
				.onChange(async (value) => {
					this.settings.workingHoursPerWeek = parseInt(value);
					await this.plugin.settingsUtils.saveSettings();
				}));

		// Working Days Per Week
		new Setting(containerEl)
			.setName('Working Days Per Week')
			.setDesc('Number of working days in a week.')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.settings.workingDaysPerWeek.toString())
				.onChange(async (value) => {
					this.settings.workingDaysPerWeek = parseInt(value);
					await this.plugin.settingsUtils.saveSettings();
				}));

		// Priority Levels
		new Setting(containerEl)
			.setName('Priority Levels')
			.setDesc('Number of priority levels for your projects.')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(this.settings.priorityLevels.toString())
				.onChange(async (value) => {
					this.settings.priorityLevels = parseInt(value);
					await this.plugin.settingsUtils.saveSettings();
				}));

		// Priority Split
		new Setting(containerEl)
			.setName('Priority Split')
			.setDesc('Percentage of time allocated to each priority level (e.g., 50,35,15).')
			.addText(text => text
				.setPlaceholder('50,35,15')
				.setValue(this.settings.prioritySplit.join(','))
				.onChange(async (value) => {
					this.settings.prioritySplit = value.split(',').map(Number);
					await this.plugin.settingsUtils.saveSettings();
				}));
	}
}

