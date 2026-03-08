import "../../public/css/style.css";
import {useEffect} from "react";
import {BrowserRouter, Navigate, Route, Routes} from "react-router-dom";

import {G} from "../appInitializer/module/G.ts";
import {StateAutoSaver} from "../appInitializer/StateAutoSaver.ts";
import {Logger} from "../logger/Logger.ts";
import {ROUTE_PATH} from "../navigation/const/ROUTE_PATH.ts";
import {PluginRegistry} from "../plugins/PluginRegistry.ts";

import {GeneralSettingsPageView} from "./pages/settings/GeneralSettingsPageView.tsx";
import {LicenseSettingsPageView} from "./pages/settings/LicenseSettingsPageView.tsx";
import {VoiceSettingsPageView} from "./pages/settings/VoiceSettingsPageView.tsx";
import {UnifiedModelsPageView} from "./pages/UnifiedModelsPageView.tsx";
import {VoiceHistoryView} from "./pages/VoiceHistoryView.tsx";
import {VoiceHomeView} from "./pages/VoiceHomeView.tsx";
import Layout from "./templates/Layout.tsx";
import {SettingsLayout} from "./templates/SettingsLayout.tsx";

import {ErrorBoundary} from "./ui/ErrorBoundary.tsx";

function Root() {
    useEffect(() => {
        const handleBeforeUnload = async () => {
            try {
                await StateAutoSaver.forceSave();
                await G.globalShortcuts.clearAllShortcuts();
            } catch (error) {
                Logger.error("Failed to cleanup on unload", {error});
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    const pluginRoutes = PluginRegistry.getRoutes();
    const pluginSettingsRoutes = PluginRegistry.getSettingsRoutes();

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <Routes>
                    <Route path={ROUTE_PATH.HOME} element={<Layout />}>
                        <Route index element={<Navigate to={PluginRegistry.getDefaultRoute() || ROUTE_PATH.VOICE} replace />} />
                        <Route path={ROUTE_PATH.VOICE} element={<VoiceHomeView />} />
                        <Route path={ROUTE_PATH.HISTORY} element={<VoiceHistoryView />} />

                        <Route path="settings" element={<SettingsLayout />}>
                            <Route index element={<Navigate to="general" replace />} />
                            <Route path="general" element={<GeneralSettingsPageView />} />
                            <Route path="models" element={<UnifiedModelsPageView />} />
                            <Route path="voice" element={<VoiceSettingsPageView />} />
                            <Route path="advanced" element={<Navigate to="general" replace />} />
                            <Route path="license" element={<LicenseSettingsPageView />} />
                            {pluginSettingsRoutes.map((route) => (
                                <Route key={route.path} path={route.path} element={<route.component />} />
                            ))}
                        </Route>

                        {/* Old path redirects */}
                        <Route path="/models" element={<Navigate to={ROUTE_PATH.MODELS} replace />} />
                        <Route path="/voice-settings" element={<Navigate to={ROUTE_PATH.VOICE_SETTINGS} replace />} />

                        {pluginRoutes.map((route) => (
                            <Route key={route.path} path={route.path} element={<route.component />} />
                        ))}

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default Root;
