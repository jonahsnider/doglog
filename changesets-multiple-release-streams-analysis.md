# Changesets Multiple Release Streams Setup Guide

## Executive Summary

After thoroughly examining the Changesets documentation and source code, I've found that **Changesets does support multiple release streams**, but it requires a specific workflow combining several features. The key is using **prerelease mode with different tags** combined with **branch-based workflows**.

## How Changesets Can Support Multiple Release Streams

### Core Approach: Branch + Prerelease Tag Strategy

Changesets supports multiple release streams through a combination of:

1. **Different Git branches** for each release stream (main, 2026, 2027)
2. **Prerelease tags** to differentiate versions (`beta`, `alpha`)
3. **NPM dist tags** to publish to separate channels
4. **Coordinated CI/CD workflows** per branch

### Recommended Setup for Your Use Case

Here's how to set up the three release streams you mentioned:

#### Branch Structure
```
main      → v2025.x.x (stable releases)
2026      → v2026.x.x-beta.x (beta releases) 
2027      → v2027.x.x-alpha.x (alpha releases)
```

#### Per-Branch Configuration

**1. Main Branch (Stable - v2025)**
```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**2. 2026 Branch (Beta)**
```json
// .changeset/config.json  
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public", 
  "baseBranch": "2026",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**3. 2027 Branch (Alpha)**
```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog", 
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "2027", 
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

## Detailed Workflow for Each Branch

### Main Branch (Stable) Workflow
```bash
# Normal changesets workflow
changeset add
changeset version
changeset publish
```
This publishes to `latest` dist tag on npm.

### 2026 Branch (Beta) Workflow
```bash
# Enter prerelease mode with beta tag
changeset pre enter beta

# Add changesets as normal
changeset add
changeset version  # Creates versions like 2026.1.0-beta.0
changeset publish  # Publishes to 'beta' dist tag

# Continue development
changeset add
changeset version  # Creates 2026.1.0-beta.1  
changeset publish

# When ready to graduate to stable
changeset pre exit
changeset version  # Creates 2026.1.0
changeset publish  # Publishes to 'latest' dist tag
```

### 2027 Branch (Alpha) Workflow  
```bash
# Enter prerelease mode with alpha tag
changeset pre enter alpha

# Add changesets as normal
changeset add
changeset version  # Creates versions like 2027.1.0-alpha.0
changeset publish  # Publishes to 'alpha' dist tag

# Continue development
changeset add
changeset version  # Creates 2027.1.0-alpha.1
changeset publish
```

## Key Changesets Features That Enable This

### 1. Prerelease Mode (`changeset pre`)
- **Purpose**: Creates versions with prerelease tags (e.g., `-beta.0`, `-alpha.1`)
- **NPM Dist Tags**: Automatically publishes to the specified dist tag instead of `latest`
- **State Management**: Creates a `pre.json` file to track prerelease state

### 2. baseBranch Configuration
- **Purpose**: Tells Changesets which branch to use for comparisons
- **Usage**: Set different `baseBranch` values per branch to ensure proper changeset detection

### 3. Dist Tag Publishing
- **Stable**: Published to `latest` dist tag  
- **Beta**: Published to `beta` dist tag
- **Alpha**: Published to `alpha` dist tag

### 4. Version Calculation
- Changesets handles version bumping based on changeset types (patch/minor/major)
- Prerelease mode appends the prerelease tag and iteration number

## Understanding PreState (`.changeset/pre.json`)

When you enter prerelease mode, Changesets creates a `pre.json` file that tracks:

```typescript
type PreState = {
  mode: "pre" | "exit";           // Current prerelease mode
  tag: string;                    // The prerelease tag (beta, alpha, etc.)
  initialVersions: {              // Versions when prerelease mode started
    [pkgName: string]: string;
  };
  changesets: string[];           // Changeset IDs consumed in prerelease
};
```

**Example `pre.json` for beta branch:**
```json
{
  "mode": "pre",
  "tag": "beta",
  "initialVersions": {
    "my-package": "2026.0.0"
  },
  "changesets": ["changeset-id-1", "changeset-id-2"]
}
```

This file ensures consistent prerelease versioning and helps coordinate the eventual exit from prerelease mode.

## Practical Example: Setting Up a Package

Let's walk through a complete example:

### Step 1: Initial Setup

```bash
# Initialize changesets in your repo
npm install --save-dev @changesets/cli
npx changeset init

# Create your branch structure
git checkout -b 2026 main
git checkout -b 2027 main
git checkout main
```

### Step 2: Configure Each Branch

On **main branch**:
```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main"
}
```

On **2026 branch**:
```bash
git checkout 2026
# Update .changeset/config.json
```
```json
{
  "changelog": "@changesets/cli/changelog", 
  "commit": false,
  "access": "public",
  "baseBranch": "2026"
}
```
```bash
# Enter prerelease mode
npx changeset pre enter beta
git add . && git commit -m "Enter beta prerelease mode"
```

On **2027 branch**:
```bash
git checkout 2027
# Update .changeset/config.json with baseBranch: "2027"
npx changeset pre enter alpha
git add . && git commit -m "Enter alpha prerelease mode"
```

### Step 3: Making Changes

**On main branch (stable):**
```bash
git checkout main
# Make changes to your code
npx changeset add
# Select packages and bump types as normal
npx changeset version
npx changeset publish
# Result: my-package@1.0.1 published to latest
```

**On 2026 branch (beta):**
```bash
git checkout 2026
# Make changes to your code
npx changeset add
npx changeset version
npx changeset publish
# Result: my-package@2026.1.0-beta.0 published to beta dist tag
```

**On 2027 branch (alpha):**
```bash
git checkout 2027
# Make changes to your code  
npx changeset add
npx changeset version
npx changeset publish
# Result: my-package@2027.1.0-alpha.0 published to alpha dist tag
```

### Step 4: User Installation

Users can now install from different streams:

```bash
# Install stable (latest)
npm install my-package

