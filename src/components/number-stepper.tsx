import { Button } from "@nocoo/basalt";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

export function NumberStepper({
	label,
	value,
	onChange,
	min = 0,
	max,
	step = 1,
	unit,
	vertical = false,
	disabled = false,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max: number;
	step?: number;
	unit: string;
	vertical?: boolean;
	disabled?: boolean;
}) {
	return (
		<fieldset className={`number-stepper${vertical ? " vertical" : ""}`} aria-label={label}>
			<legend className="stepper-label">{label}</legend>
			<div className="stepper-control">
				<Button
					variant="secondary"
					size="icon"
					disabled={disabled || value <= min}
					aria-label={`减少${label}`}
					onClick={() => onChange(Math.max(min, value - step))}
				>
					{vertical ? <ChevronDown size={20} /> : <ChevronLeft size={20} />}
				</Button>
				<output aria-label={label}>
					<strong>{Number(value.toFixed(3))}</strong>
					<span>{unit}</span>
				</output>
				<Button
					variant="secondary"
					size="icon"
					disabled={disabled || value >= max}
					aria-label={`增加${label}`}
					onClick={() => onChange(Math.min(max, value + step))}
				>
					{vertical ? <ChevronUp size={20} /> : <ChevronRight size={20} />}
				</Button>
			</div>
		</fieldset>
	);
}
