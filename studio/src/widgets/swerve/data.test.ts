import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { createSamples, getEntryKind } from '@/data/samples';
import { swerveRoles } from '@/widgets/swerve/data';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: createSamples(getEntryKind(type)), metadata: {} };
}

test.each([
	['/Drive/Speeds', 'struct:ChassisSpeeds', ['speeds', 'fieldSpeeds']],
	['/Drive/FieldRelativeSpeeds', 'struct:ChassisVelocities', ['fieldSpeeds', 'speeds']],
	// Only the last part of the name counts
	['/Field/Speeds', 'struct:ChassisSpeeds', ['speeds', 'fieldSpeeds']],
	['/Drive/MeasuredStates', 'struct:SwerveModuleState[]', ['states']],
])('%s (%s) can be drawn as %j', (name, type, roles) => {
	expect(swerveRoles(entry(name, type)).map((role) => role.id)).toEqual(roles);
});
