import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { type ChromeTarget, liteWorkspace, newChromeContext, waitForChromeReady } from './chrome-startup.ts';

const openMark = 'benchmark:open-3d-field';
const drawMark = 'benchmark:3d-field-draw';
const timeout = 60_000;

type MeshCounts = { indices: number[]; vertices: number[] };
type FieldModel = { app: 'studio'; counts: MeshCounts } | { app: 'lite'; id: string };

async function openWorkspace(context: BrowserContext, target: ChromeTarget) {
	const page = await context.newPage();
	page.setDefaultTimeout(timeout);
	const response = await page.goto(target.url, { waitUntil: 'commit' });
	if (!response?.ok()) throw new Error(`Navigation failed: HTTP ${response?.status() ?? 'no response'}`);
	await waitForChromeReady(page, target);
	return page;
}

async function addStudioField(page: Page) {
	await page.getByRole('button', { name: 'New dashboard', exact: true }).first().click();
	await page.getByRole('button', { name: 'Field', exact: true }).click();
}

function readMeshCounts(bytes: Buffer): MeshCounts {
	// GLB 2.0: 12-byte file header, then the length and type of the JSON chunk.
	if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) {
		throw new Error('Expected the Studio field model to be a GLB 2.0 file.');
	}
	const end = 20 + bytes.readUInt32LE(12);
	if (bytes.readUInt32LE(16) !== 0x4e4f534a || end > bytes.length) {
		throw new Error('The Studio field GLB is missing its JSON chunk.');
	}
	type Primitive = { mode?: number; indices?: number; attributes: { POSITION: number } };
	const model = JSON.parse(bytes.toString('utf8', 20, end)) as {
		accessors: { count: number }[];
		meshes: { primitives: Primitive[] }[];
	};
	const indices = new Set<number>();
	const vertices = new Set<number>();
	for (const { primitives } of model.meshes) {
		for (const primitive of primitives) {
			if ((primitive.mode ?? 4) !== 4) continue; // glTF TRIANGLES
			const count = model.accessors[primitive.indices ?? primitive.attributes.POSITION]?.count;
			// Don't match two-triangle quads: the textured fallback floor and the generated AprilTag decals use them.
			if (count !== undefined && count > 6) (primitive.indices === undefined ? vertices : indices).add(count);
		}
	}
	if (!indices.size && !vertices.size) throw new Error('The served Studio field GLB has no matchable triangle meshes.');
	return { indices: [...indices], vertices: [...vertices] };
}

async function readStudioField(browser: Browser, target: ChromeTarget) {
	// The unbound 2D Field widget preloads its 3D field GLB. Discover and inspect that exact response in
	// a disposable context, without priming the measured browser context or mounting a 3D canvas here.
	const context = await newChromeContext(browser, target);
	try {
		const page = await openWorkspace(context, target);
		const [response] = await Promise.all([
			page.waitForResponse((response) => /\/2026-rebuilt(?:-[\w-]+)?\.glb$/u.test(new URL(response.url()).pathname)),
			addStudioField(page),
		]);
		if (!response.ok()) throw new Error(`Studio field GLB request failed: HTTP ${response.status()}`);
		return readMeshCounts(await response.body());
	} finally {
		await context.close();
	}
}

