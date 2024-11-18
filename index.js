// change.js
const inquirer = require("inquirer");
const fs = require("fs");
const path = require("path");

// Ensure the .changelog directory exists
const changelogDir = path.join(__dirname, ".changelog");
if (!fs.existsSync(changelogDir)) {
  fs.mkdirSync(changelogDir);
}

async function run() {
  // Prompt for PBI number
  const { pbiNumber } = await inquirer.prompt([
    {
      type: "input",
      name: "pbiNumber",
      message: "PBI number:",
      validate: (input) => (input ? true : "PBI number cannot be empty."),
    },
  ]);

  // Get repository name
  const repoName = path.basename(process.cwd());

  // Determine the changelog file path
  const changelogFileName = `PBI-${pbiNumber}.md`;
  const changelogFilePath = path.join(changelogDir, changelogFileName);

  // Load existing content if it exists
  let existingContent = {};
  if (fs.existsSync(changelogFilePath)) {
    const fileContent = fs.readFileSync(changelogFilePath, "utf-8");
    existingContent = parseChangelog(fileContent);
  }

  // Prompt for all fields with existing data prepopulated
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "changeType",
      message: `[${repoName}] Select the type of change:`,
      choices: ["major", "minor", "patch"],
      default: existingContent.changeType || "minor",
    },
    {
      type: "input",
      name: "developers",
      message: "Developers (comma-separated):",
      default: existingContent.developers || "",
    },
    {
      type: "input",
      name: "dependencies",
      message: "Dependencies (comma-separated):",
      default: existingContent.dependencies || "",
    },
    {
      type: "editor",
      name: "risk",
      message: "Risk:",
      default: existingContent.risk || "",
    },
    {
      type: "editor",
      name: "testRequired",
      message: "Test Required:",
      default: existingContent.testRequired || "",
    },
    {
      type: "editor",
      name: "summary",
      message: "Summary:",
      default: existingContent.summary || "",
      validate: (input) => (input ? true : "Summary cannot be empty."),
    },
  ]);

  // Prepare the changelog entry
  const date = new Date().toISOString().split("T")[0];
  const changelogEntry = `## PBI number: ${pbiNumber}
Repos: ${repoName}
Change Type: ${answers.changeType}
Developers: ${answers.developers}
Dependencies: ${answers.dependencies}
Risk: ${answers.risk}
Test Required: ${answers.testRequired}
Change logs:
- ${date} [${repoName}]
  ${answers.summary}
`;

  // Write the updated content back to the file
  fs.writeFileSync(changelogFilePath, changelogEntry);

  console.log(`Changelog entry saved to ${changelogFilePath}`);
}

function parseChangelog(content) {
  const lines = content.split("\n");
  const data = {};
  let inSummary = false;
  let summaryLines = [];

  lines.forEach((line, index) => {
    if (line.startsWith("Change Type:")) {
      data.changeType = line.replace("Change Type:", "").trim();
    } else if (line.startsWith("Developers:")) {
      data.developers = line.replace("Developers:", "").trim();
    } else if (line.startsWith("Dependencies:")) {
      data.dependencies = line.replace("Dependencies:", "").trim();
    } else if (line.startsWith("Risk:")) {
      data.risk = line.replace("Risk:", "").trim();
    } else if (line.startsWith("Test Required:")) {
      data.testRequired = line.replace("Test Required:", "").trim();
    } else if (line.startsWith("- ")) {
      inSummary = true;
    } else if (inSummary) {
      summaryLines.push(line);
    }
  });

  if (summaryLines.length > 0) {
    data.summary = summaryLines.join("\n").trim();
  }

  return data;
}

run().catch((err) => {
  console.error("An error occurred:", err);
});
