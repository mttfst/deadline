import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Modal, SuggestModal, TextComponent, DropdownComponent, EventRef} from 'obsidian';
// import * as fs from "fs";
import { promises as fs } from "fs";
import {projectTemplate, subprojectTemplate} from './templates';


// const FILE_PATH = "/Users/Faust/Project/deadline/projects.json";
const FILE_PATH = "/Users/Faust/Documents/Arbeit/Testvalut2/projects.json";

// const FILE_PATH = "./projects.json";


// 1. Define the interface for plugin settings
interface DeadlinePluginSettings {
	projectPath: string;
	workingHoursPerWeek: number;
	workingDaysPerWeek: number;
	priorityLevels: number;
	prioritySplit: number[];
	dirPrefix: string;
}

interface Timelog {
	date: string;
	time: number;
	info?: string;
}

interface ProjectData {
	id: string;
	name: string;
    path?: string;
	file?: string;
	deadline?: string;
	priority?: number;
	workload?: number;
	status: ProjectStatus;
}

interface Project {
	readonly id: string;
	name: string;
	path: string;
	file: string;
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
	dirPrefix: '{{id}}'
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

	public static async loadData(): Promise<{ projects: ProjectImpl[] }> {
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
			workload: p.workload ,
		}
		const project = new ProjectImpl(projectData);
		project.timelog = p.timelog || [];
		project.subprojects = p.subprojects.map(sub => this.restoreProject(sub));
		return project;
	}

	public static async saveData(data: { projects: Project[] }): Promise<void> {
		try {
			await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
		} catch (error) {
			console.error("Error saving data to file:", error);
		}
	}
}

class ProjectSync {
	private app: App;
	private cachedYamlData: Map<string, string> = new Map();

	constructor(app: App) {
		this.app = app;
	}

	async syncProjectFromYaml(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return;

		const updatedId = cache.frontmatter.id;

		const data = await JsonUtils.loadData();
		// console.log(data)
		// console.log(file.path)
		// const project = data.projects.find(p => file.path.includes(p.file));
		const project = this.findProjectByPath(data.projects, file.path);
		// console.log(project)


		if (!project) {
			// new Notice(`Projekt mit Datei ${file.path} nicht gefunden.`);
			return;
		}

		if (updatedId !== project.id) {
			new Notice(`ID-Änderung nicht erlaubt. Setze ID auf ${project.id} zurück.`);
			await this.restoreYamlId(file, project.id);
			return;
		}

		const updatedData: Partial<ProjectData> = {
			id: project.id, // Direkt aus JSON, nicht aus YAML!
			name: cache.frontmatter.name,
			deadline: cache.frontmatter.deadline,
			priority: cache.frontmatter.priority,
			workload: cache.frontmatter.workload,
			status: cache.frontmatter.status as ProjectStatus
		};

		const updated = this.updateProject(project, updatedData);

		if (updated) {
			await JsonUtils.saveData(data);
			new Notice(`Projekt "${project.name}" erfolgreich aktualisiert.`);
		}
	}

	async restoreYamlId(file: TFile, correctId: string) {
		let content = await this.app.vault.read(file);
		const newContent = content.replace(/^id: .*/m, `id: "${correctId}"`);
		await this.app.vault.modify(file, newContent);
	}

	async handleFileRename(file: TFile, oldPath: string) {
		const data = await JsonUtils.loadData();
		

		console.log(`handle raname for ${oldPath}`)
		const project = this.findProjectByPath(data.projects, oldPath);
		console.log(project)
		if (!project) {
			console.log(`Project with path "${oldPath}" not found`);
			return;
		}

		console.log(`hier wird jetzt die json überschieben ${project.file} wird zu ${file.path}`)

		project.file = file.path;
		project.path = file.parent?.path || "";

		await JsonUtils.saveData(data);
	}

	findProjectByPath(projects: Project[], path: string): Project | undefined {
		console.log(`find project by path, ${path}`)
		console.log(projects)
		for (const project of projects) {
			if (project.file === path) {
				return project;
			}
			if (project.subprojects.length > 0) {
				const subproject = this.findProjectByPath(project.subprojects, path);
				if (subproject) return subproject;
			}
		}
		return undefined;
	}

