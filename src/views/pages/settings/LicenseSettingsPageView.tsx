import {KeyRound} from "lucide-react";
import {ContentPageLayout} from "../../templates/ContentPageLayout.tsx";
import {LicenseSection} from "./LicenseSection.tsx";

export function LicenseSettingsPageView() {
    return (
        <ContentPageLayout title="License" icon={KeyRound} description="Manage your zakip-voice Pro license">
            <LicenseSection />
        </ContentPageLayout>
    );
}