# Install beta  
npm install my-package@beta

# Install alpha
npm install my-package@alpha

# Install specific version
npm install my-package@2026.1.0-beta.0
```

## CI/CD Integration Strategy

### GitHub Actions Example

You'll need separate workflows for each branch:

**Main Branch (.github/workflows/release-stable.yml)**
```yaml
name: Release Stable
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: npm run changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**2026 Branch (.github/workflows/release-beta.yml)**
```yaml
name: Release Beta  
on:
  push:
    branches: [2026]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      
      - name: Enter prerelease mode
        run: npx changeset pre enter beta
        
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: npm run changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**2027 Branch (.github/workflows/release-alpha.yml)**
```yaml  
name: Release Alpha
on:
  push:
    branches: [2027]

jobs:
  release:
    runs-on: ubuntu-latest  
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      
      - name: Enter prerelease mode
        run: npx changeset pre enter alpha
        
      - name: Create Release Pull Request or Publish  
        uses: changesets/action@v1
        with:
          publish: npm run changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Alternative Approaches Considered

### 1. Fixed/Linked Packages
- **What it does**: Forces packages to version together
- **Why not suitable**: Designed for monorepo package coordination, not release streams

### 2. Snapshot Releases
- **What it does**: Creates temporary test versions
- **Why not suitable**: Intended for testing, not production release streams

### 3. Multiple Repository Approach
- **What it does**: Separate repos for each release stream
- **Trade-offs**: More complex but completely isolated

## Important Considerations & Warnings

### 1. Prerelease Mode Limitations
From the docs: *"If you decide to do prereleases from the main branch of your repository, without having a branch for your last stable release without the prerelease changes, you will block other changes until you are ready to exit prerelease mode."*

**Solution**: Use separate branches for each release stream as recommended.

### 2. Version Coordination
- Each branch maintains its own version numbers
- You'll need to manually coordinate major version bumps across branches if desired
- Consider using a versioning scheme that includes the year (e.g., `2025.1.0`, `2026.1.0-beta.0`)

### 3. Changeset File Management
- Changeset files are consumed (deleted) when `changeset version` runs
- You may need to cherry-pick or manually port changesets between branches
- Consider using conventional commits or other tools for cross-branch change tracking

### 4. NPM Package Management
- Each dist tag (`latest`, `beta`, `alpha`) will have different versions
- Users can install specific versions: `npm install package@beta` or `npm install package@alpha`
- Make sure your documentation clearly explains the different channels

### 5. PreState File Coordination
- The `.changeset/pre.json` file tracks prerelease state per branch
- Don't merge this file between branches - each branch should maintain its own
- The file is crucial for consistent versioning and proper prerelease exit

## Getting Started Implementation Steps

1. **Set up branch structure**
   ```bash
   git checkout -b 2026
   git checkout -b 2027
   ```

2. **Configure each branch** 
   - Update `.changeset/config.json` with appropriate `baseBranch`
   - Set up branch-specific CI/CD workflows

3. **Initialize prerelease mode on non-main branches**
   ```bash
   # On 2026 branch
   git checkout 2026
   changeset pre enter beta
   
   # On 2027 branch  
   git checkout 2027
   changeset pre enter alpha
   ```

4. **Test the workflow**
   - Create changesets on each branch
   - Verify version generation and publishing
   - Test npm installation from different dist tags

5. **Document for your team**
   - Which branch to use for different types of changes
   - How to install from different release streams
   - Release coordination processes

## Additional Resources

- [Changesets Repository](https://github.com/changesets/changesets)
- [Prerelease Documentation](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- [Config Options Documentation](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md)
- [Changesets GitHub Action](https://github.com/changesets/action)

## Conclusion

Changesets **can absolutely support multiple release streams** using the branch + prerelease tag strategy. The key insight is that Changesets was designed for this workflow, but it requires careful orchestration of:

- Branch-based development
- Prerelease mode for non-stable branches  
- Proper CI/CD configuration
- Clear team processes

This approach gives you the flexibility of independent release streams while maintaining the automation and consistency benefits of Changesets. The prerelease system is particularly powerful because it:

1. **Maintains separate version lineages** for each release stream
2. **Uses NPM dist tags** to avoid conflicts
3. **Provides clean graduation paths** from prerelease to stable
4. **Integrates seamlessly** with existing CI/CD workflows

With this setup, you can have stable v2025 releases on `main`, experimental v2026 beta releases on the `2026` branch, and cutting-edge v2027 alpha releases on the `2027` branch - all managed through the same Changesets workflow.