	// Optional: Beim Öffnen einer Datei den aktuellen YAML-Header cachen
	cacheYamlData(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.tags?.includes('deadline')) {
			this.cachedYamlData.set(file.path, JSON.stringify(cache.frontmatter));
		}
	}

	// Hilfsfunktion für die Übernahme von Werten aus updatedData
	updateProject(project: ProjectData, updatedData: Partial<ProjectData>): boolean {
		let updated = false;

		if (updatedData.name !== undefined && updatedData.name !== project.name) {
			project.name = updatedData.name;
			updated = true;
		}
		if (updatedData.deadline !== undefined && updatedData.deadline !== project.deadline) {
			project.deadline = updatedData.deadline;
			updated = true;
		}
		if (updatedData.priority !== undefined && updatedData.priority !== project.priority) {
			project.priority = updatedData.priority;
			updated = true;
		}
		if (updatedData.workload !== undefined && updatedData.workload !== project.workload) {
			project.workload = updatedData.workload;
			updated = true;
		}
		if (updatedData.status !== undefined && updatedData.status !== project.status) {
			project.status = updatedData.status;
			updated = true;
		}

		return updated;
	}


}

class ProjectImpl implements Project {
  readonly id: string;
  name: string;
  path: string;
  file: string;
  deadline?: string;
  priority?: number;
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
    this.priority = projectData.priority || 1;
    this.workload = projectData.workload || 0;
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

