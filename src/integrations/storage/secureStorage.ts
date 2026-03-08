import {G} from "../../appInitializer/module/G.ts";

export class SecureStorage {
    public static async set(key: string, value: string): Promise<void> {
        await G.rustProxy.secureStorageSet(key, value);
    }

    public static async get(key: string): Promise<string> {
        return G.rustProxy.secureStorageGet(key);
    }

    public static async delete(key: string): Promise<void> {
        await G.rustProxy.secureStorageDelete(key);
    }

    public static async deleteProviderApiKey(providerUuid: string): Promise<void> {
        await this.delete(`provider_${providerUuid}`);
    }

    public static async setProviderKeys(providerKeys: Record<string, string>): Promise<void> {
        await G.rustProxy.secureStorageSetProviderKeys(providerKeys);
    }

    public static async getProviderKeys(providerUuids: string[]): Promise<Record<string, string>> {
        return G.rustProxy.secureStorageGetProviderKeys(providerUuids);
    }
}
