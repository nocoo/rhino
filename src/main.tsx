import "@nocoo/basalt/styles/standalone";
import { LinkProvider, ThemeProvider, Toaster, TooltipProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
	<ThemeProvider defaultTheme="light" persist={false}>
		<AccentProvider
			defaultAccent="green"
			persist={false}
			paletteOverrides={{ green: { light: "145 25% 35%", dark: "145 26% 58%" } }}
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
