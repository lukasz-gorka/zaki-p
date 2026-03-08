import {ReactNode} from "react";

interface IPageContentWrapperView {
    children: ReactNode;
}

export function PageContentWrapperView({children}: IPageContentWrapperView) {
    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex-1 flex justify-center">
                <div className="max-w-4xl w-full pb-16">{children}</div>
            </div>
        </div>
    );
}
