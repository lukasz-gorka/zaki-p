export interface LicenseValidationResponse {
    valid: boolean;
    plan: string | null;
    expires_at: string | null;
    features: string[] | null;
    cache_until: string | null;
    signature: string | null;
    error: string | null;
    message: string | null;
}

export interface CachedLicense {
    plan: string;
    features: string[];
    expires_at: string | null;
    cache_until: string;
    validated_at: string;
    key_prefix: string;
}
