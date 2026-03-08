import {AutoUpdateModule} from "../../autoUpdate/AutoUpdateModule.ts";
import {AutoUpdateStoreManager} from "../../autoUpdate/store/AutoUpdateStoreManager.ts";
import {EventBus} from "../../events/EventBus.ts";
import {GlobalShortcuts} from "../../globalShortcuts/GlobalShortcuts.ts";
import {LicenseModule} from "../../license/LicenseModule.ts";
import {LicenseStoreManager} from "../../license/store/LicenseStoreManager.ts";
import {StatusPopupManager} from "../../popup/StatusPopupManager.ts";
import {RustProxy} from "../../rustProxy/RustProxy.ts";
import {VoiceStoreManager} from "../../voice/store/VoiceStoreManager.ts";
import {VoiceModule} from "../../voice/VoiceModule.ts";

export class G {
    public static rustProxy: RustProxy;
    public static globalShortcuts: GlobalShortcuts;
    public static autoUpdate: AutoUpdateModule;
    public static voice: VoiceModule;
    public static events: typeof EventBus = EventBus;
    public static license: LicenseModule;
    public static statusPopup: StatusPopupManager;
    public static quickChatPopup: any;

    public static async init() {
        this.rustProxy = new RustProxy();
        this.globalShortcuts = new GlobalShortcuts();
        this.autoUpdate = new AutoUpdateModule(new AutoUpdateStoreManager());

        this.license = new LicenseModule(new LicenseStoreManager());

        this.statusPopup = new StatusPopupManager();

        this.voice = new VoiceModule({
            storeManager: new VoiceStoreManager(),
        });

        this.events.on("skill:voice-execute", (data: {skillId: string}) => {
            this.voice.executeSkillWithVoice(data.skillId);
        });
    }
}
