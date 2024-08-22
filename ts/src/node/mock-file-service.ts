import { NamedWritableStream } from "../file-service";
import { NodeFileService } from "./node-file-service";

export interface FileCollector {
  readonly name: string;
  content: string;
}

export class MockFileService extends NodeFileService {
  readonly files = {} as Record<string, FileCollector>;

  // override abs(fname: string): string {
  //   return this.join("/mock/", fname);
  // }

  override async create(fname: string): Promise<NamedWritableStream> {
    let oName = fname;
    if (!this.isAbsolute(fname)) {
      oName = await this.abs(fname);
    }

    const fc = {
      name: oName,
      content: "",
    };
    this.files[oName] = fc;
    this.files[fname] = fc;
    const decoder = new TextDecoder();

    return {
      name: oName,
      stream: new WritableStream<Uint8Array>({
        write(chunk) {
          fc.content = fc.content + decoder.decode(chunk);
        },
        close() {
          // do nothing
        },
        abort() {
          throw new Error("not implemented");
        },
      }),
    };
  }
}
