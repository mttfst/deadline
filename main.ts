import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Modal, SuggestModal, TextComponent} from 'obsidian';
import {projectTemplate, subprojectTemplate} from './templates';

// 1. Define the interface for plugin settings
interface DeadlinePluginSettings {
	projectPath: string;
	workingHoursPerWeek: number;
	workingDaysPerWeek: number;
	priorityLevels: number;
	prioritySplit: number[];
	nextProjectId: number;
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

// 3. Main plugin class
export default class DeadlinePlugin extends Plugin {
	settings: DeadlinePluginSettings;

	// Plugin initialization
	async onload() {
		console.log('Loading Deadline Plugin...');
		
		// Load saved settings or use default values
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Ensure project path is formatted correctly
		if (this.settings.projectPath.startsWith('./')) {
			this.settings.projectPath = this.settings.projectPath.replace(/^\.\//, '');
			await this.saveSettings();
		}

		// Add settings tab to the Obsidian interface
		this.addSettingTab(new DeadlineSettingTab(this.app, this));

		// Register the new project command
		this.addCommand({
			id: 'new_project',
			name: 'Create New Project',
			callback: async () => {
		        // new NameInputModal(this.app, 'Enter Project Name', 'Project short name', async (shortName: string) => {
					// await this.createNewProject(shortName);
				new NameInputModal(this.app, this.settings, 'Enter Project Details', 'Project short name', async (shortName: string, deadline: string, priority: string, estimatedHours: string) => {
					await this.createNewProject(shortName, deadline, priority, estimatedHours);
				}).open();
			}
		});

	// Register the new subproject command
		this.addCommand({
			id: 'new_subproject',
			name: 'Create New Subproject',
			callback: async () => {
				const projects = this.getProjectList();
				if (projects.length === 0) {
					new Notice('No existing projects found.');
					return;
				}
				new SelectProjectModal(this.app, projects, async (mainProject) => {
					new NameInputModal(this.app, this.settings, 'Enter Subproject Details', 'Subproject name', async (subProjectName: string, deadline: string, priority: string, estimatedHours: string) => {
						await this.createNewSubProject(mainProject, subProjectName, deadline, priority, estimatedHours);
					}).open();
				}).open();
			}
		});
	}

	// Save the current settings
	async saveSettings() {
		await this.saveData(this.settings);
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

	// Function to create a new project
	async createNewProject(shortName: string, deadline: string, priority: string, estimatedHours: string) {
		const projectId = this.settings.nextProjectId.toString().padStart(3, '0');
		const folderName = `${shortName}`;
		const projectFolderPath = `${this.settings.projectPath}/${folderName}`;
		const projectFileName = `main_${shortName}.md`;
		const projectFilePath = `${projectFolderPath}/${projectFileName}`;
		const parsedPriority = parseInt(priority, 10);
		const parsedHours = parseFloat(estimatedHours);

		console.log('name ',shortName)
		console.log('deadline ',deadline)
		console.log('priority ',priority)
		console.log('estimatedHours ',estimatedHours)

		try {
			// Create the project folder
			await this.app.vault.createFolder(projectFolderPath);

			// Load the project template from an external file
			const projectContent = projectTemplate
				.replace(/\{\{projectId\}\}/g, `'${projectId}'`)
				.replace(/\{\{projectName\}\}/g, shortName)
				.replace("{{deadline}}", deadline !== "" ? deadline : "")
				.replace("{{priority}}", (!isNaN(parsedPriority) && parsedPriority >= 1 && parsedPriority <= this.settings.priorityLevels) ? parsedPriority.toString() : "1")
				.replace("{{estimatedHours}}", (!isNaN(parsedHours) && parsedHours >= 0) ? parsedHours.toFixed(1) : "0");

			// Create the new project file with the loaded template
			const newFile = await this.app.vault.create(projectFilePath, projectContent);
			await this.app.workspace.getLeaf().openFile(newFile);

			// Increment the project ID
			this.settings.nextProjectId++;
			await this.saveSettings();

			new Notice(`New project created: ${folderName}`);
		} catch (error) {
			console.error('Failed to create new project:', error);
			new Notice(`Failed to create new project. ${error.message}`);
		}
	}

	async createNewSubProject(mainProject: string, subProjectName: string, deadline: string, priority: string, estimatedHours: string) {
		const projectFolderPath = `${this.settings.projectPath}/${mainProject}`;
		const subProjectFiles = (await this.app.vault.adapter.list(projectFolderPath)).files;
		const subProjectCount = subProjectFiles.filter(file => file.startsWith(`${projectFolderPath}/sub_`)).length;
		const subProjectId = `${this.settings.nextProjectId.toString().padStart(3, '0')}_${(subProjectCount + 1).toString().padStart(2, '0')}`;
		const subProjectFileName = `sub_${subProjectName}.md`;
		const subProjectFilePath = `${projectFolderPath}/${subProjectFileName}`;
		const parsedPriority = parseInt(priority, 10);
		const parsedHours = parseFloat(estimatedHours);

		try {
			// Load the project template and add main project reference
			const subProjectContent = subprojectTemplate
				.replace('{{subprojectId}}', subProjectId)
				.replace('{{subprojectName}}', subProjectName)
				.replace('{{mainName}}', `main_${mainProject}`)
				.replace("{{deadline}}", deadline !== "" ? deadline : "")
				.replace("{{priority}}", (!isNaN(parsedPriority) && parsedPriority >= 1 && parsedPriority <= this.settings.priorityLevels) ? parsedPriority.toString() : "1")
				.replace("{{estimatedHours}}", (!isNaN(parsedHours) && parsedHours >= 0) ? parsedHours.toFixed(1) : "0");

			// Create the new subproject file
			const newFile = await this.app.vault.create(subProjectFilePath, subProjectContent);
			await this.updateMainProjectList(mainProject);
			await this.app.workspace.getLeaf().openFile(newFile);


			new Notice(`New subproject created: ${subProjectName} under ${mainProject}`);
		} catch (error) {
			console.error('Failed to create new subproject:', error);
			new Notice(`Failed to create new subproject. ${error.message}`);
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
}


// Modal for entering project name
class NameInputModal extends Modal {
	private title: string;
	private placeholder: string;
	private settings: DeadlinePluginSettings;
	private callback: (name: string, deadline: string, priority: string, estimatedHours: string) => void;

	constructor(app: App, settings: DeadlinePluginSettings, title: string, placeholder: string, callback: (name: string, deadline: string, priority: string, estimatedHours: string) => void) {
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


// 4. Define the settings tab
class DeadlineSettingTab extends PluginSettingTab {
	plugin: DeadlinePlugin;

	constructor(app: App, plugin: DeadlinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
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
				.setValue(this.plugin.settings.projectPath)
				.onChange(async (value) => {
					this.plugin.settings.projectPath = value;
					await this.plugin.saveSettings();
				}));

		// Working Hours Per Week
		new Setting(containerEl)
			.setName('Working Hours Per Week')
			.setDesc('Total working hours available each week.')
			.addText(text => text
				.setPlaceholder('40')
				.setValue(this.plugin.settings.workingHoursPerWeek.toString())
				.onChange(async (value) => {
					this.plugin.settings.workingHoursPerWeek = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Working Days Per Week
		new Setting(containerEl)
			.setName('Working Days Per Week')
			.setDesc('Number of working days in a week.')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.workingDaysPerWeek.toString())
				.onChange(async (value) => {
					this.plugin.settings.workingDaysPerWeek = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Priority Levels
		new Setting(containerEl)
			.setName('Priority Levels')
			.setDesc('Number of priority levels for your projects.')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(this.plugin.settings.priorityLevels.toString())
				.onChange(async (value) => {
					this.plugin.settings.priorityLevels = parseInt(value);
					await this.plugin.saveSettings();
				}));

		// Priority Split
		new Setting(containerEl)
			.setName('Priority Split')
			.setDesc('Percentage of time allocated to each priority level (e.g., 50,35,15).')
			.addText(text => text
				.setPlaceholder('50,35,15')
				.setValue(this.plugin.settings.prioritySplit.join(','))
				.onChange(async (value) => {
					this.plugin.settings.prioritySplit = value.split(',').map(Number);
					await this.plugin.saveSettings();
				}));
	}
}

