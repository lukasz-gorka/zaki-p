#!/bin/bash

# Module Generator Script
# Usage: ./scripts/create-module.sh ModuleName "Description"
# Example: ./scripts/create-module.sh Calculator "Simple calculator module"

set -e

# Check if module name is provided
if [ -z "$1" ]; then
    echo "Error: Module name required"
    echo "Usage: ./scripts/create-module.sh ModuleName \"Description\""
    exit 1
fi

MODULE_NAME="$1"
MODULE_DESCRIPTION="${2:-A new module}"
MODULE_ID=$(echo "$MODULE_NAME" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')
MODULE_DIR="src/modules/${MODULE_ID}"

echo "Creating module: $MODULE_NAME"
echo "Module ID: $MODULE_ID"
echo "Directory: $MODULE_DIR"
echo ""

# Check if module already exists
if [ -d "$MODULE_DIR" ]; then
    echo "Error: Module directory already exists: $MODULE_DIR"
    exit 1
fi

# Create directory structure
echo "Creating directory structure..."
mkdir -p "$MODULE_DIR/interfaces"
mkdir -p "$MODULE_DIR/view"

# Create state interface
echo "Creating state interface..."
cat > "$MODULE_DIR/interfaces/I${MODULE_NAME}State.ts" << EOF
/**
 * ${MODULE_NAME} Module State
 */
export interface I${MODULE_NAME}State {
    // Add your state properties here
    enabled: boolean;
    items: string[];
}
EOF

# Create module class
echo "Creating module class..."
cat > "$MODULE_DIR/${MODULE_NAME}Module.ts" << EOF
import {Logger} from "../../logger/Logger.ts";
import {BaseModule} from "../core/BaseModule.ts";
import type {IModuleDependencyContainer} from "../core/interfaces/IModuleDependencies.ts";
import type {I${MODULE_NAME}State} from "./interfaces/I${MODULE_NAME}State.ts";
import {manifest} from "./module.manifest.ts";

/**
 * ${MODULE_NAME} Module
 * ${MODULE_DESCRIPTION}
 */
export class ${MODULE_NAME}Module extends BaseModule {
    readonly id = "${MODULE_ID}";

    constructor(deps: IModuleDependencyContainer) {
        super(deps);
        this.manifest = manifest;
    }

    // State management helpers
    private getState(): I${MODULE_NAME}State {
        return this.dependencies.getModuleState<I${MODULE_NAME}State>(this.id);
    }

    private updateState(
        updater: Partial<I${MODULE_NAME}State> | ((state: I${MODULE_NAME}State) => I${MODULE_NAME}State)
    ): void {
        this.dependencies.updateModuleState(this.id, updater);
    }

    // Business logic methods
    public getItems(): string[] {
        return this.getState().items;
    }

    public addItem(item: string): void {
        this.updateState((state) => ({
            ...state,
            items: [...state.items, item],
        }));
    }

    async initialize(): Promise<void> {
        await super.initialize();

        // Command handlers (auto-namespaced to "module:${MODULE_ID}:*")
        this.dependencies.events.on("open-${MODULE_ID}", async () => {
            Logger.info("[${MODULE_NAME}Module] Opening ${MODULE_ID}");
            // TODO: Implement command
        });

        Logger.info("[${MODULE_NAME}Module] Initialized");
    }

    async destroy(): Promise<void> {
        await super.destroy();
        Logger.info("[${MODULE_NAME}Module] Destroyed");
    }
}
EOF

# Create manifest
echo "Creating manifest..."
cat > "$MODULE_DIR/module.manifest.ts" << EOF
import type {IModuleManifest} from "../core/interfaces/IModuleManifest.ts";
import type {I${MODULE_NAME}State} from "./interfaces/I${MODULE_NAME}State.ts";

/**
 * ${MODULE_NAME} Module Manifest
 */
export const manifest: IModuleManifest<I${MODULE_NAME}State> = {
    id: "${MODULE_ID}",
    name: "${MODULE_NAME}",
    version: "1.0.0",
    description: "${MODULE_DESCRIPTION}",

    // Default state
    state: {
        defaultState: {
            enabled: true,
            items: [],
        },
    },

    // Integration
    integration: {
        commandPanelActions: [
            {
                id: "open-${MODULE_ID}",
                label: "Open ${MODULE_NAME}",
                description: "${MODULE_DESCRIPTION}",
                icon: "AppWindow",
                action: "open-${MODULE_ID}",
                type: "execute",
                keywords: ["${MODULE_ID}"],
            },
        ],
    },
};
EOF

# Create basic view (optional)
echo "Creating view component..."
cat > "$MODULE_DIR/view/${MODULE_NAME}View.tsx" << EOF
import {useEffect, useState} from "react";

/**
 * ${MODULE_NAME} View Component
 */
export function ${MODULE_NAME}View() {
    const [items, setItems] = useState<string[]>([]);

    useEffect(() => {
        // TODO: Load data from module
    }, []);

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">${MODULE_NAME}</h1>
            <p className="text-gray-600">${MODULE_DESCRIPTION}</p>

            {/* TODO: Implement view */}
        </div>
    );
}
EOF

echo ""
echo "✅ Module structure created successfully!"
echo ""
echo "Next steps:"
echo "1. Add module to src/modules/modules.config.ts:"
echo ""
echo "   import {${MODULE_NAME}Module} from \"./${MODULE_ID}/${MODULE_NAME}Module.ts\";"
echo ""
echo "   export const MODULES_CONFIG = ["
echo "       // ... existing modules"
echo "       {"
echo "           id: \"${MODULE_ID}\","
echo "           name: \"${MODULE_NAME}\","
echo "           enabled: true,"
echo "           factory: (deps) => new ${MODULE_NAME}Module(deps),"
echo "       },"
echo "   ];"
echo ""
echo "2. Implement module logic in: $MODULE_DIR/${MODULE_NAME}Module.ts"
echo "3. Update state interface in: $MODULE_DIR/interfaces/I${MODULE_NAME}State.ts"
echo "4. Customize manifest in: $MODULE_DIR/module.manifest.ts"
echo "5. Build view components in: $MODULE_DIR/view/"
echo ""
echo "📚 See docs/MODULE_DEVELOPMENT.md for detailed guide"
echo ""
