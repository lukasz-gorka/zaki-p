export type LicenseStatus = "unchecked" | "checking" | "active" | "expired" | "invalid" | "inactive";

export interface ILicenseState {
    status: LicenseStatus;
    plan: string | null;
    features: string[];
    expiresAt: string | null;
    cachedUntil: string | null;
    keyPrefix: string | null;
    lastValidated: string | null;
    errorMessage: string | null;
}

export const DEFAULT_LICENSE_STATE: ILicenseState = {
    status: "unchecked",
    plan: null,
    features: [],
    expiresAt: null,
    cachedUntil: null,
    keyPrefix: null,
    lastValidated: null,
    errorMessage: null,
};
