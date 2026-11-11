// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PersistedSidebarProvider, Sidebar } from "../../../src/components/layout/sidebar";

beforeAll(() => {
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(cleanup);

describe("Sidebar identity", () => {
	it("shows the owner email in the expanded user footer", () => {
		render(
			<PersistedSidebarProvider>
				<Sidebar
					ariaLabel="测试侧栏"
					activePage="today"
					onNavigate={() => {}}
					identity={{
						email: "owner@example.com",
						name: "Owner",
						avatar: null,
					}}
				/>
			</PersistedSidebarProvider>,
		);
		expect(screen.getByText("owner@example.com")).toBeTruthy();
		expect(screen.getByText("Owner")).toBeTruthy();
	});
});
