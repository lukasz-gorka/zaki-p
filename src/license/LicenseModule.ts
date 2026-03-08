import {G} from "../appInitializer/module/G.ts";
import {Logger} from "../logger/Logger.ts";
import {LICENSE_BACKEND_URL} from "./const.ts";
import {LicenseStoreManager} from "./store/LicenseStoreManager.ts";

const REVALIDATION_INTERVAL = 60 * 60 * 1000; // 1 hour

export class LicenseModule {
    private store: LicenseStoreManager;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    constructor(store: LicenseStoreManager) {
        this.store = store;
    }

    async init(): Promise<void> {
        try {
            const cached = await G.rustProxy.getLicenseCached();
            if (cached) {
                this.store.setActiveLicense({
                    plan: cached.plan,
                    features: cached.features,
                    expiresAt: cached.expires_at,
                    cachedUntil: cached.cache_until,
                    keyPrefix: cached.key_prefix,
                    lastValidated: cached.validated_at,
                });
                Logger.info(`[License] Loaded cached license: ${cached.plan}`);
                this.startPeriodicCheck();
            } else {
                const storedKey = await G.rustProxy.getStoredLicenseKey();
                if (storedKey) {
                    // Cache expired but key exists — try background revalidation
                    this.revalidateIfNeeded().catch(() => {
                        this.store.setStatus("inactive");
                    });
                } else {
                    this.store.setStatus("inactive");
                }
            }
        } catch (error) {
            Logger.error("[License] Init failed", {error});
            this.store.setStatus("inactive");
        }
    }

    async activateKey(key: string): Promise<boolean> {
        this.store.setStatus("checking");
        try {
            const response = await G.rustProxy.validateLicense(key, LICENSE_BACKEND_URL);
            if (response.valid && response.plan) {
                this.store.setActiveLicense({
                    plan: response.plan,
                    features: response.features ?? [],
                    expiresAt: response.expires_at,
                    cachedUntil: response.cache_until,
                    keyPrefix: key.substring(0, 8) + "...",
                    lastValidated: new Date().toISOString(),
                });
                Logger.info(`[License] Activated: ${response.plan}`);
                window.location.reload();
                return true;
            } else {
                this.store.setStatus("invalid", response.error ?? response.message ?? "Invalid license key");
                return false;
            }
        } catch (error) {
            this.store.setStatus("invalid", `Validation failed: ${error}`);
            return false;
        }
    }

    async deactivateKey(): Promise<void> {
        try {
            await G.rustProxy.deactivateLicense(LICENSE_BACKEND_URL);
        } catch (error) {
            Logger.error("[License] Deactivation request failed", {error});
        }
        this.store.clearLicense();
        Logger.info("[License] Deactivated");
        window.location.reload();
    }

    isProActive(): boolean {
        return this.store.state().status === "active";
    }

    hasFeature(featureId: string): boolean {
        const state = this.store.state();
        return state.status === "active" && state.features.includes(featureId);
    }

    private startPeriodicCheck(): void {
        if (this.intervalId) return;
        this.intervalId = setInterval(async () => {
            const cached = await G.rustProxy.getLicenseCached();
            if (!cached) {
                // Cache expired — revalidate
                Logger.info("[License] Cache expired, revalidating...");
                await this.revalidateIfNeeded();
            }
        }, REVALIDATION_INTERVAL);
    }

    async revalidateIfNeeded(): Promise<void> {
        const storedKey = await G.rustProxy.getStoredLicenseKey();
        if (!storedKey) return;

        try {
            const response = await G.rustProxy.validateLicense(storedKey, LICENSE_BACKEND_URL);
            if (response.valid && response.plan) {
                this.store.setActiveLicense({
                    plan: response.plan,
                    features: response.features ?? [],
                    expiresAt: response.expires_at,
                    cachedUntil: response.cache_until,
                    keyPrefix: storedKey.substring(0, 8) + "...",
                    lastValidated: new Date().toISOString(),
                });
            } else {
                this.store.setStatus("expired", response.message ?? "License expired");
            }
        } catch (error) {
            Logger.warn("[License] Revalidation failed", {error});
            this.store.setStatus("invalid", `Revalidation failed: ${error}`);
        }
    }
}
