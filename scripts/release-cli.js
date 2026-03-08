#!/usr/bin/env node

/**
 * Interactive Release CLI
 * Guides you through the release process with prompts
 */

import {select, checkbox, input, confirm} from "@inquirer/prompts";
import chalk from "chalk";
import semver from "semver";
import {execSync, spawn} from "child_process";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Helper functions
function getPackageVersion() {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    return pkg.version;
}

function exec(cmd, options = {}) {
    try {
        return execSync(cmd, {encoding: "utf8", cwd: projectRoot, ...options}).trim();
    } catch (e) {
        return null;
    }
}

function tagExists(tag) {
    const result = exec(`git tag -l "${tag}"`);
    return result === tag;
}

function getPlatformVersions() {
    // Try to fetch from server or use local info
    const versions = {macos: null, windows: null, linux: null};

    // Look at recent tags to determine platform versions
    const tags = exec("git tag -l 'v*' --sort=-version:refname") || "";
    const tagList = tags.split("\n").filter(Boolean);

    // First check for platform-specific tags (new format: v0.9.41-macos)
    for (const platform of ["macos", "windows", "linux"]) {
        const platformTag = tagList.find((t) => t.includes(`-${platform}`));
        if (platformTag) {
            const match = platformTag.match(/^v(\d+\.\d+\.\d+)-/);
            if (match) {
                versions[platform] = match[1];
            }
        }
    }

    // If no platform-specific tags found, use generic tags (old format: v0.9.40)
    // Assume old releases were for all platforms
    const hasAnyPlatformVersion = Object.values(versions).some((v) => v !== null);
    if (!hasAnyPlatformVersion) {
        const genericTag = tagList.find((t) => /^v\d+\.\d+\.\d+$/.test(t));
        if (genericTag) {
            const match = genericTag.match(/^v(\d+\.\d+\.\d+)$/);
            if (match) {
                // Old tags were all-platform releases
                versions.macos = match[1];
                versions.windows = match[1];
                versions.linux = match[1];
            }
        }
    }

    return versions;
}

function isOnMac() {
    return process.platform === "darwin";
}

function checkGhCli() {
    const installed = exec("which gh");
    if (!installed) {
        return {installed: false, authenticated: false};
    }
    const authStatus = exec("gh auth status 2>&1");
    return {
        installed: true,
        authenticated: authStatus && !authStatus.includes("not logged"),
    };
}

