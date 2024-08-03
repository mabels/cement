import { defineWorkspace } from "vitest/config";

import node from "./vitest.node.config.ts";
import browser from "./vitest.browser.config.ts";

export default defineWorkspace([node, browser]);
