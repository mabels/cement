const reScopedPkg = /^(@[^/]+\/[^/]+)(\/.*)?$/;
const rePkg = /^([^/@]+)(\/.*)?$/;

export class NPMPackage {
  readonly givenPkg: string; // the original package string provided, e.g., "react" or "@scope/package/extra"
  readonly pkg: string; // e.g., "react" or "@scope/package"
  readonly suffix?: string; // e.g., "/extra/path" if the package string has more segments

  static parse(pkgStr: string): NPMPackage {
    const scopedMatch = reScopedPkg.exec(pkgStr);
    if (scopedMatch) {
      return new NPMPackage({ givenPkg: pkgStr, pkg: scopedMatch[1], suffix: scopedMatch[2] });
    }
    const unscopedMatch = rePkg.exec(pkgStr);
    if (unscopedMatch) {
      return new NPMPackage({ givenPkg: pkgStr, pkg: unscopedMatch[1], suffix: unscopedMatch[2] });
    }
    throw new Error(`Invalid package string: ${JSON.stringify(pkgStr)}`);
  }

  constructor({ givenPkg, pkg, suffix }: { givenPkg: string; pkg: string; suffix?: string }) {
    this.givenPkg = givenPkg;
    this.pkg = pkg;
    this.suffix = suffix;
  }
}
