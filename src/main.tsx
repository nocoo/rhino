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
