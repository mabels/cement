import { LevelHandler, Level } from "./logger.js";
import { Option } from "./option.js";

export class LevelHandlerImpl implements LevelHandler {
  readonly _globalLevels: Set<Level> = new Set<Level>([Level.INFO, Level.ERROR, Level.WARN]);
  readonly _modules: Map<string, Set<Level>> = new Map<string, Set<Level>>();

  ignoreAttr: Option<RegExp> = Option.Some(/^_/);
  isStackExposed = false;
  enableLevel(level: Level, ...modules: string[]): void {
    if (modules.length == 0) {
      this._globalLevels.add(level);
      return;
    }
    this.forModules(
      level,
      (p) => {
        this._modules.set(p, new Set([...this._globalLevels, level]));
      },
      ...modules,
    );
  }
  disableLevel(level: Level, ...modules: string[]): void {
    if (modules.length == 0) {
      this._globalLevels.delete(level);
      return;
    }
    this.forModules(
      level,
      (p) => {
        this._modules.delete(p);
      },
      ...modules,
    );
  }

  setExposeStack(enable?: boolean): void {
    this.isStackExposed = !!enable;
  }

  setIgnoreAttr(re?: RegExp): void {
    this.ignoreAttr = Option.From(re);
  }

  forModules(level: Level, fnAction: (p: string) => void, ...modules: (string | string[])[]): void {
    for (const m of modules.flat()) {
      if (typeof m !== "string") {
        continue;
      }
      const parts = m
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length);
      for (const p of parts) {
        fnAction(p);
      }
    }
  }
  setDebug(...modules: (string | string[])[]): void {
    this.forModules(
      Level.DEBUG,
      (p) => {
        this._modules.set(p, new Set([...this._globalLevels, Level.DEBUG]));
      },
      ...modules,
    );
  }
  isEnabled(ilevel: unknown, module: unknown): boolean {
    const level = ilevel as Level; // what if it's not a level?
    if (typeof module === "string") {
      const levels = this._modules.get(module);
      if (levels && levels.has(level)) {
        return true;
      }
    }
    const wlevel = this._modules.get("*");
    if (wlevel && typeof level === "string") {
      if (wlevel.has(level)) {
        return true;
      }
    }
    if (typeof level !== "string") {
      // this is a plain log
      return true;
    }
    return this._globalLevels.has(level);
  }
}

const levelSingleton = new LevelHandlerImpl();

export function LevelHandlerSingleton(): LevelHandler {
  return levelSingleton;
}
