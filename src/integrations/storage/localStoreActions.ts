import {Logger} from "../../logger/Logger.ts";
import {LocalStoreKey} from "./consts/LocalStoreKey.ts";
import {createDefaultAppData, IAppLocalData} from "./interfaces/IAppLocalData.ts";
import {getAppStore} from "./localStoreInit.ts";

export const setLocalDataByKey = async <T>(key: LocalStoreKey, state: T) => {
    const store = await getAppStore();
    await handleError(store.set(key, state));
    await saveLocalData();
};

export async function getAppData(): Promise<IAppLocalData> {
    const store = await getAppStore();
    const data = (await handleError(store.get<IAppLocalData>(LocalStoreKey.APP_DATA))) as IAppLocalData | undefined;

    if (!data) {
        return createDefaultAppData();
    }

    return {
        ...data,
        meta: data.meta || {version: 0, lastUpdated: new Date().toISOString()},
    };
}

const handleError = async <T>(promise: Promise<T>): Promise<T | undefined> => {
    try {
        return await promise;
    } catch (error) {
        console.trace(error);
        Logger.error("Local store operation failed", {error});
    }
};

const saveLocalData = async () => {
    const store = await getAppStore();
    await handleError(store.save());
};
