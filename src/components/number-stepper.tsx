import { Button } from "@nocoo/basalt";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function NumberStepper({
	label,
	value,
	onChange,
	min = 0,
	max,
	step = 1,
	unit,
	disabled = false,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max: number;
	step?: number;
	unit: string;
	disabled?: boolean;
}) {
	const display = String(Number(value.toFixed(3)));
	return (
		<fieldset className="number-stepper" aria-label={label}>
			<legend className="stepper-label">{label}</legend>
			<div className="stepper-control">
				<Button
					variant="secondary"
					size="icon"
					disabled={disabled || value <= min}
					aria-label={`减少${label}`}
					onClick={() => onChange(Math.max(min, value - step))}
				>
					<ChevronLeft size={20} />
				</Button>
				<output aria-label={label} data-compact={display.length > 4 || undefined}>
					<strong>{display}</strong>
					<span>{unit}</span>
				</output>
				<Button
					variant="secondary"
					size="icon"
					disabled={disabled || value >= max}
					aria-label={`增加${label}`}
					onClick={() => onChange(Math.min(max, value + step))}
				>
					<ChevronRight size={20} />
				</Button>
			</div>
		</fieldset>
	);
}
