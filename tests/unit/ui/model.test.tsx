// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actualFromTarget, useRhinoModel } from "../../../src/features/use-rhino-model";
import * as client from "../../../src/lib/api";
import {
	planInput,
	profileValues,
	sessionRecord,
	sessionTarget,
	uuid,
} from "../../helpers/fixtures";

vi.mock("../../../src/lib/api", () => ({ api: vi.fn(), put: vi.fn() }));
const api = vi.mocked(client.api);
const put = vi.mocked(client.put);
const profile = () => ({
	profile: {
		...profileValues(),
		id: 1,
		version: 2,
		lastMutationId: uuid(),
		createdAt: "2026-10-09T01:00:00Z",
		updatedAt: "2026-10-09T01:00:00Z",
	},
	defaults: profileValues(),
	readiness: {
		hasProfile: true,
		hasBirthday: true,
		hasHeight: false,
		hasWeight: false,
		recommendationScope: "in-scope",
		guidance: "available",
	},
	warnings: [],
	algorithmVersion: "1.0.0",
	catalogVersion: "1.0.0",
});
const empty = () => ({ ...profile(), profile: null });
const revision = () => ({
	revision: 1,
	requestId: uuid(),
	reviewMonth: "2026-10",
	acceptedAt: "2026-10-09T01:00:00Z",
	algorithmVersion: "1.0.0",
	catalogVersion: "1.0.0",
	input: planInput(),
	template: { slots: [] },
	rationale: { explanations: [], compromises: [], unfilledRequirements: [], coverageGaps: [] },
});
let loadedProfile = profile() as ReturnType<typeof profile> | ReturnType<typeof empty>;
let measurementRows: object[] = [];
let current: object | null = null;
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};

beforeEach(() => {
	vi.resetAllMocks();
	loadedProfile = profile();
	measurementRows = [];
	current = null;
	api.mockImplementation(async (path) => {
		if (path === "/profile") return loadedProfile;
		if (path === "/plans") return { current, history: [] };
		if (path.startsWith("/measurements")) return { measurements: measurementRows };
		if (path.startsWith("/sessions")) return { sessions: [] };
		return {
			from: "2025-10-09",
			to: "2026-10-09",
			measurements: [],
			sessions: [],
			weeklyTotals: [],
		};
	});
});
afterEach(cleanup);
async function model() {
	const hook = renderHook(useRhinoModel);
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	return hook;
}

