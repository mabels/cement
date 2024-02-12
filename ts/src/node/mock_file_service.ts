import { NamedWritableStream } from "../file_service";
import { NodeFileService } from "./node_file_service";

export interface FileCollector {
  readonly name: string;
  content: string;
}

export class MockFileService extends NodeFileService {
  readonly files = {} as Record<string, FileCollector>;

  override async create(fname: string): Promise<NamedWritableStream> {
    let oName = fname;
    if (!this.isAbsolute(fname)) {
      oName = this.abs(fname);
    }

    const fc = {
      name: oName,
      content: "",
    };
    this.files[oName] = fc;
    const decoder = new TextDecoder();

    return {
      name: oName,
      stream: new WritableStream<Uint8Array>({
        write(chunk) {
          fc.content = fc.content + decoder.decode(chunk);
        },
        close() {},
        abort() {
          throw new Error("not implemented");
        },
      }),
    };
  }
}
