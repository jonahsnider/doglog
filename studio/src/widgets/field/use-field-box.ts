import { useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import type { FieldBox } from '@/widgets/field/geometry';

/** The usable space around the legend, for the field and its overlay. */
export function useFieldBox() {
	const boxRef = useRef<HTMLDivElement>(null!);
	const legendRef = useRef<HTMLDivElement>(null!);
	const [box, setBox] = useState<FieldBox>({ width: 0, height: 0, legendWidth: 0, legendHeight: 0 });
	const measure = () =>
		setBox({
			width: boxRef.current.clientWidth,
			height: boxRef.current.clientHeight,
			legendWidth: legendRef.current.offsetWidth,
			legendHeight: legendRef.current.offsetHeight,
		});
	useResizeObserver({ ref: boxRef, onResize: measure });
	useResizeObserver({ ref: legendRef, onResize: measure });
	return { boxRef, legendRef, box };
}
