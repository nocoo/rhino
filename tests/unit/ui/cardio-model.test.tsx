// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useSessionModel } from "../../../src/features/use-session-model";
import { sessionRecord, uuid } from "../../helpers/fixtures";

afterEach(cleanup);
it("edits actual intensity independently and bounds cardio target budgets", () => {
	const session = sessionRecord();
	const cardio = session.target.blocks[1]?.cardio;
	if (!cardio) throw new Error("No cardio fixture");
	session.target.blocks.push({
		...structuredClone(session.target.blocks[1]),
		cardio: { ...cardio, id: uuid() },
	});
	const { result } = renderHook(() => useSessionModel(session));
	act(() => result.current.setCardioIntensity(cardio.id, "vigorous"));
	expect(result.current.actual.cardioSegments[0]?.intensity).toBe("vigorous");
	expect(result.current.actual.cardioSegments[1]?.intensity).toBe("unknown");
	expect(result.current.actual.completedAsPlanned).toBe(false);
	act(() => result.current.setDirty(false));
	for (const invalid of [0, 151, 1.5])
		act(() => result.current.setCardioTarget(cardio.id, invalid));
	act(() => result.current.setCardioTarget("absent", 20));
	expect(result.current.dirty).toBe(false);
	act(() => result.current.setCardioTarget(cardio.id, 150));
	expect(result.current.dirty).toBe(false);
	act(() => result.current.setCardioTarget(cardio.id, 20));
	expect(result.current.target.timeBudgetMinutes).toBe(
		result.current.target.blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
	);
	expect(result.current.target.blocks[1]?.durationMinutes).toBe(20);
	expect(result.current.actual.cardioSegments[0]?.intensity).toBe("unknown");
	expect(result.current.dirty).toBe(true);
});
