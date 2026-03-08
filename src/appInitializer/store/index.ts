import {create} from "zustand";
import {INITIAL_GLOBAL_STATE} from "./const/INITIAL_GLOBAL_STATE.ts";
import {IGlobalState} from "./interfaces/IGlobalState.ts";

export const store = create<IGlobalState>(() => {
    return {
        ...(INITIAL_GLOBAL_STATE as IGlobalState),
    };
});
