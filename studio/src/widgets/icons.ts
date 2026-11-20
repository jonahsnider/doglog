import BotIcon from 'lucide-react/icons/bot';
import ChartLineIcon from 'lucide-react/icons/chart-line';
import Gamepad2Icon from 'lucide-react/icons/gamepad-2';
import NotebookPenIcon from 'lucide-react/icons/notebook-pen';
import TableIcon from 'lucide-react/icons/table';
import TerminalIcon from 'lucide-react/icons/terminal';
import type { ComponentType, SVGProps } from 'react';
import CompetitionFieldIcon from '@/widgets/field/competition-field.svg?react';
import SwerveDriveIcon from '@/widgets/swerve/swerve-drive.svg?react';
import type { WidgetTypeId } from '@/widgets/widget-info';

/**
 * Each widget type's icon, a Lucide icon or a single color SVG imported with `?react`. Kept apart from the widgets so
 * link preview images can draw them without the widgets' code, see `@/link-previews/preview-image`.
 */
export const widgetIcons: Record<WidgetTypeId, ComponentType<SVGProps<SVGSVGElement>>> = {
	graph: ChartLineIcon,
	field: CompetitionFieldIcon,
	robot: BotIcon,
	table: TableIcon,
	console: TerminalIcon,
	swerve: SwerveDriveIcon,
	controller: Gamepad2Icon,
	notepad: NotebookPenIcon,
};