async function watchField(control: Locator, model: FieldModel) {
	await control.evaluate(
		(element, { model, openMark, drawMark }) => {
			// Lite's UI and renderer run in the same-origin workspace iframe. Share the top-level clock.
			const clock = window.top!.performance;
			let opened = false;
			element.addEventListener(
				model.app === 'studio' ? 'click' : 'keydown',
				(event) => {
					if (!event.isTrusted || (model.app === 'lite' && (event as KeyboardEvent).key !== 'Enter') || opened) return;
					clock.mark(openMark);
					opened = true;
				},
				{ capture: true },
			);

			if (typeof WebGL2RenderingContext === 'undefined') throw new Error('The 3D field requires WebGL 2.');
			const gl = WebGL2RenderingContext.prototype;
			const { drawElements, drawArrays, drawElementsInstanced, drawArraysInstanced } = gl;

			type LiteField = {
				parent: object;
				children: { geometry?: { index: { count: number } | null; attributes: { position?: { count: number } } } }[];
			};
			type LiteImplementation = {
				canvas: HTMLCanvasElement;
				field: LiteField | null;
				isFieldLoading: boolean;
				lastFieldId: string;
				wpilibCoordinateGroup: object;
			};
			const { tabs } = window as typeof window & {
				tabs?: { getSelectedTab(): number; tabList: { renderer: { implementation?: LiteImplementation } }[] };
			};
			const indices = new Set(model.app === 'studio' ? model.counts.indices : []);
			const vertices = new Set(model.app === 'studio' ? model.counts.vertices : []);

			function isFieldDraw(canvas: HTMLCanvasElement, count: number, indexed: boolean) {
				if (model.app === 'studio') {
					return (
						(indexed ? indices : vertices).has(count) &&
						canvas.matches('[role="application"][aria-label^="Robot poses on the "] canvas')
					);
				}
				if (!canvas.matches('.field-3d-canvas')) return false;
				const implementation = tabs?.tabList[tabs.getSelectedTab()]?.renderer.implementation;
				if (
					implementation?.canvas !== canvas ||
					implementation.lastFieldId !== model.id ||
					implementation.isFieldLoading
				)
					return false;
				const { field } = implementation;
				// The Lite worker merges the GLB into these meshes, then the renderer attaches them to the scene.
				// Match the loaded field, not the spinner, built-in axes, or a staged game piece.
				return (
					field?.parent === implementation.wpilibCoordinateGroup &&
					field.children.some(
						({ geometry }) =>
							geometry &&
							(indexed
								? geometry.index?.count === count
								: geometry.index === null && geometry.attributes.position?.count === count),
					)
				);
			}

			function observeDraw(context: WebGL2RenderingContext, mode: number, count: number, indexed: boolean) {
				const { canvas } = context;
				if (
					!opened ||
					mode !== gl.TRIANGLES ||
					count <= 0 ||
					!(canvas instanceof HTMLCanvasElement) ||
					!isFieldDraw(canvas, count, indexed)
				)
					return;
				const drawTime = clock.now();
				// Require a nonempty canvas framebuffer draw, not a shadow map or other offscreen pass.
				if (context.isContextLost() || context.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null) return;
				clock.mark(drawMark, { startTime: drawTime });
				Object.assign(gl, { drawElements, drawArrays, drawElementsInstanced, drawArraysInstanced });
			}

			gl.drawElements = function (this: WebGL2RenderingContext, mode, count, type, offset) {
				drawElements.call(this, mode, count, type, offset);
				observeDraw(this, mode, count, true);
			};
			gl.drawArrays = function (this: WebGL2RenderingContext, mode, first, count) {
				drawArrays.call(this, mode, first, count);
				observeDraw(this, mode, count, false);
			};
			gl.drawElementsInstanced = function (this: WebGL2RenderingContext, mode, count, type, offset, instances) {
				drawElementsInstanced.call(this, mode, count, type, offset, instances);
				if (instances > 0) observeDraw(this, mode, count, true);
			};
			gl.drawArraysInstanced = function (this: WebGL2RenderingContext, mode, first, count, instances) {
				drawArraysInstanced.call(this, mode, first, count, instances);
				if (instances > 0) observeDraw(this, mode, count, false);
			};
		},
		{ model, openMark, drawMark },
	);
}

/**
 * Time from choosing 3D on an empty Studio field widget, or pressing Enter on Lite's default 3D Field tab,
 * to the first observed WebGL draw submission of the stock field model. This is not compositor paint time.
 */
export async function measureChromeField(browser: Browser, target: ChromeTarget) {
	const counts = target.app === 'studio' ? await readStudioField(browser, target) : undefined;
	const context = await newChromeContext(browser, target);
	try {
		const page = await openWorkspace(context, target);
		if (counts) {
			await addStudioField(page);
			const control = page.getByRole('radio', { name: '3D', exact: true });
			await watchField(control, { app: 'studio', counts });
			await control.click();
		} else {
			const workspace = page.frameLocator(liteWorkspace);
			// Wait for the bundled field metadata, without opening the 3D tab or fetching its meshes.
			const id = await workspace
				.locator('.controls-content .field-3d-settings select:has(option:checked)')
				.evaluate((select) => {
					const { assets } = window as typeof window & {
						assets?: { field3ds: { id: string; name: string; path: string; isFTC: boolean }[] };
					};
					const { value } = select as HTMLSelectElement;
					if (
						!assets?.field3ds.some(
							(field) =>
								field.id === value && field.name === '2026 Field' && !field.isFTC && field.path.endsWith('.glb'),
						)
					) {
						throw new Error('Expected the default Lite 3D tab to use the bundled 2026 FRC field.');
					}
					return value;
				});
			const control = workspace.locator('.tab').filter({ hasText: /3D Field$/u });
			await watchField(control, { app: 'lite', id });
			await control.press('Enter');
		}
		const duration = await page
			.waitForFunction(
				({ openMark, drawMark }) => {
					const start = performance.getEntriesByName(openMark)[0];
					const end = performance.getEntriesByName(drawMark)[0];
					return start && end ? { firstFieldMs: end.startTime - start.startTime } : null;
				},
				{ openMark, drawMark },
				{ timeout },
			)
			.catch((error: unknown) => {
				throw new Error(
					`No stock field model draw was observed for ${target.app}. Check the field asset and WebGL 2 support.`,
					{ cause: error },
				);
			});
		if (
			await page.evaluate(() => performance.getEntriesByType('visibility-state').some(({ name }) => name === 'hidden'))
		) {
			throw new Error('Chrome hid the benchmark page during the 3D field check.');
		}
		return (await duration.jsonValue())!;
	} finally {
		await context.close();
	}
}
