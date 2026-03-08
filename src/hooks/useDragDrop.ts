import {useCallback, useEffect, useState} from "react";
import {IInputFile} from "../shared/interfaces/IInputFile.ts";
import {getFileBase64ImageData} from "../utils/fileUtils.ts";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

function isImageFile(name: string): boolean {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return IMAGE_EXTENSIONS.includes(ext);
}

export function useDragDrop(onAddFile: (file: IInputFile) => void) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        if (e.relatedTarget === null || !(e.currentTarget as HTMLElement)?.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback(
        async (e: DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const files = e.dataTransfer?.files;
            if (!files) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!isImageFile(file.name)) continue;

                try {
                    const {base64, mimeType} = await getFileBase64ImageData(file);
                    onAddFile({base64, mimeType, name: file.name});
                } catch {
                    // skip unreadable files
                }
            }
        },
        [onAddFile],
    );

    useEffect(() => {
        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("drop", handleDrop);

        return () => {
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("drop", handleDrop);
        };
    }, [handleDragOver, handleDragLeave, handleDrop]);

    return {isDragging};
}
