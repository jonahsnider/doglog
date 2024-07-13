import fs from "fs/promises";
import path from "path";

/**
 * @typedef {{
 *  	javaDependencies: {
 *  		groupId: string;
 *  		artifactId: string;
 *  		version: string;
 *  	}[];
 *  	fileName: string;
 *  	frcYear: string;
 *  	jsonUrl: string;
 *  	name: string;
 *  	jniDependencies: [];
 *  	mavenUrls: string[];
 *  	cppDependencies: [];
 *  	version: string;
 *  	uuid: string;
 * }} Vendordep
 */

const VENDORDEP_PATH = path.join(import.meta.dirname, "..", "vendordep.json");

const rawVendordep = await fs.readFile(VENDORDEP_PATH, "utf-8");

/** @type {Vendordep} */
const vendordep = JSON.parse(rawVendordep);

let changed = false;

for (const javaDependency of vendordep.javaDependencies) {
  if (!vendordep.javaDependencies[0].version.startsWith("v")) {
    javaDependency.version = `v${javaDependency.version}`;
    changed = true;
  }
}

if (!vendordep.version.startsWith("v")) {
  vendordep.version = `v${vendordep.version}`;
  changed = true;
}

if (changed) {
  await fs.writeFile(VENDORDEP_PATH, JSON.stringify(vendordep, null, 2) + "\n");
}
