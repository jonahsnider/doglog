import type { IconName } from '@astryxdesign/core/Icon';
import type { ReactNode } from 'react';
import ArrowDownIcon from 'lucide-react/icons/arrow-down';
import ArrowUpIcon from 'lucide-react/icons/arrow-up';
import ArrowUpDownIcon from 'lucide-react/icons/arrow-up-down';
import CalendarIcon from 'lucide-react/icons/calendar';
import CheckIcon from 'lucide-react/icons/check';
import CheckCheckIcon from 'lucide-react/icons/check-check';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import ChevronLeftIcon from 'lucide-react/icons/chevron-left';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import ChevronsLeftIcon from 'lucide-react/icons/chevrons-left';
import ChevronsRightIcon from 'lucide-react/icons/chevrons-right';
import CircleCheckIcon from 'lucide-react/icons/circle-check';
import CircleXIcon from 'lucide-react/icons/circle-x';
import ClockIcon from 'lucide-react/icons/clock';
import Columns3Icon from 'lucide-react/icons/columns-3';
import CopyIcon from 'lucide-react/icons/copy';
import EllipsisIcon from 'lucide-react/icons/ellipsis';
import ExternalLinkIcon from 'lucide-react/icons/external-link';
import EyeOffIcon from 'lucide-react/icons/eye-off';
import FunnelIcon from 'lucide-react/icons/funnel';
import InfoIcon from 'lucide-react/icons/info';
import MenuIcon from 'lucide-react/icons/menu';
import MicIcon from 'lucide-react/icons/mic';
import SearchIcon from 'lucide-react/icons/search';
import SquareIcon from 'lucide-react/icons/square';
import TriangleAlertIcon from 'lucide-react/icons/triangle-alert';
import UploadIcon from 'lucide-react/icons/upload';
import WrenchIcon from 'lucide-react/icons/wrench';
import XIcon from 'lucide-react/icons/x';

/** Astryx's semantic icons drawn with Lucide, so they match the rest of Studio's icons */
export const studioIcons: Record<IconName, ReactNode> = {
	close: <XIcon size="1em" aria-hidden />,
	chevronDown: <ChevronDownIcon size="1em" aria-hidden />,
	chevronLeft: <ChevronLeftIcon size="1em" aria-hidden />,
	chevronRight: <ChevronRightIcon size="1em" aria-hidden />,
	chevronsLeft: <ChevronsLeftIcon size="1em" aria-hidden />,
	chevronsRight: <ChevronsRightIcon size="1em" aria-hidden />,
	check: <CheckIcon size="1em" aria-hidden />,
	success: <CircleCheckIcon size="1em" aria-hidden />,
	error: <CircleXIcon size="1em" aria-hidden />,
	warning: <TriangleAlertIcon size="1em" aria-hidden />,
	info: <InfoIcon size="1em" aria-hidden />,
	calendar: <CalendarIcon size="1em" aria-hidden />,
	clock: <ClockIcon size="1em" aria-hidden />,
	externalLink: <ExternalLinkIcon size="1em" aria-hidden />,
	menu: <MenuIcon size="1em" aria-hidden />,
	moreHorizontal: <EllipsisIcon size="1em" aria-hidden />,
	search: <SearchIcon size="1em" aria-hidden />,
	upload: <UploadIcon size="1em" aria-hidden />,
	arrowUp: <ArrowUpIcon size="1em" aria-hidden />,
	arrowDown: <ArrowDownIcon size="1em" aria-hidden />,
	arrowsUpDown: <ArrowUpDownIcon size="1em" aria-hidden />,
	funnel: <FunnelIcon size="1em" aria-hidden />,
	eyeSlash: <EyeOffIcon size="1em" aria-hidden />,
	viewColumns: <Columns3Icon size="1em" aria-hidden />,
	copy: <CopyIcon size="1em" aria-hidden />,
	checkDouble: <CheckCheckIcon size="1em" aria-hidden />,
	wrench: <WrenchIcon size="1em" aria-hidden />,
	stop: <SquareIcon size="1em" aria-hidden />,
	microphone: <MicIcon size="1em" aria-hidden />,
};
