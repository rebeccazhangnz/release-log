// updateLog.js
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const os = require('os');

async function run() {
  // Configuration
  const centralRepoUrl = `https://${process.env.GITHUB_USERNAME}:${process.env.GITHUB_PAT}@github.com/rebeccazhangnz/release-log.git`;
  const localClonePath = path.join(os.tmpdir(), 'central-changelog');
  const branchName = 'master'; 

  // Initialize simple-git
  const git = simpleGit();

  // Clone or pull the central changelog repository
  if (!fs.existsSync(localClonePath)) {
    console.log('Cloning central changelog repository...');
    await git.clone(centralRepoUrl, localClonePath);
  } else {
    console.log('Pulling latest changes from central changelog repository...');
    await simpleGit(localClonePath).pull('origin', branchName);
  }

  const centralGit = simpleGit(localClonePath);

  // Check if the branch exists
  const branches = await centralGit.branch();
  if (!branches.all.includes(branchName)) {
    console.log(`Branch '${branchName}' does not exist. Creating it.`);
    await centralGit.checkoutLocalBranch(branchName);
  } else {
    // Switch to the correct branch
    await centralGit.checkout(branchName);
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

    // Update the path to CHANGELOG.md inside the central repository
    const changelogPath = path.join(localClonePath, 'CHANGELOG.md'); // Adjust if necessary
    let centralChangelogContent = '';
    if (fs.existsSync(changelogPath)) {
      centralChangelogContent = fs.readFileSync(changelogPath, 'utf-8');
    } else {
      centralChangelogContent = '# Central Changelog\n';
    }

    // Merge logic (as previously defined)

    // Write back to CHANGELOG.md
    fs.writeFileSync(changelogPath, centralChangelogContent);

    // Remove the local changelog file
    fs.unlinkSync(filePath);
  });

  // Commit and push the changes
  await centralGit.add('.');
  await centralGit.commit('Update changelog entries');

  // Push to the correct branch
  await centralGit.push('origin', branchName);

  console.log('Changelog updated in the central repository.');
}

run().catch(err => {
  console.error('An error occurred:', err.message);
  console.error('Stack trace:', err.stack);
});
