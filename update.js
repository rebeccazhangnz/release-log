// updateLog.js
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const os = require('os');

async function run() {
  // Configuration
  const centralRepoUrl = `https://username:${process.env.AZURE_DEVOPS_PAT}@dev.azure.com/your-org/your-project/_git/central-changelog`; // Update with your actual URL
  const localClonePath = path.join(os.tmpdir(), 'central-changelog');

  // Initialize simple-git
  const git = simpleGit();

  // Clone or pull the central changelog repository
  if (!fs.existsSync(localClonePath)) {
    console.log('Cloning central changelog repository...');
    await git.clone(centralRepoUrl, localClonePath);
  } else {
    console.log('Pulling latest changes from central changelog repository...');
    await simpleGit(localClonePath).pull('origin', 'main');
  }

  // Read all changelog files from .changelog directory
  const changelogDir = path.join(__dirname, '.changelog');
  const files = fs.readdirSync(changelogDir);

  if (files.length === 0) {
    console.log('No changelog entries to update.');
    return;
  }

  // Process each changelog file
  files.forEach(file => {
    const filePath = path.join(changelogDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Append or merge the content into the central CHANGELOG.md
    const changelogPath = path.join(localClonePath, 'CHANGELOG.md');
    let centralChangelogContent = '';
    if (fs.existsSync(changelogPath)) {
      centralChangelogContent = fs.readFileSync(changelogPath, 'utf-8');
    } else {
      centralChangelogContent = '# Central Changelog\n';
    }

    const pbiNumberMatch = content.match(/## PBI number: (\d+)/);
    if (pbiNumberMatch) {
      const pbiNumber = pbiNumberMatch[1];
      const pbiSectionRegex = new RegExp(`## PBI number: ${pbiNumber}[\\s\\S]*?(?=\\n## PBI number:|$)`, 'm');

      if (centralChangelogContent.match(pbiSectionRegex)) {
        // PBI section exists, merge the entries
        centralChangelogContent = centralChangelogContent.replace(pbiSectionRegex, existingSection => {
          return mergeChangelogSections(existingSection, content);
        });
      } else {
        // Append the new PBI section
        centralChangelogContent += '\n' + content;
      }

      // Write back to CHANGELOG.md
      fs.writeFileSync(changelogPath, centralChangelogContent);

      // Remove the local changelog file
      fs.unlinkSync(filePath);
    } else {
      console.error(`Invalid format in file ${file}. Skipping.`);
    }
  });

  // Commit and push the changes
  const centralGit = simpleGit(localClonePath);

  await centralGit.add('CHANGELOG.md');
  await centralGit.commit('Update changelog entries');
  await centralGit.push('origin', 'main');

  console.log('Changelog updated in the central repository.');
}

function mergeChangelogSections(existingSection, newSection) {
  // Parse the existing and new sections into objects
  const existingData = parseChangelogSection(existingSection);
  const newData = parseChangelogSection(newSection);

  // Merge fields
  const mergedData = {
    pbiNumber: existingData.pbiNumber,
    repos: mergeLists(existingData.repos, newData.repos),
    changeType: newData.changeType || existingData.changeType,
    developers: mergeLists(existingData.developers, newData.developers),
    dependencies: mergeLists(existingData.dependencies, newData.dependencies),
    risk: newData.risk || existingData.risk,
    testRequired: newData.testRequired || existingData.testRequired,
    changeLogs: mergeChangeLogs(existingData.changeLogs, newData.changeLogs),
  };

  // Construct the merged section
  const mergedSection = constructChangelogSection(mergedData);

  return mergedSection;
}

function parseChangelogSection(section) {
  const lines = section.split('\n');
  const data = {
    repos: [],
    developers: [],
    dependencies: [],
    changeLogs: [],
  };
  let currentField = null;
  let fieldLines = [];
  let inChangeLog = false;
  let changeLogEntry = null;

  lines.forEach(line => {
    if (line.startsWith('## PBI number:')) {
      data.pbiNumber = line.replace('## PBI number:', '').trim();
    } else if (line.startsWith('Repos:')) {
      data.repos = line.replace('Repos:', '').split(',').map(item => item.trim());
    } else if (line.startsWith('Change Type:')) {
      data.changeType = line.replace('Change Type:', '').trim();
    } else if (line.startsWith('Developers:')) {
      data.developers = line.replace('Developers:', '').split(',').map(item => item.trim());
    } else if (line.startsWith('Dependencies:')) {
      data.dependencies = line.replace('Dependencies:', '').split(',').map(item => item.trim());
    } else if (line.startsWith('Risk:')) {
      currentField = 'risk';
      fieldLines = [line.replace('Risk:', '').trim()];
    } else if (line.startsWith('Test Required:')) {
      if (currentField === 'risk') {
        data.risk = fieldLines.join('\n').trim();
      }
      currentField = 'testRequired';
      fieldLines = [line.replace('Test Required:', '').trim()];
    } else if (line.startsWith('Change logs:')) {
      if (currentField === 'testRequired') {
        data.testRequired = fieldLines.join('\n').trim();
      }
      currentField = null;
      inChangeLog = true;
    } else if (line.startsWith('- ') && inChangeLog) {
      if (changeLogEntry) {
        data.changeLogs.push(changeLogEntry);
      }
      changeLogEntry = {
        header: line,
        content: '',
      };
    } else if (inChangeLog && changeLogEntry) {
      changeLogEntry.content += line + '\n';
    } else if (currentField) {
      fieldLines.push(line.trim());
    }
  });

  // Add the last change log entry
  if (changeLogEntry) {
    data.changeLogs.push(changeLogEntry);
  }

  // Assign any remaining field
  if (currentField === 'risk') {
    data.risk = fieldLines.join('\n').trim();
  } else if (currentField === 'testRequired') {
    data.testRequired = fieldLines.join('\n').trim();
  }

  return data;
}

function mergeLists(list1, list2) {
  const set = new Set([...list1, ...list2]);
  return Array.from(set);
}

function mergeChangeLogs(logs1, logs2) {
  // Combine and sort change logs
  const combinedLogs = [...logs1, ...logs2];
  // Optional: You can sort the logs by date or other criteria
  return combinedLogs;
}

function constructChangelogSection(data) {
  let section = `## PBI number: ${data.pbiNumber}
Repos: ${data.repos.join(', ')}
Change Type: ${data.changeType}
Developers: ${data.developers.join(', ')}
Dependencies: ${data.dependencies.join(', ')}
Risk: ${data.risk}
Test Required: ${data.testRequired}
Change logs:
`;

  data.changeLogs.forEach(log => {
    section += `${log.header}\n${log.content}`;
  });

  return section;
}

run().catch(err => {
  console.error('An error occurred:', err);
});
