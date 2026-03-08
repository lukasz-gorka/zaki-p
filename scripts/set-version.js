#!/usr/bin/env node

/**
 * Script to update version in package.json and tauri.conf.json
 * Usage: node scripts/set-version.js 0.0.1
 */

import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const version = process.argv[2];

if (!version) {
    console.error("❌ Error: Version number is required");
    console.log("Usage: node scripts/set-version.js <version>");
    console.log("Example: node scripts/set-version.js 0.0.1");
    process.exit(1);
}

// Validate version format (semantic versioning)
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(version)) {
    console.error("❌ Error: Invalid version format");
    console.log("Version must follow semantic versioning (e.g., 0.0.1, 1.2.3)");
    process.exit(1);
}

try {
    // Get project root directory (one level up from scripts directory)
    const projectRoot = path.join(__dirname, "..");

    // Update package.json
    const packageJsonPath = path.join(projectRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    packageJson.version = version;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`✅ Updated package.json to version ${version}`);

    // Update tauri.conf.json
    const tauriConfPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
    console.log(`✅ Updated tauri.conf.json to version ${version}`);

    // Update Cargo.toml
    const cargoTomlPath = path.join(projectRoot, "src-tauri", "Cargo.toml");
    let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
    cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
    fs.writeFileSync(cargoTomlPath, cargoToml);
    console.log(`✅ Updated Cargo.toml to version ${version}`);

    // Update Info.plist (macOS bundle version)
    const infoPlistPath = path.join(projectRoot, "src-tauri", "Info.plist");
    if (fs.existsSync(infoPlistPath)) {
        let infoPlist = fs.readFileSync(infoPlistPath, "utf8");
        // Update CFBundleShortVersionString
        infoPlist = infoPlist.replace(
            /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
            `<key>CFBundleShortVersionString</key>\n    <string>${version}</string>`
        );
        // Update CFBundleVersion
        infoPlist = infoPlist.replace(
            /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/,
            `<key>CFBundleVersion</key>\n    <string>${version}</string>`
        );
        fs.writeFileSync(infoPlistPath, infoPlist);
        console.log(`✅ Updated Info.plist to version ${version}`);
    }

    console.log("\n📦 Version updated successfully!");
    console.log("\nNext steps:");
    console.log("1. Review the changes: git diff");
    console.log(`2. Commit the changes: git add . && git commit -m "chore: bump version to ${version}"`);
    console.log(`3. Create a tag: git tag v${version}`);
    console.log("4. Push with tags: git push && git push --tags");
    console.log("\nThis will trigger the CI/CD pipeline to build and deploy your app! 🚀");
} catch (error) {
    console.error("❌ Error updating version:", error.message);
    process.exit(1);
}
