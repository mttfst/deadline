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
		const projects = this.getProjectList();
		// Add settings tab to the Obsidian interface
		this.addSettingTab(new DeadlineSettingTab(this.app, this));

		// Register the new project command
		this.addCommand({
			id: 'new_project',
			name: 'Create New Project',
			callback: async () => {
				new ProjectModal(this.app, async (shortName: string) => {
					await this.createNewProject(shortName);
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
					new SubProjectNameModal(this.app, async (subProjectName) => {
						await this.createNewSubProject(mainProject, subProjectName);
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

		new Notice(`Found projects: ${projectFolders.length > 0 ? projectFolders.join(', ') : 'None'}`);
		return projectFolders;
	}

	// Function to create a new project
	async createNewProject(shortName: string) {
		const projectId = this.settings.nextProjectId.toString().padStart(3, '0');
		const folderName = `${projectId}-${shortName}`;
		const projectFolderPath = `${this.settings.projectPath}/${folderName}`;
		const projectFileName = `${shortName}.md`;
		const projectFilePath = `${projectFolderPath}/${projectFileName}`;

		try {
			// Create the project folder
			await this.app.vault.createFolder(projectFolderPath);

			// Load the project template from an external file
			const projectContent = projectTemplate
				.replace(/\{\{projectId\}\}/g, `'${projectId}'`)
				.replace(/\{\{projectName\}\}/g, shortName);

			// Create the new project file with the loaded template
			await this.app.vault.create(projectFilePath, projectContent);

			// Increment the project ID
			this.settings.nextProjectId++;
			await this.saveSettings();

			new Notice(`New project created: ${folderName}`);
		} catch (error) {
			console.error('Failed to create new project:', error);
			new Notice('Failed to create new project. Check console for details.');
		}
	}

		async createNewSubProject(mainProject: string, subProjectName: string) {
		const projectFolderPath = `${this.settings.projectPath}/${mainProject}`;
		const subProjectFileName = `${subProjectName}.md`;
		const subProjectFilePath = `${projectFolderPath}/${subProjectFileName}`;

		try {
			// Load the project template and add main project reference
			const subProjectContent = subprojectTemplate
				.replace('{{projectId}}', mainProject)
				.replace('{{subprojectName}}', subProjectName)
				.replace('{{mainName}}', `[${projectFolderPath}/${mainProject}]`)

			// Create the new subproject file
			await this.app.vault.create(subProjectFilePath, subProjectContent);

			new Notice(`New subproject created: ${subProjectName} under ${mainProject}`);
		} catch (error) {
			console.error('Failed to create new subproject:', error);
			new Notice('Failed to create new subproject. Check console for details.');
		}
	}
}

// Modal for entering project name
class ProjectModal extends Modal {
	callback: (shortName: string) => void;

	constructor(app: App, callback: (shortName: string) => void) {
		super(app);
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Enter Project Name' });

		// Create a wrapper div for styling
		const inputContainer = contentEl.createEl('div', { cls: 'project-input-container' });

		const inputEl = new TextComponent(inputContainer);
		inputEl.inputEl.style.width = '100%';
		inputEl.inputEl.placeholder = 'Project short name';

		// Create a button container for alignment
		const buttonContainer = contentEl.createEl('div', { cls: 'button-container' });

		const submitButton = buttonContainer.createEl('button', { text: 'Create' });
		submitButton.style.marginTop = '10px'; // Add spacing between input and button

    	const submitProject = () => {
			const shortName = inputEl.getValue().trim();
			if (shortName) {
				this.callback(shortName);
				this.close();
			} else {
				new Notice('Please enter a project name.');
			}
		};

		// Add event listeners
		submitButton.addEventListener('click', submitProject);
		inputEl.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				submitProject();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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

// Modal for entering the subproject name
class SubProjectNameModal extends Modal {
	callback: (subProjectName: string) => void;

	constructor(app: App, callback: (subProjectName: string) => void) {
		super(app);
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Enter Subproject Name' });

		const inputEl = new TextComponent(contentEl);
		inputEl.inputEl.style.width = '100%';
		inputEl.inputEl.placeholder = 'Subproject Name';

		const submitButton = contentEl.createEl('button', { text: 'Create' });
		submitButton.style.marginTop = '10px';

		const submitSubProject = () => {
			const subProjectName = inputEl.getValue().trim();
			if (subProjectName) {
				this.callback(subProjectName);
				this.close();
			} else {
				new Notice('Please enter a subproject name.');
			}
		};

		submitButton.addEventListener('click', submitSubProject);
		inputEl.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				submitSubProject();
			}
		});
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

