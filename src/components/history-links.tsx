import { LinkProvider } from "@nocoo/basalt";
import { type AnchorHTMLAttributes, createContext, type ReactNode, useContext } from "react";

const Navigation = createContext<(href: string) => boolean>(() => false);

function HistoryLink({
	onClick,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
	const navigate = useContext(Navigation);
	return (
		<a
			{...props}
			href={props.href}
			onClick={(event) => {
				onClick?.(event);
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					props.download !== undefined ||
					(props.target && props.target !== "_self")
				)
					return;
				if (new URL(props.href, window.location.href).origin !== window.location.origin) return;
				event.preventDefault();
				navigate(props.href);
			}}
		/>
	);
}

export function HistoryLinks({
	navigate,
	children,
}: {
	navigate: (href: string) => boolean;
	children: ReactNode;
}) {
	return (
		<Navigation.Provider value={navigate}>
			<LinkProvider render={HistoryLink}>{children}</LinkProvider>
		</Navigation.Provider>
	);
}
