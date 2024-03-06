import * as github from '@actions/github';
import * as core from '@actions/core';
import { SemVer, parse, gt, ReleaseType } from 'semver';

function getCurrentBranch(): string | null {
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

function getMergedPRBranch(): string | null {
    const eventName = github.context.eventName;
    const payload = github.context.payload;
  
    if (eventName === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
        const baseBranch = payload.pull_request?.base.ref;
        core.debug(`Pull request was merged into the branch: ${baseBranch}`);
        return baseBranch;
    } else {
        core.debug('This workflow was not triggered by a merged pull request.');
        return null;
    }
}

function getEventSHA(): string | null {
    const eventName = github.context.eventName;
    let sha: string | null = null;
  
    if (eventName === 'push') {
        sha = github.context.sha;
    } else if (eventName === 'pull_request') {
        const payload: any = github.context.payload;
        if (payload.action === 'closed' && payload.pull_request.merged) {
            sha = payload.pull_request.head.sha;
        }
    } else {
        core.debug(`Event type ${eventName} is not explicitly handled in this example.`);
    }
  
    if (sha) {
        core.debug(`The SHA for the ${eventName} event is: ${sha}`);
    }
    return sha;
}

function isPullRequestMerge(): boolean {
    const eventName = github.context.eventName;
    const payload: any = github.context.payload;

    if (eventName === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        core.debug('This workflow was triggered by a pull request merge.');
        return true;
    }

    core.debug('This workflow was not triggered by a pull request merge.');
    return false;
}

function isSemVarLabel(label: string): label is ReleaseType {
    return ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'].includes(label);
}

async function getAllCommits(octokit: any, branch: string) {
    try {
      
      const commits = [];
      
      for await (const response of octokit.paginate.iterator(octokit.rest.repos.listCommits, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        sha: branch,
      })) {
        // Each response is an array of commits, push them into the commits array
        commits.push(...response.data);
      }
  
      return commits;
    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(`An error occurred: ${error.message}`);
      } else {
        core.setFailed(`An unknown error occurred`);
      }
      return [];
    }
  }


async function getAndLogCommits(): Promise<void> {
    try {
        let version = new SemVer('0.0.0');
        const token = core.getInput('personal_github_token', { required: true });
        const identifier = core.getInput('identifier', { required: false }) || "";
        const branchAsIdentifier = core.getInput('branch_as_identifier', { required: false }) === 'true';
        const includeCommitSha = core.getInput('include_commit_sha', { required: false }) === 'true';
        core.debug(`Debug Settings: \n\t${identifier}\n\t${branchAsIdentifier}\n\t${includeCommitSha}`);

        const octokit = github.getOctokit(token);

        const branch = getCurrentBranch() || getMergedPRBranch();
        core.debug(`Branch: ${branch}`);

        if (!branch) {
            core.debug(`No Branch Found, this will cause an error with generation, pulling from the Main/Master Branch and not the Branch for this Action.`);
            return;
        }

        const commits = await getAllCommits(octokit, branch);

        const tags = await octokit.rest.repos.listTags({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
        });

        core.debug(`Total Commits: ${commits.length}`);

        // Process each commit for versioning cues
        for (const commit of commits) {
            core.debug(`Commit message: ${commit.commit.message}`);

            const regex = /#(major|minor|patch|premajor|preminor|prepatch|prerelease)/ig;
            const matches = commit.commit.message.match(regex);

            if (matches && matches.length > 0) {
                let label = matches[0].toLowerCase().replace("#", "");
                if (isSemVarLabel(label)) {
                    version.inc(label);
                } else {
                    version.inc('patch');
                }
            } else {
                version.inc('patch');
            }
        }

        // Now check for tags that might affect the current version
        tags.data.forEach(tag => {
            let parsedTagVersion = parse(tag.name, true);
            if (parsedTagVersion && gt(parsedTagVersion, version)) {
                version = parsedTagVersion;
            }
        });

        if (branchAsIdentifier && branch) {
            version.prerelease = [branch.trim().replace(/[^a-zA-Z0-9-]+/g, '')];
        }

        if (identifier) {
            version.prerelease = [identifier.trim().replace(/[^a-zA-Z0-9-]+/g, '')];
        }

        let newVersion = version.format();

        if (includeCommitSha) {
            const sha = getEventSHA();
            core.debug(`SHA: ${sha}`);
            if (sha) {
                newVersion = `${newVersion}+build.${sha}`
            }
        }
        core.exportVariable('version', newVersion);
        core.setOutput('version', newVersion);
    } catch (error: unknown) {
        if (error instanceof Error) {
            core.setFailed(`An error occurred: ${error.message}`);
        } else {
            core.setFailed(`An unknown error occurred`);
        }
    }
}

getAndLogCommits();
