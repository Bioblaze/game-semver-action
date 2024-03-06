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

async function getAndLogCommits() {
    try {

        var version = new semver.SemVer('0.0.0');
        const token = core.getInput('personal_github_token', { required: true })
        const octokit = github.getOctokit(token);

        const branch = getCurrentBranch() || getMergedPRBranch() || getEventSHA();

        if (branch == null) {
            core.debug(`No Branch Found, this will cause a error with generation, pulling from the Main/Master Branch and not the Branch for this Action.`);
        }

        const commits = await octokit.rest.repos.listCommits({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            sha: branch,
        });

        // Attempt to find a tag pointing to this commit
        const tags = await octokit.rest.repos.listTags({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        });

        for (const commit of commits.data) {
            // Logging the commit message
            core.debug(`Commit message: ${commit.commit.message}`);

            const regex = /#\w+/ig;
            const matches = commit.commit.message.match(regex);

            const tag = tags.data.find(t => t.commit.sha === commit.sha);
            if (tag) {
                core.debug(`Tag: ${tag.name}`);
                let label = tag.name.toLowerCase();
                if (isSemVarLabel(label)) {
                    version.inc(label)
                } else {
                    let semchk = semver.parse(tag.name.replace(/^refs\/tags\//g, ''), { loose: true });
                    if (semchk != null) {
                        if (semver.rcompare(version.version, semchk.version)) {
                            core.debug(`Setting Version: ${semchk.version}`);
                            version = semchk;
                        }
                    } else if (matches.length > 0) {
                        let label = matches[0].toLowerCase().replace("#", "");
                        version.inc(label)
                    } else {
                        version.inc('patch')
                    }
                }
            } else {
                if (matches.length > 0) {
                    let label = matches[0].toLowerCase().replace("#", "");
                    version.inc(label)
                } else {
                    version.inc('patch')
                }
            }
        }
        core.exportVariable('version', version.version)
        core.setOutput('version', version.version)
    } catch (error) {
        core.setFailed(`An error occurred: ${error.message}`);
    }
}

getAndLogCommits()
