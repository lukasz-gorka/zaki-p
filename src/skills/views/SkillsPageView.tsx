import {Copy, MoreVertical, Plus, Trash2, Zap} from "lucide-react";
import {ReactNode, useCallback, useEffect, useState} from "react";
import {useGlobalState} from "../../hooks/useGlobalState.ts";
import {ContentPageLayout} from "../../views/templates/ContentPageLayout.tsx";
import {Avatar, AvatarImage} from "../../views/ui/avatar.tsx";
import {Badge} from "../../views/ui/badge.tsx";
import {Button} from "../../views/ui/button.tsx";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "../../views/ui/dropdown-menu.tsx";
import {Input} from "../../views/ui/input.tsx";
import {KeyboardShortcutInput} from "../../views/ui/keyboard-shortcut-input.tsx";
import {ScrollArea} from "../../views/ui/scroll-area.tsx";
import {ISkill, ISkillStore} from "../interfaces/ISkill.ts";
import {getSkillModule} from "../plugin.ts";
import {DynamicIcon} from "./DynamicIcon.tsx";
import {SkillEditSheet} from "./SkillEditSheet.tsx";

function SkillRow({
    skill,
    onEdit,
    onDuplicate,
    onRemove,
    onShortcutSave,
}: {
    skill: ISkill;
    onEdit: (s: ISkill) => void;
    onDuplicate: (s: ISkill) => void;
    onRemove: (uuid: string) => void;
    onShortcutSave: (s: ISkill, ks: string) => void;
}) {
    return (
        <div
            className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden"
            onClick={() => onEdit(skill)}
        >
            {skill.avatar ? (
                <Avatar className="w-8 h-8 rounded-md flex-shrink-0">
                    <AvatarImage src={skill.avatar} />
                </Avatar>
            ) : (
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <DynamicIcon name={skill.icon || "Zap"} className="w-4 h-4 text-primary" />
                </div>
            )}
            <p className="text-sm font-medium truncate min-w-0 flex-1">
                {skill.label}
                {skill.inputSource === "voice" && <Badge className="text-[10px] px-1.5 py-0 h-auto ml-2 align-middle bg-secondary text-secondary-foreground">Voice</Badge>}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                <KeyboardShortcutInput initialValue={skill.keystroke} onSave={(ks) => onShortcutSave(skill, ks)} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0">
                            <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(skill)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(skill)}>
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRemove(skill.uuid)} className="text-destructive" disabled={skill.internal}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function GroupedSkillList({items, renderItem, prepend}: {items: ISkill[]; renderItem: (s: ISkill) => ReactNode; prepend?: ReactNode}) {
    const grouped = new Map<string, ISkill[]>();
    for (const s of items) {
        const cat = s.category || "Uncategorized";
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(s);
    }

    return (
        <div className="space-y-6">
            {prepend}
            {Array.from(grouped.entries()).map(([category, categorySkills]) => (
                <div key={category}>
                    {grouped.size > 1 && <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h2>}
                    <div className="space-y-1.5">{categorySkills.map((skill) => renderItem(skill))}</div>
                </div>
            ))}
        </div>
    );
}

export function SkillsPageView() {
    const [skillState] = useGlobalState("skills" as any) as [ISkillStore, any];
    const skills = getSkillModule();
    const [editingSkill, setEditingSkill] = useState<ISkill | null>(null);
    const [searchValue, setSearchValue] = useState("");

    // Listen for external edit requests (e.g. from command panel)
    useEffect(() => {
        const handler = (e: Event) => {
            const uuid = (e as CustomEvent).detail;
            const skill = skillState?.list?.find((s) => s.uuid === uuid);
            if (skill) setEditingSkill(skill);
        };
        window.addEventListener("skill:open-edit", handler);
        return () => window.removeEventListener("skill:open-edit", handler);
    }, [skillState?.list]);

    const handleAdd = useCallback(() => {
        const newSkill = skills.createNewSkill();
        setEditingSkill(newSkill);
    }, [skills]);

    const handleRemove = useCallback((uuid: string) => skills.removeSkill(uuid), [skills]);
    const handleDuplicate = useCallback((skill: ISkill) => skills.duplicateSkill(skill), [skills]);
    const handleEdit = useCallback((skill: ISkill) => setEditingSkill(skill), []);
    const handleSaveEdit = useCallback(
        (skill: ISkill) => {
            skills.updateSkill(skill);
        },
        [skills],
    );
    const handleShortcutSave = useCallback((skill: ISkill, keystroke: string) => skills.updateSkill({...skill, keystroke}), [skills]);

    const list = skillState?.list || [];
    const filtered = list.filter((s) => s.label?.toLowerCase().includes(searchValue.toLowerCase()));

    const renderSkillItem = (skill: ISkill) => (
        <SkillRow key={skill.uuid} skill={skill} onEdit={handleEdit} onDuplicate={handleDuplicate} onRemove={handleRemove} onShortcutSave={handleShortcutSave} />
    );

    return (
        <ContentPageLayout title="Skills" icon={Zap}>
            <div className="h-full flex flex-col gap-3">
                <Input placeholder="Search skills..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
                <ScrollArea className="flex-1">
                    <GroupedSkillList
                        items={filtered}
                        renderItem={renderSkillItem}
                        prepend={
                            <Button variant="outline" className="w-full gap-2 h-12" onClick={handleAdd}>
                                <Plus className="w-4 h-4" />
                                Add Skill
                            </Button>
                        }
                    />
                </ScrollArea>
            </div>
            {editingSkill && <SkillEditSheet skill={editingSkill} open={true} onSave={handleSaveEdit} onClose={() => setEditingSkill(null)} />}
        </ContentPageLayout>
    );
}
