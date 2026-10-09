import { Input } from "@nocoo/basalt";
import { Field as BasaltField } from "@nocoo/basalt/components/field";
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
		<BasaltField className="field" label={label} htmlFor={id} hint={hint}>
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
		</BasaltField>
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
		<Select value={value} onValueChange={onChange}>
			<BasaltField className="field" label={label} htmlFor={id}>
				<SelectTrigger id={id}>
					<SelectValue />
				</SelectTrigger>
			</BasaltField>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
