import react from "@vitejs/plugin-react";
import path from "path";
import {defineConfig, loadEnv} from "vite";

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        define: {
            __LICENSE_URL__: JSON.stringify(env.LICENSE_URL ?? ""),
        },
        plugins: [react()],
        build: {
            target: "esnext",
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index.html"),
                    "recording-popup": path.resolve(__dirname, "recording-popup.html"),
                    popup: path.resolve(__dirname, "popup.html"),
                    "quick-chat-popup": path.resolve(__dirname, "quick-chat-popup.html"),
                },
            },
        },
        clearScreen: false,
        server: {
            port: 1421,
            strictPort: true,
        },
    };
});
