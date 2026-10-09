// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useProfileModel } from "../../../src/features/use-profile-model";
import type { RhinoModel } from "../../../src/features/use-rhino-model";
import { profileValues } from "../../helpers/fixtures";

afterEach(cleanup);
it("uses explicit defaults, edits preferences/equipment, and preserves clinician guidance", async () => {
	const saveProfile = vi.fn();
	const model = { profile: null, today: "2026-10-09", saveProfile } as unknown as RhinoModel;
	const { result } = renderHook(() => useProfileModel(model));
	expect(result.current.birthday).toBe("");
	expect(result.current.timezone).toBe("Asia/Shanghai");
	act(() => result.current.toggleEquipment("dumbbell"));
	expect(result.current.preferences.equipmentIds).not.toContain("dumbbell");
	act(() => result.current.toggleEquipment("dumbbell"));
	expect(result.current.preferences.equipmentIds).toContain("dumbbell");
	act(() => {
		result.current.preference("experience", "returning");
		result.current.preference("weighInCadenceDays", null);
		result.current.setTimezone("UTC");
	});
	await act(() => result.current.save());
	expect(saveProfile).toHaveBeenLastCalledWith(
		expect.objectContaining({
			birthday: null,
			timezone: "UTC",
			preferences: expect.objectContaining({ experience: "returning", weighInCadenceDays: null }),
			guidance: { mode: "generic-estimates", clinicianRange: null },
		}),
	);
	const range = {
		minBpm: 100,
		maxBpm: 130,
		effectiveDate: "2026-10-09",
		sourceNote: "Synthetic clinician",
	};
	act(() => {
		result.current.setBirthday("1990-01-01");
		result.current.setMode("clinician-range");
		result.current.setRange(range);
	});
	await act(() => result.current.save());
	expect(saveProfile).toHaveBeenLastCalledWith(
		expect.objectContaining({
			birthday: "1990-01-01",
			guidance: { mode: "clinician-range", clinicianRange: range },
		}),
	);
	act(() => result.current.setMode("disabled"));
	await act(() => result.current.save());
	expect(saveProfile).toHaveBeenLastCalledWith(
		expect.objectContaining({ guidance: { mode: "disabled", clinicianRange: null } }),
	);
});
it("initializes from the saved owner profile without resetting clinician instructions", async () => {
	const range = { minBpm: 95, maxBpm: 125, effectiveDate: "2026-10-01", sourceNote: "Synthetic" };
	const saveProfile = vi.fn();
	const values = {
		...profileValues(),
		timezone: "UTC",
		guidance: { mode: "clinician-range", clinicianRange: range },
	};
	const { result } = renderHook(() =>
		useProfileModel({
			profile: { profile: values },
			today: "2026-10-09",
			saveProfile,
		} as unknown as RhinoModel),
	);
	expect(result.current.birthday).toBe(values.birthday);
	expect(result.current.preferences).toEqual(values.preferences);
	expect(result.current.range).toEqual(range);
	await act(() => result.current.save());
	expect(saveProfile).toHaveBeenCalledWith(values);
});
