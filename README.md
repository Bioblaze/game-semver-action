# Game-Semver-Action GitHub Action

The `Game-Semver-Action` is a GitHub Action designed to automatically generate a new semantic version (semver) for your project based on commit messages. It's tailored for game development workflows but can be easily adapted for any type of project that follows semantic versioning principles.

## Features

- **Commit Message Driven**: Generates new versions by analyzing commit messages for semver cues (`major`, `minor`, `patch`).
- **Flexible Versioning**: Supports additional identifiers for prerelease versions (e.g., alpha, beta) and can include the commit SHA as build metadata.
- **Branch Name as Identifier**: Optionally uses the branch name as an identifier for the prerelease versions, adding more context to your versioning.

## Inputs

| Input                   | Description                                                                 | Required | Default |
|-------------------------|-----------------------------------------------------------------------------|----------|---------|
| `personal_github_token` | Token to get tags and commits from the repo. Use `secrets.PGITHUB_TOKEN`.   | Yes      | N/A     |
| `identifier`            | Optional identifier for the version (e.g., beta, alpha).                    | No       | `''`    |
| `branch_as_identifier`  | Use the branch name as an identifier for prerelease versions.               | No       | `false` |
| `include_commit_sha`    | Include the commit SHA in the version as build metadata.                    | No       | `false` |

## Outputs

### `version`

The generated semantic version based on your commit history and action inputs. This version can be used in subsequent workflow steps, for example, to tag a release or to update version files within your project.

To use this output in another step in your workflow, you can reference it by the step's ID. For example:

```yaml
steps:
  - name: Generate Semver
    id: semver
    uses: Bioblaze/game-semver-action@v1
    with:
      personal_github_token: ${{ secrets.PGITHUB_TOKEN }}

  - name: Use the Generated Version
    run: echo "The new version is ${{ steps.semver.outputs.version }}"
```

This output provides a powerful way to automate your release process, ensuring that each new release is correctly versioned according to the semantic versioning rules and your project's specific requirements.

## Usage

Below is a sample workflow that demonstrates how to use `Game-Semver-Action`:

```yaml
name: Auto Versioning

on:
  push:
    branches:
      - main

jobs:
  versioning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Generate Semver
        uses: Bioblaze/game-semver-action@v1
        with:
          personal_github_token: ${{ secrets.PGITHUB_TOKEN }}
          identifier: 'beta'
          branch_as_identifier: false
          include_commit_sha: true
```

## License

This GitHub Action is distributed under the MIT license. See the `LICENSE` file for more details.

---

This action is maintained by Randolph William Aarseth II <randolph@divine.games>. Please reach out for support or contributions.