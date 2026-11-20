import {
	ANIMATION_PROPS,
	CHART_PLOT_MARGIN,
	CHART_TYPE,
	ChartFrame,
	type ChartSeriesDescriptor,
	cartesianAxisProps,
	chartTooltipProps,
	GRID_PROPS,
	RESPONSIVE_CONTAINER_PROPS,
	seriesColor,
} from "@nocoo/basalt/components/chart";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type TrendDatum = Record<string, string | number | null | undefined>;

export function TrendLineChart<T extends TrendDatum>({
	data,
	series,
	ariaLabel,
	summary,
	className,
	yDomain = ["auto", "auto"],
	valueFormatter,
	xValueFormatter,
}: {
	data: T[];
	series: ChartSeriesDescriptor[];
	ariaLabel: string;
	summary?: string;
	className?: string;
	yDomain?: [number | "auto", number | "auto"];
	valueFormatter?: (value: number) => string;
	xValueFormatter?: (value: string | number) => string;
}) {
	const xAxisProps = cartesianAxisProps();
	const yAxisProps = cartesianAxisProps();
	const tooltipProps = chartTooltipProps({
		cursor: "line",
		...(valueFormatter ? { formatter: valueFormatter } : {}),
	});

	return (
		<ChartFrame
			ariaLabel={ariaLabel}
			{...(summary ? { summary } : {})}
			{...(className ? { className } : {})}
		>
			<ResponsiveContainer {...RESPONSIVE_CONTAINER_PROPS}>
				<LineChart data={data} margin={CHART_PLOT_MARGIN}>
					<CartesianGrid {...GRID_PROPS} />
					<XAxis
						{...xAxisProps}
						dataKey="x"
						{...(xValueFormatter ? { tickFormatter: xValueFormatter } : {})}
					/>
					<YAxis
						{...yAxisProps}
						domain={yDomain}
						{...(valueFormatter ? { tickFormatter: (value: number) => valueFormatter(value) } : {})}
					/>
					<Tooltip {...tooltipProps} />
					{series.map((item, index) => {
						const stroke = seriesColor(item, index);
						return (
							<Line
								key={item.key}
								type="monotone"
								dataKey={item.key}
								name={item.label ?? item.key}
								stroke={stroke}
								strokeWidth={CHART_TYPE.strokeWidth}
								dot={false}
								connectNulls
								{...ANIMATION_PROPS}
							/>
						);
					})}
				</LineChart>
			</ResponsiveContainer>
		</ChartFrame>
	);
}
