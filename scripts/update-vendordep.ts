#!/usr/bin/env node

import { writeFile } from "fs/promises";
import path from "path";
import packageJson from "../lib/package.json" with { type: "json" };
import vendordep from "../vendordep.json" with { type: "json" };

vendordep.version = packageJson.version;
vendordep.javaDependencies[0].version = packageJson.version;

await writeFile(
  path.join(import.meta.dirname, "..", "vendordep.json"),
  JSON.stringify(vendordep, null, 2) + "\n",
);
