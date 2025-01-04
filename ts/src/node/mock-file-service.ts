import { NamedWritableStream } from "../file-service.js";
import { NodeFileService } from "./node-file-service.js";

export interface FileCollector {
  readonly name: string;
  content: string;
}

export class MockFileService extends NodeFileService {
  readonly files = {} as Record<string, FileCollector>;

  // override abs(fname: string): string {
  //   return this.join("/mock/", fname);
  // }

  override create(fname: string): Promise<NamedWritableStream> {
    let oName = fname;
    if (!this.isAbsolute(fname)) {
      oName = this.abs(fname);
    }

    const fc = {
      name: oName,
      content: "",
    };
    this.files[oName] = fc;
    this.files[fname] = fc;
    const decoder = new TextDecoder();

    return Promise.resolve({
      name: oName,
      stream: new WritableStream<Uint8Array>({
        write(chunk): void {
          fc.content = fc.content + decoder.decode(chunk);
        },
        close(): void {
          // do nothing
        },
        abort(): void {
          throw new Error("not implemented");
        },
      }),
    });
  }
}
