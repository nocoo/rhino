import { useState } from "react";
import {
	defaultPreferences,
	type EquipmentId,
	type GuidanceSettings,
	type ProfilePreferences,
} from "../domain/contracts";
import type { RhinoModel } from "./use-rhino-model";

export function useProfileModel(model: RhinoModel) {
	const current = model.profile?.profile;
	const [birthday, setBirthday] = useState(current?.birthday ?? "");
	const [timezone, setTimezone] = useState(current?.timezone ?? "Asia/Shanghai");
	const [mode, setMode] = useState<GuidanceSettings["mode"]>(
		current?.guidance.mode ?? "generic-estimates",
	);
	const [preferences, setPreferences] = useState(current?.preferences ?? defaultPreferences);
	const [range, setRange] = useState(
		current?.guidance.clinicianRange ?? {
			minBpm: 90,
			maxBpm: 120,
			effectiveDate: model.today,
			sourceNote: "",
		},
	);
	function preference<K extends keyof ProfilePreferences>(key: K, value: ProfilePreferences[K]) {
		setPreferences((previous) => ({ ...previous, [key]: value }));
	}
	function toggleEquipment(id: EquipmentId) {
		preference(
			"equipmentIds",
			preferences.equipmentIds.includes(id)
				? preferences.equipmentIds.filter((item) => item !== id)
				: [...preferences.equipmentIds, id],
		);
	}
	return {
		birthday,
		setBirthday,
		timezone,
		setTimezone,
		mode,
		setMode,
		preferences,
		preference,
		range,
		setRange,
		toggleEquipment,
		save: () =>
			model.saveProfile({
				birthday: birthday || null,
				timezone,
				preferences,
				guidance: { mode, clinicianRange: mode === "clinician-range" ? range : null },
			}),
	};
}