  // addSubproject(name: string, status: ProjectStatus): void {
  //   if (this.subprojects.length > 0) {
  //     throw new Error("Subprojekte dürfen keine eigenen Subprojekte haben!");
  //   }
  //   const subprojectId = `${this.id}-${this.subprojects.length + 1}`;
  //   const subproject = new ProjectImpl(subprojectId, name, status);
  //   this.subprojects.push(subproject);
  // }
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
        new NameInputModal(this.app, this.settings, async (projectData: ProjectData) => {
            await this.projectManager.createProject(projectData);
        }).open();
    }

    async promptNewSubProject() {
        const projects = await this.projectManager.getProjectList();
        if (projects.length === 0) {
            new Notice('No existing projects found.');
            return;
        }

        new SelectProjectModal(this.app, projects, async (mainProject) => {
			const mainProjectId = mainProject.split(" ")[0]
            new NameInputModal(this.app, this.settings, async (projectData:ProjectData) => {
                await this.projectManager.createProject(projectData, mainProjectId);
            }).open();
        }).open();
    }

    async promptLogTime() {
        const projects = await this.projectManager.getProjectList();
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
	settings: DeadlinePluginSettings;
	
    constructor(app: App, settingsUtils: SettingsUtils) {
        this.app = app;
        this.settingsUtils = settingsUtils;
		this.settings = this.settingsUtils.settings;
    }	
	
	// Get list of existing projects
	async getProjectList(): Promise<string[]> {
		const data = await JsonUtils.loadData();

		if (!data.projects || !Array.isArray(data.projects)) {
            new Notice('No projects found in JSON data.');
            return [];
		}

		const projectNames = data.projects.map((project: any) => `${project.id} ${project.name}`);
		return projectNames;
	}

   async newProjectID(mainProjectId?:string): Promise<string> {
	   const projectCount = await this.countProjects(mainProjectId ?? "")
	   let newID: string = (projectCount + 1).toString(); 
	   
	   if (mainProjectId) {
		   newID = `${mainProjectId}-${newID}`;
	   }

	   return newID;
   }

   async countProjects(projectId: string): Promise<number> {
	   const data = await JsonUtils.loadData();
	   let projectCount : number = 0

	   if (!projectId) {
		   projectCount = data.projects.length
	   }

	   const mainProject = data.projects.find((p: any) => p.id === projectId);
	   if (mainProject) {
		   projectCount = mainProject.subprojects.length
	   }

	   return projectCount
   }



    async createProject(projectData: ProjectData, mainProjectId?: string) {
        const projectId = await this.newProjectID(mainProjectId)
		projectData.id = projectId

		const projectPath = await this.createProjectFolder(projectData, mainProjectId)
		projectData.path = projectPath	

		const projectFile = await this.createProjectFile(projectData,mainProjectId)
		projectData.file = projectFile

		console.log(projectData)


		// New Main Project
		if (!mainProjectId) { 
			const data = await JsonUtils.loadData();
			const project = new ProjectImpl(projectData);
			data.projects.push(project);
			await JsonUtils.saveData(data)
		}
		
		// New Sub-Project
		if (mainProjectId) {
			const data = await JsonUtils.loadData();
			const mainProject = data.projects.find(p => p.id === mainProjectId);
			if (!mainProject) {
				console.log("Projekt nicht gefunden!");
				return;
			}
			mainProject.subprojects.push(new ProjectImpl(projectData));
			await JsonUtils.saveData(data)
		}


    }

	async createProjectFolder(projectData: ProjectData, mainProjectId?: string): Promise<string> {
		const prefix = this.settings.dirPrefix.replace('{{id}}', `${projectData.id}`) 
		let dirName = `${projectData.name}`

		if (prefix){
			dirName = `${prefix}-${projectData.name}`
		}

		let path = `${this.settings.projectPath}/${dirName}`

		if (mainProjectId) {
			const data = await JsonUtils.loadData();
			const mainProject = data.projects.find(p => p.id === mainProjectId);
			path = `${mainProject?.path}/${dirName}`
		}
	
		await this.app.vault.createFolder(path);

		return path
	}

	async createProjectFile(projectData: ProjectData, mainProjectId?: string) {
		const projectFile = `${projectData.path}/${projectData.id}-${projectData.name}.md`


		const yamlHeader = await this.makeYamlHeader(projectData, mainProjectId)
		

		const newFile = await this.app.vault.create(projectFile, yamlHeader);
		await this.app.workspace.getLeaf().openFile(newFile);


		return projectFile

	}

	async makeYamlHeader(projectData: ProjectData, mainProjectId?: string): Promise<string> {

	
		let mainFile = "" 

		if (mainProjectId) {
			const data = await JsonUtils.loadData();
			const mainProject = data.projects.find(p => p.id === mainProjectId);
			mainFile = mainProject?.file || ""
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
			"---"
		].filter(Boolean); 

		return lines.join("\n"); 
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
	settings: DeadlinePluginSettings;
	jsonUtils: JsonUtils;

	private projectSync: ProjectSync;


	private renameHandler: EventRef;
	private modifyHandler: EventRef;
	private queue = Promise.resolve();



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
		this.projectSync = new ProjectSync(this.app);



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

		this.app.workspace.on('file-open', (file) => {
			if (file instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.tags?.includes('deadline')) {
					this.projectSync.cacheYamlData(file);
				}
			}
		});

		this.modifyHandler = this.app.metadataCache.on('changed', async (file) => {
			if (file instanceof TFile) {
				console.log(`modify file ${file}`)
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.tags?.includes('deadline')) {
					console.log(`modify deadlinefile ${file}`)
					await this.projectSync.syncProjectFromYaml(file);
				}
			}
		});


		this.renameHandler = this.app.vault.on('rename', async (file, oldPath) => {
			if (file instanceof TFile) {
				console.log(`rename folder of file ${file.path}`)
				// console.log(file)
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.tags?.includes('deadline')) {
					this.queue = this.queue.then(async () => {
						console.log(`Starte Verarbeitung für ${file.path}`);
						await this.projectSync.handleFileRename(file, oldPath);
						console.log(`Verarbeitung abgeschlossen für ${file.path}`);
					}).catch(err => {
						console.error(`Fehler bei der Verarbeitung von ${file.path}:`, err);
					})
				;}
			}
		});

	;}
		onunload() {
			console.log('Unloading Deadline Plugin...');

			this.app.vault.offref(this.renameHandler);
			this.app.metadataCache.offref(this.modifyHandler);
		}
}


// Modal for entering project name
class NameInputModal extends Modal {
	private settings: DeadlinePluginSettings;
	// private callback: (name: string, deadline: string, priority: string, estimatedHours: string) => void;
	private callback: (projectData: ProjectData) => void;

	constructor(app: App, 
				settings: DeadlinePluginSettings, 
				callback: (projectData: ProjectData) => void) {
		super(app);
		this.settings = settings;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Create New Project' });

		contentEl.createEl('h3', { text: 'Project Title' });
		const inputEl = new TextComponent(contentEl);
		inputEl.inputEl.style.width = '100%';
		inputEl.inputEl.placeholder = 'Project Name';

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
			const projectData: ProjectData = {
				id : "",
				name : inputEl.getValue().trim(),
			    deadline : deadlineEl.getValue().trim(),
			    priority : parseInt(priorityEl.getValue()) || 1,
			    workload : parseFloat(estimatedHoursEl.getValue().trim()) || 0,
				status: ProjectStatus.Open,
			}
			if (projectData.name) {
				this.callback(projectData);
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

