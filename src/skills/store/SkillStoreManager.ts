import {StoreManager} from "../../appInitializer/store/StoreManager.ts";
import {IExecutingSkill, ISkill, ISkillStore} from "../interfaces/ISkill.ts";

export class SkillStoreManager extends StoreManager<"skills"> {
    constructor() {
        super("skills" as any);
    }

    private getStore(): ISkillStore {
        return (this.state() as any) || {list: [], activeSkillId: ""};
    }

    updateList(list: ISkill[]) {
        this.updateState({list} as any);
    }

    setActiveSkill(id: string) {
        this.updateState({activeSkillId: id} as any);
    }

    addSkill(skill: ISkill) {
        const store = this.getStore();
        this.updateState({list: [...store.list, skill]} as any);
    }

    removeSkill(uuid: string) {
        const store = this.getStore();
        this.updateState({
            list: store.list.filter((s) => s.uuid !== uuid),
            activeSkillId: store.activeSkillId === uuid ? "" : store.activeSkillId,
        } as any);
    }

    updateSkill(skill: ISkill) {
        const store = this.getStore();
        this.updateState({
            list: store.list.map((s) => (s.uuid === skill.uuid ? skill : s)),
        } as any);
    }

    setExecutingSkill(executing: IExecutingSkill | undefined) {
        this.updateState({executingSkill: executing ?? null} as any);
    }
}
