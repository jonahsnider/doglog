import { createFileRoute } from '@tanstack/react-router';
import { DashboardLinkError } from '@/dashboards/dashboard-link-error';

// Snapshot URLs aren't supported and must never create a local dashboard.
export const Route = createFileRoute('/import/$link')({ component: DashboardLinkError });
