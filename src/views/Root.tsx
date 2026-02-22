import "../../public/css/style.css";
import {useEffect} from "react";
import {BrowserRouter, Navigate, Route, Routes} from "react-router-dom";

import {G} from "../appInitializer/module/G.ts";
import {StateAutoSaver} from "../appInitializer/StateAutoSaver.ts";
import {Logger} from "../logger/Logger.ts";
import {ROUTE_PATH} from "../navigation/const/ROUTE_PATH.ts";
import {EnhancerPageView} from "./pages/EnhancerPageView.tsx";

import {SettingsPageView} from "./pages/settings/SettingsPageView.tsx";
import {SpeechToSpeechPageView} from "./pages/settings/SpeechToSpeechPageView.tsx";
import {VoiceSettingsPageView} from "./pages/settings/VoiceSettingsPageView.tsx";
import {UnifiedModelsPageView} from "./pages/UnifiedModelsPageView.tsx";
import {VoiceHistoryView} from "./pages/VoiceHistoryView.tsx";
import {VoiceHomeView} from "./pages/VoiceHomeView.tsx";

import Layout from "./templates/Layout.tsx";

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

    return (
        <BrowserRouter>
            <Routes>
                <Route path={ROUTE_PATH.HOME} element={<Layout />}>
                    <Route index element={<VoiceHomeView />} />
                    <Route path={ROUTE_PATH.HISTORY} element={<VoiceHistoryView />} />
                    <Route path={ROUTE_PATH.CONVERSATIONS} element={<Navigate to={ROUTE_PATH.HISTORY} replace />} />
                    <Route path={ROUTE_PATH.MODELS} element={<UnifiedModelsPageView />} />
                    <Route path={ROUTE_PATH.ENHANCER} element={<EnhancerPageView />} />
                    <Route path={ROUTE_PATH.VOICE_SETTINGS} element={<VoiceSettingsPageView />} />
                    <Route path={ROUTE_PATH.SPEECH_TO_SPEECH} element={<SpeechToSpeechPageView />} />
                    <Route path={ROUTE_PATH.SETTINGS} element={<SettingsPageView />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default Root;
