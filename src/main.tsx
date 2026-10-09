import "@nocoo/basalt/styles/standalone";
import {
	Button,
	LayerCard,
	LinkProvider,
	ThemeProvider,
	Toaster,
	TooltipProvider,
} from "@nocoo/basalt";
import { LoadingScreen } from "@nocoo/basalt/components/loading-screen";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { initializeEnvironment } from "./models/environment";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
const application = createRoot(root);
application.render(
	<LoadingScreen
		label="正在打开 Rhino 训练空间"
		mark={<img src="/logo-80.png" width={80} height={80} alt="Rhino" />}
	/>,
);
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
	application.render(
		<main className="startup-error">
			<section aria-labelledby="startup-title">
				<LayerCard>
					<LayerCard.Header>
						<img src="/logo-80.png" width={80} height={80} alt="Rhino" />
						<h1 id="startup-title">无法进入训练空间</h1>
					</LayerCard.Header>
					<LayerCard.Body>
						<p role="alert">无法确认数据环境，已停止加载。请刷新页面或重新启动开发服务。</p>
					</LayerCard.Body>
					<LayerCard.Footer>
						<Button onClick={() => window.location.reload()}>重新加载</Button>
					</LayerCard.Footer>
				</LayerCard>
			</section>
		</main>,
	);
});
