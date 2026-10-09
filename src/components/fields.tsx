import { Input, Label } from "@nocoo/basalt";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
import { useId } from "react";

export function Field({
	label,
	value,
	onChange,
	type = "text",
	hint,
	min,
	max,
	step,
	required,
}: {
	label: string;
	value: string | number;
	onChange: (value: string) => void;
	type?: string;
	hint?: string;
	min?: number;
	max?: number;
	step?: number | "any";
	required?: boolean;
}) {
	const id = useId();
	return (
		<div className="field">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type={type}
				value={value}
				min={min}
				max={max}
				step={step}
				required={required}
				onChange={(event) => onChange(event.target.value)}
			/>
			{hint && <span className="field-hint">{hint}</span>}
		</div>
	);
}

export function Choice({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
}) {
	const id = useId();
	return (
		<div className="field">
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
