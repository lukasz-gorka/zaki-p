import {StoreManager} from "../../appInitializer/store/StoreManager.ts";
import type {LicenseStatus} from "../interfaces/ILicenseState.ts";

export class LicenseStoreManager extends StoreManager<"license"> {
    constructor() {
        super("license");
    }

    public setStatus = (status: LicenseStatus, errorMessage?: string) => {
        this.updateState((license) => ({
            ...license,
            status,
            errorMessage: errorMessage ?? null,
        }));
    };

    public setActiveLicense = (data: {
        plan: string;
        features: string[];
        expiresAt: string | null;
        cachedUntil: string | null;
        keyPrefix: string | null;
        lastValidated: string | null;
    }) => {
        this.updateState({
            status: "active" as const,
            ...data,
            errorMessage: null,
        });
    };

    public clearLicense = () => {
        this.updateState({
            status: "inactive",
            plan: null,
            features: [],
            expiresAt: null,
            cachedUntil: null,
            keyPrefix: null,
            lastValidated: null,
            errorMessage: null,
        });
    };
}
