export const projectTemplate = `---
 id: {{projectId}}
 name: {{projectName}}
 deadline: {{deadline}} 
 priority_level: {{priority}}
 estimated_work_time: {{estimatedHours}}
 status: open
---

# {{projectName}}

## Project Description
*Placeholder for the project description.*


---

## Time Management
- **Deadline:** 
- **Estimated Work Time:** 0 hours
- **Priority Level:** 1
- **Available Work Time (based on schedule):**

---

## Progress
- **Status:** open
- **Time Spent:** 0 hours
- **Time Remaining:** 0 hours
`;

export const subprojectTemplate = `---
 id: {{subprojectId}}
 name: {{subprojectName}}
 main: "[[{{mainName}}]]"
 deadline: {{deadline}} 
 priority_level: {{priority}}
 estimated_work_time: {{estimatedHours}}
 status: open
---

# {{subprojectName}}

## sub Project Description
*Placeholder for the project description.*


---

## Time Management
- **Deadline:** 
- **Estimated Work Time:** 0 hours
- **Priority Level:** 1
- **Available Work Time (based on schedule):**

---

## Progress
- **Status:** open
- **Time Spent:** 0 hours
- **Time Remaining:** 0 hours
`;