// Main CLI
async function main() {
    console.log("");
    console.log(chalk.blue.bold("  Release CLI for zakip voice"));
    console.log(chalk.gray("  ─────────────────────────────────────"));
    console.log("");

    // Current state
    const currentVersion = getPackageVersion();
    const platformVersions = getPlatformVersions();
    const onMac = isOnMac();
    const gh = checkGhCli();

    // Show current state
    console.log(chalk.white("  Current state:"));
    console.log(chalk.gray(`    Package version: ${chalk.yellow(currentVersion)}`));
    console.log("");
    console.log(chalk.white("  Platform versions (from tags):"));
    console.log(
        chalk.gray(
            `    macOS:   ${platformVersions.macos ? chalk.green(platformVersions.macos) : chalk.dim("not released")}`
        )
    );
    console.log(
        chalk.gray(
            `    Windows: ${platformVersions.windows ? chalk.green(platformVersions.windows) : chalk.dim("not released")}`
        )
    );
    console.log(
        chalk.gray(
            `    Linux:   ${platformVersions.linux ? chalk.green(platformVersions.linux) : chalk.dim("not released")}`
        )
    );
    console.log("");

    if (!gh.installed) {
        console.log(chalk.red("  GitHub CLI (gh) is not installed."));
        console.log(chalk.gray("  Install with: brew install gh"));
        process.exit(1);
    }
    if (!gh.authenticated) {
        console.log(chalk.red("  GitHub CLI is not authenticated."));
        console.log(chalk.gray("  Run: gh auth login"));
        process.exit(1);
    }

    // Helper to increment version
    const incVersion = (ver, type) => {
        const clean = semver.clean(ver) || ver;
        const result = semver.inc(clean, type);
        if (result) return result;
        // Fallback
        const parts = ver.split(".").map(Number);
        if (type === "patch") parts[2]++;
        else if (type === "minor") {
            parts[1]++;
            parts[2] = 0;
        } else if (type === "major") {
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
        }
        return parts.join(".");
    };

    // Version selection
    const versionChoice = await select({
        message: "What version do you want to release?",
        choices: [
            {
                name: `Patch  ${chalk.yellow(currentVersion)} → ${chalk.green(incVersion(currentVersion, "patch"))}  ${chalk.dim("(bug fixes)")}`,
                value: "patch",
            },
            {
                name: `Minor  ${chalk.yellow(currentVersion)} → ${chalk.green(incVersion(currentVersion, "minor"))}  ${chalk.dim("(new features)")}`,
                value: "minor",
            },
            {
                name: `Major  ${chalk.yellow(currentVersion)} → ${chalk.green(incVersion(currentVersion, "major"))}  ${chalk.dim("(breaking changes)")}`,
                value: "major",
            },
            {
                name: `Current version ${chalk.yellow(currentVersion)}  ${chalk.dim("(add platforms only)")}`,
                value: "current",
            },
            {
                name: chalk.dim("Enter custom version..."),
                value: "custom",
            },
        ],
        default: "patch",
    });

    let newVersion;
    if (versionChoice === "custom") {
        newVersion = await input({
            message: "Enter version number:",
            validate: (value) => {
                if (semver.valid(value)) return true;
                return "Please enter a valid semver version (e.g., 1.2.3)";
            },
        });
    } else if (versionChoice === "current") {
        newVersion = currentVersion;
    } else {
        // semver.inc needs clean version
        const cleanVersion = semver.clean(currentVersion) || currentVersion;
        newVersion = semver.inc(cleanVersion, versionChoice);
        if (!newVersion) {
            // Fallback: manual increment
            const parts = currentVersion.split(".").map(Number);
            if (versionChoice === "patch") parts[2]++;
            else if (versionChoice === "minor") {
                parts[1]++;
                parts[2] = 0;
            } else if (versionChoice === "major") {
                parts[0]++;
                parts[1] = 0;
                parts[2] = 0;
            }
            newVersion = parts.join(".");
        }
    }

    console.log("");

    // Platform selection
    const platformChoices = [
        {
            name: `macOS   ${platformVersions.macos === newVersion ? chalk.dim("(already at " + newVersion + ")") : ""}`,
            value: "macos",
            checked: true,
            disabled: platformVersions.macos === newVersion ? "already released" : false,
        },
        {
            name: `Windows ${platformVersions.windows === newVersion ? chalk.dim("(already at " + newVersion + ")") : ""}`,
            value: "windows",
            checked: false,
            disabled: platformVersions.windows === newVersion ? "already released" : false,
        },
        {
            name: `Linux   ${platformVersions.linux === newVersion ? chalk.dim("(already at " + newVersion + ")") : ""}`,
            value: "linux",
            checked: false,
            disabled: platformVersions.linux === newVersion ? "already released" : false,
        },
    ];

    // Check if all platforms are disabled
    const allDisabled = platformChoices.every((choice) => choice.disabled);
    if (allDisabled) {
        console.log("");
        console.log(
            chalk.yellow(
                `  All platforms are already at version ${newVersion}.`
            )
        );
        const rebuildAnyway = await confirm({
            message: "Do you want to rebuild and re-release this version?",
            default: true,
        });

        if (!rebuildAnyway) {
            console.log(chalk.gray("\n  Cancelled."));
            process.exit(0);
        }

        // Enable all platforms for rebuild
        platformChoices.forEach((choice) => {
            choice.disabled = false;
            choice.checked = true;
        });
    }

    const platforms = await checkbox({
        message: "Which platforms to build?",
        choices: platformChoices,
        validate: (answer) => {
            if (answer.length < 1) {
                return "You must choose at least one platform.";
            }
            return true;
        },
    });

    // Build method for macOS
    let macosLocal = false;
    if (platforms.includes("macos") && onMac) {
        const buildMethod = await select({
            message: "How to build macOS?",
            choices: [
                {
                    name: `Local build ${chalk.dim("(faster, saves CI costs)")}`,
                    value: "local",
                },
                {
                    name: `GitHub Actions ${chalk.dim("(CI/CD)")}`,
                    value: "ci",
                },
            ],
            default: "local",
        });
        macosLocal = buildMethod === "local";
    }

    // Check for existing tags
    const existingTags = [];
    for (const platform of platforms) {
        const tag = `v${newVersion}-${platform}`;
        if (tagExists(tag)) {
            existingTags.push(tag);
        }
    }

    if (existingTags.length > 0) {
        console.log("");
        console.log(chalk.yellow(`  Warning: These tags already exist:`));
        existingTags.forEach((tag) => console.log(chalk.yellow(`    - ${tag}`)));

        const handleExisting = await select({
            message: "What do you want to do?",
            choices: [
                {name: "Delete existing tags and re-release", value: "delete"},
                {name: "Skip platforms with existing tags", value: "skip"},
                {name: "Cancel", value: "cancel"},
            ],
        });

        if (handleExisting === "cancel") {
            console.log(chalk.gray("\n  Cancelled."));
            process.exit(0);
        }

        if (handleExisting === "skip") {
            for (const tag of existingTags) {
                const platform = tag.split("-").pop();
                const idx = platforms.indexOf(platform);
                if (idx > -1) {
                    platforms.splice(idx, 1);
                    console.log(chalk.gray(`  Skipping ${platform}`));
                }
            }
            if (platforms.length === 0) {
                console.log(chalk.yellow("\n  No platforms left to build."));
                process.exit(0);
            }
        }

        if (handleExisting === "delete") {
            for (const tag of existingTags) {
                console.log(chalk.gray(`  Deleting tag ${tag}...`));
                exec(`git tag -d "${tag}"`, {stdio: "ignore"});
                exec(`git push origin --delete "${tag}"`, {stdio: "ignore"});
            }
        }
    }

    // Summary
    console.log("");
    console.log(chalk.white("  Summary:"));
    console.log(chalk.gray("  ─────────────────────────────────────"));
    console.log(
        chalk.gray(
            `    Version: ${currentVersion !== newVersion ? chalk.yellow(currentVersion) + " → " : ""}${chalk.green(newVersion)}`
        )
    );
    console.log(chalk.gray(`    Platforms:`));
    for (const platform of platforms) {
        const method =
            platform === "macos" && macosLocal ? chalk.cyan(" (local)") : chalk.dim(" (CI/CD)");
        console.log(chalk.gray(`      - ${platform}${method}`));
    }
    console.log("");

    const shouldProceed = await confirm({
        message: "Proceed with release?",
        default: true,
    });

    if (!shouldProceed) {
        console.log(chalk.gray("\n  Cancelled."));
        process.exit(0);
    }

    // Execute release
    console.log("");

    // 1. Update version if changed
    if (currentVersion !== newVersion) {
        console.log(chalk.blue(`  Updating version to ${newVersion}...`));
        execSync(`node scripts/set-version.js ${newVersion}`, {cwd: projectRoot, stdio: "inherit"});

        console.log(chalk.blue("  Committing version change..."));
        execSync("git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml", {
            cwd: projectRoot,
        });
        execSync(`git commit -m "chore: bump version to ${newVersion}"`, {cwd: projectRoot});
    }

    // 2. Create tags
    console.log(chalk.blue("  Creating tags..."));
    for (const platform of platforms) {
        const tag = `v${newVersion}-${platform}`;
        execSync(`git tag -a "${tag}" -m "Release v${newVersion} for ${platform}"`, {
            cwd: projectRoot,
        });
        console.log(chalk.gray(`    Created: ${tag}`));
    }

    // 3. Push
    console.log(chalk.blue("  Pushing to remote..."));
    execSync("git push", {cwd: projectRoot, stdio: "inherit"});
    execSync("git push --tags", {cwd: projectRoot, stdio: "inherit"});

    // 4. Trigger builds
    console.log("");
    console.log(chalk.blue("  Triggering builds..."));

    // macOS local build
    if (platforms.includes("macos") && macosLocal) {
        console.log(chalk.cyan("\n  Building macOS locally..."));
        console.log(chalk.gray("  This may take a few minutes.\n"));

        const buildProcess = spawn(
            "bash",
            ["scripts/build-macos-local.sh", "--version", newVersion, "--deploy"],
            {
                cwd: projectRoot,
                stdio: "inherit",
            }
        );

        await new Promise((resolve, reject) => {
            buildProcess.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Build failed with code ${code}`));
            });
        });
    } else if (platforms.includes("macos")) {
        console.log(chalk.gray("    Triggering macOS CI build..."));
        execSync(`gh workflow run build-macos.yml -f version=${newVersion}`, {cwd: projectRoot});
    }

    // Windows/Linux CI builds
    if (platforms.includes("windows")) {
        console.log(chalk.gray("    Triggering Windows CI build..."));
        execSync(`gh workflow run build-windows.yml -f version=${newVersion}`, {cwd: projectRoot});
    }

    if (platforms.includes("linux")) {
        console.log(chalk.gray("    Triggering Linux CI build..."));
        execSync(`gh workflow run build-linux.yml -f version=${newVersion}`, {cwd: projectRoot});
    }

    // Done
    console.log("");
    console.log(chalk.green.bold("  Release initiated successfully!"));
    console.log("");

    const ciPlatforms = platforms.filter((p) => !(p === "macos" && macosLocal));
    if (ciPlatforms.length > 0) {
        const repoUrl = exec("git remote get-url origin")
            ?.replace(/\.git$/, "")
            .replace("git@github.com:", "https://github.com/");
        console.log(chalk.white("  Monitor CI builds:"));
        console.log(chalk.gray(`    ${repoUrl}/actions`));
        console.log(chalk.gray("    gh run watch"));
    }

    console.log("");
}

main().catch((err) => {
    console.error(chalk.red("\n  Error:"), err.message);
    process.exit(1);
});
