import "../../public/css/style.css";
import ReactDOM from "react-dom/client";
import {PopupApp} from "./view/PopupApp.tsx";

document.documentElement.classList.add("dark");
document.body.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<PopupApp />);
