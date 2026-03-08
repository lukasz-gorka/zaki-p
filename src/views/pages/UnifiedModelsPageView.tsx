import {Bot, HardDrive, Info} from "lucide-react";
import {NavLink} from "react-router-dom";
import {ROUTE_PATH} from "../../navigation/const/ROUTE_PATH.ts";
import {AISettingsView} from "../settings/AISettingsView.tsx";
import {LocalModelsView} from "../settings/LocalModelsView.tsx";
import {Alert, AlertDescription} from "../ui/alert.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs.tsx";

export function UnifiedModelsPageView() {
    return (
        <div className="flex flex-col gap-6">
            <Tabs defaultValue="api">
                <TabsList>
                    <TabsTrigger value="api">
                        <Bot className="w-4 h-4" />
                        API
                    </TabsTrigger>
                    <TabsTrigger value="local">
                        <HardDrive className="w-4 h-4" />
                        Local
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="api">
                    <AISettingsView />
                </TabsContent>
                <TabsContent value="local">
                    <LocalModelsView />
                    <Alert variant="info" className="mt-6">
                        <Info className="w-4 h-4" />
                        <AlertDescription>
                            For AI-powered text enhancement after transcription, add a cloud provider with text models and configure the Enhancer skill in{" "}
                            <NavLink to={ROUTE_PATH.SKILLS} className="text-brand hover:underline">
                                Skills
                            </NavLink>
                            .
                        </AlertDescription>
                    </Alert>
                </TabsContent>
            </Tabs>
        </div>
    );
}
