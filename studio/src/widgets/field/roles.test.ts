import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { createSamples, getEntryKind } from '@/data/samples';
import { fieldRoles } from '@/widgets/field/roles';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: createSamples(getEntryKind(type)), metadata: {} };
}

test.each([
	['/Drive/Pose', 'struct:Pose2d', ['robot', 'ghost', 'point']],
	['/Vision/CameraPose', 'struct:Pose3d', ['robot', 'ghost', 'point', 'camera']],
	['/Vision/TagPoses', 'struct:Pose3d[]', ['points', 'path', 'parts']],
	['/RealOutputs/FinalComponentPoses', 'struct:Pose3d[]', ['parts', 'points', 'path']],
	['/PathPlanner/activePath', 'struct:Pose2d[]', ['path', 'points']],
	['/Auto/Trajectory', 'struct:Pose3d[]', ['path', 'points', 'parts']],
	// Only the last part of the name counts
	['/Trajectory/Targets', 'struct:Pose2d[]', ['points', 'path']],
	['/Auto/Waypoints', 'struct:Translation2d[]', ['path', 'points']],
	['/Vision/NotePosition', 'struct:Translation3d', ['point']],
	['/Auto/ShootingZone', 'struct:Rectangle2d', ['shape']],
	['/Vision/Obstacles', 'struct:Ellipse2d[]', ['shape']],
	['/Drive/Speeds', 'struct:ChassisSpeeds', []],
])('%s (%s) can be drawn as %j', (name, type, roles) => {
	expect(fieldRoles(entry(name, type)).map((role) => role.id)).toEqual(roles);
});
