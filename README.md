# Obsidian Deadline Plugin

## Overview
**Deadline** is an Obsidian plugin designed to help organize and visualize projects and their deadlines in the context of actual available working hours. It balances priorities and deadlines to provide a clear overview of what requires immediate attention.

---

## Settings (Defaults):
- **`project_path`**: `./Projects`  
  *Path to the directory where projects are stored.*

- **`working_hours_per_week`**: `40`  
  *Total available working hours per week.*

- **`working_days_per_week`**: `5`  
  *Number of working days per week.*

- **`priority_levels`**: `3`  
  *Number of priority levels for projects.*

- **`priority_split`**: `[50, 35, 15]`  
  *Percentage of available time allocated to each priority level.*

---

## Commands:

1. **`new_project`**  
   - Creates a new project with a unique `project_id`.  
   - A new directory named after the `project_id` is created in `project_path`.  
   - A `New_Project.md` file is generated in the project directory using the **`project_template`**.

2. **`new_subproject`**  
   - Creates a new subproject within an existing project directory.  
   - A new Markdown file `<Subproject_Name>.md` is created.  
   - The subproject template includes a link to the main project (`main_project`).

3. **`log_time`**  
   - Allows users to select a project or subproject and log time spent in hours (`h`) or minutes (`min`).  
   - Time is logged in a **`time_log.md`** file within the respective project/subproject directory.  
   - The **Progress** section in the main project/subproject file is automatically updated:
     - **Time Spent:** Sum of entries from `time_log.md`.
     - **Time Remaining:** Difference between estimated and logged work time.

---

## Core Logic (Workload Distribution):

1. **Weekly Work Time Distribution by Priority:**  
   - Weekly working hours are distributed based on `priority_split`.

2. **Equal Time Distribution Among Projects of the Same Priority:**  
   - Projects on the same priority level share the allocated time equally.

3. **Calculation of Required Working Days:**  
   - **Remaining Work Time** = `estimated_work_time - time_logged`
   - **Weeks Needed** = `Remaining Work Time / allocated_weekly_hours`
   - **Required Working Days** = `Weeks Needed * working_days_per_week`

4. **Considering Available Working Days Until Deadline:**  
   - **Available Days** = Number of remaining **working days** (accounting for `working_days_per_week`).
   - **Urgency Evaluation:**  
     - If `Required Working Days > Available Days` → **URGENT**  
     - If `Required Working Days <= Available Days` → **On Track**

---

## Templates:

### `project_template` Structure:

**YAML Header:**  
```yaml
---
id: <project_id>
name: <project_name>
deadline: <YYYY-MM-DD>
priority_level: <1 | 2 | 3>
estimated_work_time: <hours>
status: <open | in_progress | completed>
---
```

**Markdown Content:**  
```markdown
# <Project Name>

## Project Description
*Placeholder for the project description.*

---

## Time Management
- **Deadline:** <YYYY-MM-DD>
- **Estimated Work Time:** <hours> hours
- **Priority Level:** <1 | 2 | 3>
- **Available Work Time (based on schedule):** <calculated>

---

## Progress
- **Status:** <open | in_progress | completed>
- **Time Spent:** <sum of time_log.md> hours
- **Time Remaining:** <estimated_work_time - time_spent> hours
```

---

### `subproject_template` Structure:

**YAML Header:**  
```yaml
---
id: <subproject_id>
name: <subproject_name>
main_project: <main_project_id>
deadline: <YYYY-MM-DD>
priority_level: <1 | 2 | 3>
estimated_work_time: <hours>
status: <open | in_progress | completed>
---
```

**Markdown Content:**  
```markdown
# <Subproject Name>

## Subproject Description
*Placeholder for the subproject description.*

---

## Time Management
- **Linked to Main Project:** <main_project_name>
- **Deadline:** <YYYY-MM-DD>
- **Estimated Work Time:** <hours> hours
- **Priority Level:** <1 | 2 | 3>
- **Available Work Time (based on schedule):** <calculated>

---

## Progress
- **Status:** <open | in_progress | completed>
- **Time Spent:** <sum of time_log.md> hours
- **Time Remaining:** <estimated_work_time - time_spent> hours
```

---

### `time_log.md` Structure:

```markdown
# Time Log for <Project/Subproject Name>

| Date       | Time Spent (h) | Description          |
|------------|----------------|----------------------|
| 2024-02-04 | 2              | Initial research     |
| 2024-02-05 | 1.5            | Drafted first version|
```

---

## Dashboard (First Version):

| Project Name    | Priority | Deadline   | Remaining Work (h) | Time Allocated/Week (h) | Needed Days | Days Until Deadline | Status   |
|-----------------|----------|------------|--------------------|-------------------------|-------------|---------------------|----------|
| Project Alpha   | 1        | 2024-02-10 | 10                 | 5                       | 5           | 4                   | 🔴 Overdue |
| Project Beta    | 2        | 2024-03-01 | 14                 | 7                       | 5           | 20                  | 🟢 On Track |
| Project Gamma   | 3        | 2024-02-15 | 4                  | 2                       | 2           | 8                   | 🟡 Tight |

---

## Future Features (Planned):

1. **Dynamic Priority Adjustment:**  
   Automatically shifts focus to urgent projects as deadlines approach.

2. **Daily Task List:**  
   Generates a list of the most urgent tasks for each day.

3. **Warning System & Notifications:**  
   Alerts when projects risk missing deadlines.

4. **Planned Days Off (Vacations/Business Trips):**  
   - Ability to define **planned days off** in settings (e.g., vacations, business trips).
   - These are considered in the calculation of available working days.

   **Example in YAML:**  
   ```yaml
   planned_days_off:
     - 2024-02-12  # Vacation
     - 2024-02-14  # Business Trip
   ```

5. **Global `master_log.md`:**  
   Central log file summarizing time entries across all projects for a comprehensive overview.

---

## Feature Checklist

### Core Features
- [ ] **settings and defaults**

- [ ] **Command Implementation**  
  - [ ] `new_project`: Create new project directories and initialize templates.  
  - [ ] `new_subproject`: Create subprojects linked to main projects.  
  - [ ] `log_time`: Log time entries and update project progress.

- [ ] **Template System**  
  - [ ] Project Template with YAML header and structure.  
  - [ ] Subproject Template with main project linkage.

- [ ] **Time Logging & Progress Updates**  
  - [ ] Generate `time_log.md` for each project/subproject.  
  - [ ] Automatically update progress based on logged time.

- [ ] **Workload Distribution Logic**  
  - [ ] Distribute weekly working hours based on priority splits.  
  - [ ] Equal time allocation for projects with the same priority.

- [ ] **Urgency Evaluation**  
  - [ ] Calculate required working days for project completion.  
  - [ ] Compare with available working days until deadlines.

- [ ] **Dashboard Display**  
  - [ ] Visualize project status, deadlines, and time allocations.

### Future Features (Planned)
- [ ] **Dynamic Priority Adjustment**  
- [ ] **Daily Task List Generation**  
- [ ] **Warning System & Notifications**  
- [ ] **Planned Days Off (Vacations/Business Trips)**  
- [ ] **Global `master_log.md` for Time Tracking Across Projects**  

---

## License
[LICENSE](LICENSE)


