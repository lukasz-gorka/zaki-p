import {useEffect} from "react";
import {Outlet, useNavigate} from "react-router-dom";
import {MainLayout} from "./MainLayout.tsx";

export default function Layout() {
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e: Event) => {
            const path = (e as CustomEvent).detail;
            if (path) navigate(path);
        };
        window.addEventListener("app-navigate", handler);
        return () => window.removeEventListener("app-navigate", handler);
    }, [navigate]);

    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
}
