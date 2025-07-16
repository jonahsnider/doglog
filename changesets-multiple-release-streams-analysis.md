# Changesets Multiple Release Streams Setup Guide

## Executive Summary

After thoroughly examining the Changesets documentation and source code, I've found that **Changesets absolutely supports multiple release streams for version management**. Since you're not publishing to npm and only need to update `vendordep.json` from `package.json`, the setup is much simpler than npm publishing scenarios.

## How Changesets Can Support Multiple Release Streams (Version Management Only)

### Core Approach: Branch-Based Version Management

Changesets supports multiple release streams through:

1. **Different Git branches** for each release stream (main, 2026, 2027)
2. **Independent version numbering** per branch
3. **Automatic changelog generation** per stream
4. **Simple scripts** to sync vendordep.json from package.json
5. **Git tagging** for releases

### Recommended Setup for Your Use Case

Here's how to set up the three release streams you mentioned:

#### Branch Structure
```
main      → v2025.x.x (stable releases)
2026      → v2026.x.x (2026 version stream) 
2027      → v2027.x.x (2027 version stream)
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
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": true
  }
}
```

**2. 2026 Branch**
```json
// .changeset/config.json  
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "baseBranch": "2026",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": true
  }
}
```

**3. 2027 Branch**
```json
// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog", 
  "commit": false,
  "fixed": [],
  "linked": [],
  "baseBranch": "2027", 
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": {
    "version": true,
    "tag": true
  }
}
```

## Detailed Workflow for Each Branch

### Simple Workflow (All Branches)
```bash
# Make changes to your code
changeset add
# This updates package.json version and CHANGELOG.md
changeset version
# Custom script to sync vendordep.json from package.json
npm run update-vendordep
# Commit the changes
git add . && git commit -m "Release X.Y.Z"
```

## Setting Initial Versions

Set the starting version in each branch's `package.json`:

**Main branch package.json:**
```json
{
  "name": "my-library",
  "version": "2025.0.0"
}
```

**2026 branch package.json:**
```json
{
  "name": "my-library", 
  "version": "2026.0.0"
}
```

**2027 branch package.json:**
```json
{
  "name": "my-library",
  "version": "2027.0.0"
}
```

## Key Changesets Features That Enable This

### 1. baseBranch Configuration
- **Purpose**: Tells Changesets which branch to use for comparisons
- **Usage**: Set different `baseBranch` values per branch to ensure proper changeset detection

### 2. privatePackages Configuration
- **Purpose**: Tells Changesets this package won't be published to npm
- **Result**: Still handles versioning and git tagging, but skips npm publish logic

### 3. Version Calculation
- Changesets handles version bumping based on changeset types (patch/minor/major)
- Each branch maintains independent version numbers

### 4. Automatic Changelog Generation
- Generates CHANGELOG.md per branch based on changesets
- Tracks changes independently per release stream

## Vendordep.json Sync Implementation

### Update Script

Create a script to sync `vendordep.json` from `package.json`:

**scripts/update-vendordep.js:**
```javascript
const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Read vendordep.json
const vendordepPath = 'vendordep.json';
const vendordep = JSON.parse(fs.readFileSync(vendordepPath, 'utf8'));

// Update version in vendordep
vendordep.version = version;

// Write back to vendordep.json
fs.writeFileSync(vendordepPath, JSON.stringify(vendordep, null, 2) + '\n');

console.log(`Updated vendordep.json version to ${version}`);
```

### Package.json Scripts
```json
{
  "scripts": {
    "update-vendordep": "node scripts/update-vendordep.js",
    "version": "npm run update-vendordep && git add vendordep.json"
  }
}
```

## Practical Example: Setting Up Multiple Release Streams

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
// package.json
{
  "name": "my-library",
  "version": "2025.0.0"
}

// .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "baseBranch": "main",
  "privatePackages": {
    "version": true,
    "tag": true
  }
}
```

On **2026 branch**:
```bash
git checkout 2026
# Update package.json version to "2026.0.0"
# Update .changeset/config.json baseBranch to "2026"
```

On **2027 branch**:
```bash
git checkout 2027
# Update package.json version to "2027.0.0" 
# Update .changeset/config.json baseBranch to "2027"
```

### Step 3: Making Changes

**On main branch (2025 stable):**
```bash
git checkout main
# Make changes to your code
npx changeset add
# Select packages and bump types as normal
npx changeset version
# Updates: package.json 2025.0.0 → 2025.1.0, CHANGELOG.md, vendordep.json
npm run update-vendordep
git add . && git commit -m "Release 2025.1.0"
```

**On 2026 branch:**
```bash
git checkout 2026
# Make changes to your code
npx changeset add
npx changeset version
# Updates: package.json 2026.0.0 → 2026.1.0, CHANGELOG.md, vendordep.json
npm run update-vendordep  
git add . && git commit -m "Release 2026.1.0"
```

**On 2027 branch:**
```bash
git checkout 2027
# Make changes to your code  
npx changeset add
npx changeset version
# Updates: package.json 2027.0.0 → 2027.0.1, CHANGELOG.md, vendordep.json
npm run update-vendordep
git add . && git commit -m "Release 2027.0.1"
```

### Step 4: Results

You now have three independent release streams:
- **2025.x.x** versions on main branch
- **2026.x.x** versions on 2026 branch  
- **2027.x.x** versions on 2027 branch

Each with their own:
- ✅ `package.json` versions
- ✅ `vendordep.json` versions (synced)
- ✅ `CHANGELOG.md` files
- ✅ Git tags for releases

## CI/CD Integration Strategy

### GitHub Actions Example

You'll need separate workflows for each branch:

**Main Branch (.github/workflows/release-stable.yml)**
```yaml
name: Release 2025 Stable
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
      
      - name: Create Release Pull Request
        uses: changesets/action@v1
        with:
          version: npm run version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**2026 Branch (.github/workflows/release-2026.yml)**
