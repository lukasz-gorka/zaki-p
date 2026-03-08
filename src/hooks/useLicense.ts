import {store} from "../appInitializer/store";
import type {ILicenseState} from "../license/interfaces/ILicenseState.ts";

export function useLicense(): {isPro: boolean; hasFeature: (id: string) => boolean; license: ILicenseState} {
    const license = store((s) => s.license);
    return {
        isPro: license.status === "active",
        hasFeature: (id: string) => license.status === "active" && license.features.includes(id),
        license,
    };
}