describe("Rhino model persistence and failure recovery", () => {
	it("loads all owned data lanes and can explicitly reload", async () => {
		const hook = await model();
		expect(hook.result.current.profile?.profile?.version).toBe(2);
		expect(hook.result.current.progress).not.toBeNull();
		expect(api).toHaveBeenCalledWith(expect.stringMatching(/^\/progress\?from=.*&to=/));
		await act(() => hook.result.current.reload());
		expect(hook.result.current.message).toBe("已重新加载");
	});
	it("reports initial Error and non-Error failures, and ignores cancelled load failures", async () => {
		for (const reason of [new Error("offline"), "unknown"]) {
			api.mockRejectedValueOnce(reason);
			const hook = await model();
			expect(hook.result.current.error).toBe(reason instanceof Error ? "offline" : "加载失败");
			hook.unmount();
		}
		const pending = deferred<unknown>();
		api.mockReturnValueOnce(pending.promise);
		const hook = renderHook(useRhinoModel);
		hook.unmount();
		await act(async () => {
			pending.reject(new Error("cancelled"));
			await Promise.resolve();
		});
	});
	it("reuses mutation identity for failed identical retries and serializes saves", async () => {
		const hook = await model();
		const values = profileValues();
		put.mockRejectedValueOnce(new Error("network save failed"));
		await act(() => hook.result.current.saveProfile(values));
		expect(hook.result.current.error).toBe("network save failed");
		const first = put.mock.calls[0]?.[1] as { mutationId: string };
		const save = deferred<unknown>();
		put.mockReturnValueOnce(save.promise);
		let saving!: Promise<void>;
		act(() => {
			saving = hook.result.current.saveProfile(values);
		});
		expect(hook.result.current.busy).toBe(true);
		await act(() => hook.result.current.saveProfile(values));
		expect(put).toHaveBeenCalledTimes(2);
		expect(put.mock.calls[1]?.[1]).toMatchObject({
			expectedVersion: 2,
			mutationId: first.mutationId,
		});
		await act(async () => {
			save.resolve({
				profile: loadedProfile.profile,
				readiness: loadedProfile.readiness,
				warnings: [],
			});
			await saving;
		});
		expect(hook.result.current.busy).toBe(false);
		expect(hook.result.current.message).toBe("档案已保存");
	});
	it("creates an initial profile, changes retry fingerprint and displays unknown save failures", async () => {
		loadedProfile = empty();
		const hook = await model();
		put.mockRejectedValueOnce("unknown");
		await act(() => hook.result.current.saveProfile(profileValues()));
		expect(hook.result.current.error).toBe("请求失败，请重试。");
		const first = put.mock.calls[0]?.[1] as { mutationId: string };
		put.mockResolvedValueOnce({
			profile: profile().profile,
			readiness: profile().readiness,
			warnings: [],
		});
		await act(() => hook.result.current.saveProfile({ ...profileValues(), birthday: null }));
		expect(put.mock.calls[1]?.[1]).toMatchObject({ expectedVersion: 0 });
		expect((put.mock.calls[1]?.[1] as { mutationId: string } | undefined)?.mutationId).not.toBe(
			first.mutationId,
		);
	});
	it("creates measurements and version-checks same-day correction", async () => {
		const id = uuid();
		measurementRows = [{ id, kind: "weight", effectiveDate: "2026-10-09", value: 70, version: 4 }];
		const hook = await model();
		put.mockResolvedValue({});
		await act(() => hook.result.current.recordMeasurement("weight", 71.25, "2026-10-09"));
		expect(put).toHaveBeenLastCalledWith(
			`/measurements/${id}`,
			expect.objectContaining({ expectedVersion: 4, value: 71.25 }),
		);
		await act(() => hook.result.current.recordMeasurement("height", 180, "2026-10-08"));
		expect(put).toHaveBeenLastCalledWith(
			expect.stringMatching(/^\/measurements\/[a-f0-9-]+$/),
			expect.objectContaining({ expectedVersion: 0, kind: "height" }),
		);
	});
	it("requires a preview before adopting and retains plan revisions", async () => {
		const hook = await model();
		await act(() => hook.result.current.adopt());
		expect(put).not.toHaveBeenCalled();
		const next = revision();
		api.mockResolvedValueOnce({
			preview: { ...next, limitations: [], input: next.input },
			limitations: ["scope"],
		});
		await act(() => hook.result.current.generate(planInput()));
		expect(api).toHaveBeenLastCalledWith("/plans/preview", {
			method: "POST",
			body: JSON.stringify(planInput()),
		});
		expect(hook.result.current.limitations).toEqual(["scope"]);
		put.mockResolvedValueOnce({ revision: next });
		await act(() => hook.result.current.adopt());
		expect(put).toHaveBeenLastCalledWith(
			expect.stringMatching(/^\/plans\//),
			expect.objectContaining({ expectedRevision: 0 }),
		);
		expect(hook.result.current.plans.history).toHaveLength(1);
		expect(hook.result.current.preview).toBeNull();
		api.mockResolvedValueOnce({
			preview: { ...next, limitations: [], input: next.input },
			limitations: [],
		});
		await act(() => hook.result.current.generate(planInput()));
		put.mockResolvedValueOnce({ revision: { ...next, revision: 2 } });
		await act(() => hook.result.current.adopt());
		expect(put).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.objectContaining({ expectedRevision: 1 }),
		);
		expect(hook.result.current.plans.history).toHaveLength(2);
	});
	it("snapshots the current plan, preserves timezone and reloads completed history", async () => {
		current = revision();
		const hook = await model();
		const session = sessionRecord();
		put.mockResolvedValue({ session });
		await act(() => hook.result.current.start(session.target));
		expect(put).toHaveBeenLastCalledWith(
			expect.stringMatching(/^\/sessions\//),
			expect.objectContaining({
				sourcePlanRevision: 1,
				timezone: "Asia/Shanghai",
				status: "draft",
				expectedVersion: 0,
				actual: null,
			}),
		);
		expect(hook.result.current.active).toEqual(session);
		await act(() => hook.result.current.saveSession(session, "active", session.target, null));
		expect(hook.result.current.message).toBe("训练已保存");
		const actual = actualFromTarget(session.target);
		await act(() => hook.result.current.saveSession(session, "completed", session.target, actual));
		expect(put).toHaveBeenLastCalledWith(
			`/sessions/${session.id}`,
			expect.objectContaining({ expectedVersion: 1, status: "completed", actual }),
		);
		expect(hook.result.current.message).toBe("训练已记录。下一次，继续。");
		act(() => hook.result.current.setActive(null));
		expect(hook.result.current.active).toBeNull();
	});
	it("starts without a plan or saved timezone using explicit null source", async () => {
		loadedProfile = empty();
		const hook = await model();
		const session = sessionRecord();
		put.mockResolvedValue({ session });
		await act(() => hook.result.current.start(session.target));
		expect(put).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.objectContaining({ sourcePlanRevision: null, timezone: "Asia/Shanghai" }),
		);
	});
	it("maps strength working sets and cardio independently", () => {
		const target = sessionTarget();
		const actual = actualFromTarget(target);
		expect(actual.exercises[0]?.sets[0]).toMatchObject({
			status: "performed",
			reps: 12,
			loadKg: 10,
			rir: null,
		});
		expect(actual.cardioSegments[0]).toMatchObject({
			role: "main",
			actualMinutes: 30,
			intensity: "moderate",
		});
		expect(actual.completedAsPlanned).toBe(true);
		expect(actual.painFlag).toBe(false);
		expect(actualFromTarget({ ...target, blocks: [] }).exercises).toEqual([]);
	});
});
