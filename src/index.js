const github = require('@actions/github');
const core = require('@actions/core');

const semver = require('semver')

function getCurrentBranch() {
    const ref = github.context.ref;
    const refArray = ref.split('/');
    if (refArray[1] === 'heads') {
      const branchName = refArray.slice(2).join('/');
      core.debug(`The current branch is ${branchName}`);
      return branchName;
    } else {
      core.debug('Not a branch push event.');
      return null;
    }
}

function getMergedPRBranch() {
    const eventName = github.context.eventName;
    const payload = github.context.payload;
  
    // Ensure the event is a pull request and it is merged
    if (eventName === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
      const baseBranch = payload.pull_request.base.ref; // Target branch the PR is merged into
      core.debug(`Pull request was merged into the branch: ${baseBranch}`);
      return baseBranch;
    } else {
      core.debug('This workflow was not triggered by a merged pull request.');
      return null;
    }
}

function getEventSHA() {
    const eventName = github.context.eventName;
    let sha;
  
    if (eventName === 'push') {
      // For push events, the SHA is directly available
      sha = github.context.sha;
    } else if (eventName === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
      // For pull request events, use the SHA of the latest commit of the PR
      sha = github.context.payload.pull_request.head.sha;
    } else {
      // For other events, you might need to adjust this logic
      core.debug(`Event type ${eventName} is not explicitly handled in this example.`);
      return null;
    }
  
    core.debug(`The SHA for the ${eventName} event is: ${sha}`);
    return sha;
  }


function isPullRequestMerge() {
    const eventName = github.context.eventName;
    const payload = github.context.payload;

    // Check if the event is a pull request
    if (eventName === 'pull_request') {
        const action = payload.action;
        
        // Check if the pull request action is closed and the pull request is merged
        if (action === 'closed' && payload.pull_request.merged) {
            core.debug('This workflow was triggered by a pull request merge.');
            return true;
        }
    }

    core.debug('This workflow was not triggered by a pull request merge.');
    return false;
}

function isSemVarLabel(label) {
    let labels = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];
    return (labels.indexOf(label) != -1);
}

function incSemver(_semvar, label, identifier, branch_as_identifier, branch) {

    if (identifier != "") {
        _semvar.inc(label, identifier.replace(/[^a-zA-Z0-9-]+/g, ''))
    } else {
        if (branch_as_identifier) {
            _semvar.inc(label, branch.replace(/[^a-zA-Z0-9-]+/g, ''))
        } else {
            _semvar.inc(label)
        }
    }
    return _semvar;
}

async function getAndLogCommits() {
    try {
        var version = new semver.SemVer('0.0.0');
        const token = core.getInput('personal_github_token', { required: true });
        const identifier  = core.getInput('identifier', { required: false }) || "";
        const branch_as_identifier  = core.getInput('branch_as_identifier', { required: false }) || false;
        const include_commit_sha  = core.getInput('include_commit_sha', { required: false }) || false;

        const octokit = github.getOctokit(token);

        const branch = getCurrentBranch() || await getMergedPRBranch();

        if (branch == null) {
            core.debug(`No Branch Found, this will cause an error with generation, pulling from the Main/Master Branch and not the Branch for this Action.`);
            return;
        }

        const commits = await octokit.rest.repos.listCommits({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            sha: branch,
        });

        const tags = await octokit.rest.repos.listTags({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        });

        // Process each commit for versioning cues
        for (const commit of commits.data) {
            core.debug(`Commit message: ${commit.commit.message}`);

            // Look for semantic version cues in the commit message
            const regex = /#(major|minor|patch|premajor|preminor|prepatch|prerelease)/ig;
            const matches = commit.commit.message.match(regex);

            if (matches && matches.length > 0) {
                // For simplicity, we only look at the first match
                let label = matches[0].toLowerCase().replace("#", "");
                if (isSemVarLabel(label)) {
                    version.inc(label);
                } else {
                    // Default to patch if no valid label is found
                    version.inc('patch');
                }
            } else {
                // Default to patch if no specific label is found
                version.inc('patch');
            }
        }

        // Now check for tags that might affect the current version
        tags.data.forEach(tag => {
            let parsedTagVersion = semver.parse(tag.name, { loose: true });
            if (parsedTagVersion && semver.gt(parsedTagVersion, version)) {
                version = parsedTagVersion;
            }
        });

        if (branch_as_identifier && branch) {
            version.prerelease = [branch.trim().replace(/[^a-zA-Z0-9-]+/g, '')];
        }

        if (identifier) {
            version.prerelease = [identifier.trim().replace(/[^a-zA-Z0-9-]+/g, '')];
        }

        if (include_commit_sha) {
            const sha = await getEventSHA();
            version.build = [`sha.${sha}`];
        }

        let new_version = version.format();
        core.exportVariable('version', new_version);
        core.setOutput('version', new_version);
    } catch (error) {
        core.setFailed(`An error occurred: ${error.message}`);
    }
}


getAndLogCommits()
