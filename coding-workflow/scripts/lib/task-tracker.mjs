import fs from "fs/promises";

const TASK_PATTERN = /^[-*]\s+\[[\sx]\]/i;
const COMPLETED_TASK_PATTERN = /^[-*]\s+\[x\]/i;

export function countFromContent(content) {
  const lines = content.split("\n");
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (TASK_PATTERN.test(line)) {
      total += 1;
      if (COMPLETED_TASK_PATTERN.test(line)) {
        completed += 1;
      }
    }
  }
  return { total, completed };
}

export async function getProgress({ tasksPath, content }) {
  if (typeof content === "string") {
    return countFromContent(content);
  }
  if (!tasksPath) {
    return { total: 0, completed: 0 };
  }
  try {
    const fileContent = await fs.readFile(tasksPath, "utf8");
    return countFromContent(fileContent);
  } catch {
    return { total: 0, completed: 0 };
  }
}

export function format(progress) {
  if (progress.total === 0) {
    return "No tasks";
  }
  if (progress.completed === progress.total) {
    return "Complete";
  }
  return `${progress.completed}/${progress.total} tasks`;
}
