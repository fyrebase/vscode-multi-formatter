#!/usr/bin/env node

/**
 * Cross-platform build script for the multiformatter extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure we're in the extension directory
const scriptDir = __dirname;
process.chdir(scriptDir);
console.log(`Building Multi-Formatter VS Code Extension...`);
console.log(`Working directory: ${process.cwd()}`);

// Get version type from command line args
const args = process.argv.slice(2);
// Filter out flags for version determination
const skipDeps = args.includes('--skip-deps');
const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
const versionType = nonFlagArgs[0] || 'patch';

console.log(`Running with options: versionType=${versionType}, skipDeps=${skipDeps}`);

try {
    // Check if vsce is installed
    try {
        execSync('vsce --version', { stdio: 'ignore' });
    } catch (error) {
        console.log('Installing vsce tool...');
        execSync('npm install -g @vscode/vsce', { stdio: 'inherit' });
    }

    // Step 1: Bump the version
    console.log(`\nBumping ${versionType} version...`);
    const packageJsonPath = path.join(scriptDir, 'package.json');

    // Read the package.json file
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`Current version: ${currentVersion}`);

    // Parse the current version
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    // Calculate new version
    let newVersion;
    if (versionType === 'major') {
        newVersion = `${major + 1}.0.0`;
        console.log(`Bumping major version to ${newVersion}`);
    } else if (versionType === 'minor') {
        newVersion = `${major}.${minor + 1}.0`;
        console.log(`Bumping minor version to ${newVersion}`);
    } else if (versionType === 'custom' && nonFlagArgs[1]) {
        newVersion = nonFlagArgs[1];
        console.log(`Setting custom version: ${newVersion}`);
    } else {
        // Default to patch
        newVersion = `${major}.${minor}.${patch + 1}`;
        console.log(`Bumping patch version to ${newVersion}`);
    }

    // Update the package.json file
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`Updated version in package.json to ${newVersion}`);

    // Update README.md if there are hard-coded version references
    try {
        const readmePath = path.join(scriptDir, 'README.md');
        if (fs.existsSync(readmePath)) {
            const readmeContent = fs.readFileSync(readmePath, 'utf8');
            const updatedReadme = readmeContent.replace(
                /multiformatter-[0-9]+\.[0-9]+\.[0-9]+\.vsix/g,
                `multiformatter-${newVersion}.vsix`
            );
            fs.writeFileSync(readmePath, updatedReadme);
            console.log('Updated version references in README.md');
        }
    } catch (error) {
        console.warn('Could not update README.md:', error.message);
    }

    // Step 2: Install dependencies (skip if requested)
    if (!skipDeps) {
        console.log('\nInstalling dependencies...');
        try {
            execSync('npm install', { stdio: 'inherit' });
        } catch (error) {
            console.warn('npm install failed, continuing with existing dependencies:', error.message);
        }
    } else {
        console.log('\nSkipping dependency installation (--skip-deps flag detected)');
    }

    // Step 3: Build the extension
    console.log('\nCompiling the extension...');
    execSync('npm run compile', { stdio: 'inherit' });

    // Step 4: Package as VSIX
    console.log('\nCreating VSIX package...');
    execSync('npm run vsix', { stdio: 'inherit' });

    // Step 5: Rename the VSIX file
    const expectedVsixName = `multiformatter-${newVersion}.vsix`;

    // Find the VSIX file
    const files = fs.readdirSync(scriptDir).filter(file => file.match(/multiformatter-.*\.vsix/));

    if (files.length > 0) {
        // Sort by creation time (newest first)
        files.sort((a, b) => {
            return fs.statSync(path.join(scriptDir, b)).mtime.getTime() -
                fs.statSync(path.join(scriptDir, a)).mtime.getTime();
        });

        const latestVsix = files[0];

        // Only rename if necessary
        if (latestVsix !== expectedVsixName) {
            console.log(`Renaming ${latestVsix} to ${expectedVsixName}`);
            fs.renameSync(
                path.join(scriptDir, latestVsix),
                path.join(scriptDir, expectedVsixName)
            );
        }

        console.log(`\nVSIX package created: ${expectedVsixName}`);
    } else {
        console.warn('No VSIX file found after build.');
    }

    // Step 6: Uninstall previous version if installed
    console.log('\nChecking for previous installations...');
    try {
        const extensions = execSync('code --list-extensions').toString();
        if (extensions.includes('example-publisher.multiformatter')) {
            console.log('Uninstalling previous version...');
            execSync('code --uninstall-extension example-publisher.multiformatter', {
                stdio: 'inherit'
            });
        } else {
            console.log('No previous version found.');
        }
    } catch (error) {
        console.warn('Could not check/uninstall previous version:', error.message);
    }

    // Success message
    console.log('\nBuild completed successfully!');
    console.log(`VSIX package created: ${expectedVsixName}`);
    console.log('\nTo install the extension, run:');
    console.log(`code --install-extension ${expectedVsixName}`);
    console.log('\nOr you can run:');
    console.log('npm run build-and-install');

    console.log('\nUsage:');
    console.log('  node build.js                # Builds with patch version bump (x.x.X+1)');
    console.log('  node build.js minor          # Builds with minor version bump (x.X+1.0)');
    console.log('  node build.js major          # Builds with major version bump (X+1.0.0)');
    console.log('  node build.js custom X.Y.Z   # Builds with custom version');
    console.log('  node build.js --skip-deps    # Skip dependency installation (can be combined with any version type)');

} catch (error) {
    console.error(`\nBuild failed: ${error.message}`);
    process.exit(1);
}