```yaml
name: Release 2026  
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
      
      - name: Create Release Pull Request
        uses: changesets/action@v1
        with:
          version: npm run version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**2027 Branch (.github/workflows/release-2027.yml)**
```yaml  
name: Release 2027
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
      
      - name: Create Release Pull Request
        uses: changesets/action@v1
        with:
          version: npm run version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Alternative Approaches Considered

### 1. Prerelease Mode
- **What it does**: Creates versions with prerelease tags (e.g., `-beta.0`, `-alpha.1`)
- **Why not suitable**: You want clean version numbers, not prerelease versions

### 2. Fixed/Linked Packages
- **What it does**: Forces packages to version together
- **Why not suitable**: Designed for monorepo package coordination, not release streams

### 3. Multiple Repository Approach
- **What it does**: Separate repos for each release stream
- **Trade-offs**: More complex but completely isolated

## Important Considerations & Warnings

### 1. Version Coordination
- Each branch maintains its own version numbers independently
- You'll need to manually coordinate major version bumps across branches if desired
- The year-based versioning scheme (2025.x.x, 2026.x.x, 2027.x.x) naturally separates streams

### 2. Changeset File Management
- Changeset files are consumed (deleted) when `changeset version` runs
- You may need to cherry-pick or manually port changesets between branches
- Consider using conventional commits or other tools for cross-branch change tracking

### 3. Git Tag Management
- Each branch will create its own git tags (2025.1.0, 2026.1.0, 2027.0.1)
- Tags are unique across branches, so no conflicts
- Make sure your release automation accounts for branch-specific tags

### 4. Vendordep.json Sync
- The update script must run after `changeset version` to sync versions
- Include vendordep.json in version control commits
- Test the sync script to ensure proper JSON formatting

## Getting Started Implementation Steps

1. **Set up branch structure**
   ```bash
   git checkout -b 2026
   git checkout -b 2027
   ```

2. **Configure each branch** 
   - Update `package.json` version to appropriate starting version
   - Update `.changeset/config.json` with appropriate `baseBranch`
   - Add `privatePackages` config to indicate no npm publishing

3. **Create vendordep sync script**
   ```bash
   mkdir scripts
   # Create scripts/update-vendordep.js
   # Add npm scripts to package.json
   ```

4. **Set up CI/CD workflows**
   - Create branch-specific GitHub Actions workflows
   - Test the automation with sample changesets

5. **Test the workflow**
   - Create changesets on each branch
   - Verify version generation and vendordep.json updates
   - Check git tag creation

6. **Document for your team**
   - Which branch to use for different types of changes
   - How the version numbers work across streams
   - Release coordination processes

## Additional Resources

- [Changesets Repository](https://github.com/changesets/changesets)
- [Config Options Documentation](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md)
- [Changesets GitHub Action](https://github.com/changesets/action)
- [Private Packages Documentation](https://github.com/changesets/changesets/blob/main/docs/versioning-apps.md)

## Conclusion

Changesets **perfectly supports multiple release streams for version management** without any npm publishing complexity. This approach gives you:

1. **Clean version numbers** (2025.1.0, 2026.2.0, 2027.0.1)
2. **Independent release streams** with proper changelogs
3. **Automatic vendordep.json updates** via simple scripts
4. **Git tagging** for releases
5. **Simple workflows** without prerelease complexity
6. **Branch-based isolation** for different development streams

The key insight is that Changesets works excellently for version management even without npm publishing. The `privatePackages` configuration tells Changesets to handle versioning and tagging while skipping the publish logic entirely.

With this setup, you can have:
- Stable v2025 releases on `main` 
- Independent v2026 releases on the `2026` branch
- Cutting-edge v2027 releases on the `2027` branch

All managed through the same Changesets workflow, with automatic `vendordep.json` synchronization and proper changelog generation per stream.