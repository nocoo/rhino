import "@nocoo/basalt/styles/standalone";
import { LinkProvider, ThemeProvider, Toaster, TooltipProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { initializeEnvironment } from "./models/environment";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const application = createRoot(root);
async function start() {
	await initializeEnvironment();
	application.render(
		<ThemeProvider defaultTheme="light" persist={false}>
			<AccentProvider
				defaultAccent="primary"
				persist={false}
				paletteOverrides={{ primary: { light: "216 58% 36%", dark: "214 65% 70%" } }}
			>
				<LinkProvider>
					<TooltipProvider>
						<App />
						<Toaster />
					</TooltipProvider>
				</LinkProvider>
			</AccentProvider>
		</ThemeProvider>,
	);
}
void start().catch(() => {
	root.textContent = "无法确认数据环境，已停止加载。请刷新页面或重新启动开发服务。";
	root.setAttribute("role", "alert");
});
