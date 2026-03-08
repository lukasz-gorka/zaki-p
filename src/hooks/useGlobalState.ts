import {store} from "../appInitializer/store";
import {IGlobalState} from "../appInitializer/store/interfaces/IGlobalState.ts";

export function useGlobalState<K extends keyof IGlobalState>(
    key: K,
): [IGlobalState[K], (value: Partial<IGlobalState[K]> | ((prev: IGlobalState[K], state: IGlobalState) => IGlobalState[K])) => void] {
    const slice = store((state) => state[key]);

    const setSlice = (valueOrFn: Partial<IGlobalState[K]> | ((prev: IGlobalState[K], state: IGlobalState) => IGlobalState[K])) => {
        store.setState((state) => ({
            ...state,
            [key]:
                typeof valueOrFn === "function"
                    ? (valueOrFn as (prev: IGlobalState[K], state: IGlobalState) => IGlobalState[K])(state[key], state)
                    : {
                          ...state[key],
                          ...valueOrFn,
                      },
        }));
    };

    return [slice, setSlice];
}
