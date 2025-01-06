import { defineWorkspace } from "vitest/config";

import node from "./vitest.node.config.js";
import deno from "./vitest.deno.config.js";
import browser from "./vitest.browser.config.js";
import cfRuntime from "./vitest.cf-runtime.config.js";

export default defineWorkspace([node, browser, cfRuntime, deno]);
