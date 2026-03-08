import {ShieldAlert, ShieldCheck, ShieldX} from "lucide-react";
import {useState} from "react";
import {G} from "../../../appInitializer/module/G.ts";
import {useLicense} from "../../../hooks/useLicense.ts";
import {Button} from "../../ui/button.tsx";
import {Card, CardContent} from "../../ui/card.tsx";
import {Input} from "../../ui/input.tsx";
import {Label} from "../../ui/label.tsx";
import {Spinner} from "../../ui/spinner.tsx";

export function LicenseSection() {
    const {isPro, license} = useLicense();
    const [keyInput, setKeyInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        if (!keyInput.trim()) return;
        setLoading(true);
        try {
            const success = await G.license.activateKey(keyInput.trim());
            if (success) setKeyInput("");
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async () => {
        setLoading(true);
        try {
            await G.license.deactivateKey();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardContent className="pt-6 flex flex-col gap-6">
                {license.status === "checking" && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                        <Spinner size="md" className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Validating license...</span>
                    </div>
                )}

                {isPro && (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-500">
                                <ShieldCheck className="h-5 w-5" />
                                <span className="font-medium">License Active</span>
                                {license.plan && <span className="text-xs text-muted-foreground ml-1">— {license.plan}</span>}
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={loading} className="text-muted-foreground hover:text-destructive">
                                {loading && <Spinner size="sm" className="mr-2" />}
                                Deactivate
                            </Button>
                        </div>
                    </>
                )}

                {(license.status === "inactive" || license.status === "unchecked") && (
                    <>
                        <p className="text-sm text-muted-foreground">Enter your license key to unlock Pro features.</p>
                        <div className="grid gap-2">
                            <Label>License Key</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={keyInput}
                                    onChange={(e) => setKeyInput(e.target.value)}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className="font-mono"
                                    onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                                />
                                <Button onClick={handleActivate} disabled={loading || !keyInput.trim()}>
                                    {loading && <Spinner size="sm" className="mr-2" />}
                                    Activate
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {(license.status === "invalid" || license.status === "expired") && (
                    <>
                        <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                            {license.status === "expired" ? <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" /> : <ShieldX className="h-5 w-5 text-destructive shrink-0" />}
                            <span className="text-sm">{license.errorMessage ?? (license.status === "expired" ? "License expired" : "Invalid license key")}</span>
                        </div>
                        <div className="grid gap-2">
                            <Label>License Key</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={keyInput}
                                    onChange={(e) => setKeyInput(e.target.value)}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className="font-mono"
                                    onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                                />
                                <Button onClick={handleActivate} disabled={loading || !keyInput.trim()}>
                                    {loading && <Spinner size="sm" className="mr-2" />}
                                    {license.status === "expired" ? "Reactivate" : "Try Again"}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
