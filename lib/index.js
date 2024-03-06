"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const semver_1 = require("semver");
function getCurrentBranch() {
    const ref = github.context.ref;
    const refArray = ref.split('/');
    if (refArray[1] === 'heads') {
        const branchName = refArray.slice(2).join('/');
        core.debug(`The current branch is ${branchName}`);
        return branchName;
    }
    else {
        core.debug('Not a branch push event.');
        return null;
    }
}
function getMergedPRBranch() {
    var _a, _b;
    const eventName = github.context.eventName;
    const payload = github.context.payload;
    if (eventName === 'pull_request' && payload.action === 'closed' && ((_a = payload.pull_request) === null || _a === void 0 ? void 0 : _a.merged)) {
        const baseBranch = (_b = payload.pull_request) === null || _b === void 0 ? void 0 : _b.base.ref;
        core.debug(`Pull request was merged into the branch: ${baseBranch}`);
        return baseBranch;
    }
    else {
        core.debug('This workflow was not triggered by a merged pull request.');
        return null;
    }
}
function getEventSHA() {
    const eventName = github.context.eventName;
    let sha = null;
    if (eventName === 'push') {
        sha = github.context.sha;
    }
    else if (eventName === 'pull_request') {
        const payload = github.context.payload;
        if (payload.action === 'closed' && payload.pull_request.merged) {
            sha = payload.pull_request.head.sha;
        }
    }
    else {
        core.debug(`Event type ${eventName} is not explicitly handled in this example.`);
    }
    if (sha) {
        core.debug(`The SHA for the ${eventName} event is: ${sha}`);
    }
    return sha;
}
function isPullRequestMerge() {
    const eventName = github.context.eventName;
    const payload = github.context.payload;
    if (eventName === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        core.debug('This workflow was triggered by a pull request merge.');
        return true;
    }
    core.debug('This workflow was not triggered by a pull request merge.');
    return false;
}
function isSemVarLabel(label) {
    return ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'].includes(label);
}
function getAllCommits(octokit, branch) {
    var _a, e_1, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const commits = [];
            try {
                for (var _d = true, _e = __asyncValues(octokit.paginate.iterator(octokit.rest.repos.listCommits, {
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    sha: branch,
                })), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const response = _c;
                        // Each response is an array of commits, push them into the commits array
                        commits.push(...response.data);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return commits;
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(`An error occurred: ${error.message}`);
            }
            else {
                core.setFailed(`An unknown error occurred`);
            }
            return [];
        }
    });
}
function getAndLogCommits() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let version = new semver_1.SemVer('0.0.0');
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
            const commits = yield getAllCommits(octokit, branch);
            const tags = yield octokit.rest.repos.listTags({
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
                    }
                    else {
                        version.inc('patch');
                    }
                }
                else {
                    version.inc('patch');
                }
            }
            // Now check for tags that might affect the current version
            tags.data.forEach(tag => {
                let parsedTagVersion = (0, semver_1.parse)(tag.name, true);
                if (parsedTagVersion && (0, semver_1.gt)(parsedTagVersion, version)) {
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
                    newVersion = `${newVersion}+build.${sha}`;
                }
            }
            core.exportVariable('version', newVersion);
            core.setOutput('version', newVersion);
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(`An error occurred: ${error.message}`);
            }
            else {
                core.setFailed(`An unknown error occurred`);
            }
        }
    });
}
getAndLogCommits();
