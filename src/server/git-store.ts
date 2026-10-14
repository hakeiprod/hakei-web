import "server-only";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const oidPattern = /^[a-f0-9]{40}$/;
const keyPattern = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,127}$/;
const pathPattern =
  /^scores\/[1-9][0-9]*\/(score|settings|diagnostics|validation)\.json$/;
const referencePattern =
  /^refs\/(retention\/[a-f0-9]{40}|heads\/main|operations\/[a-zA-Z0-9_-]+|proposals\/[a-zA-Z0-9_-]+)$/;
const zeroOid = "0".repeat(40);
function check(value: string, pattern: RegExp, name: string) {
  if (!pattern.test(value)) throw new Error(`Invalid Git ${name}`);
}
/** Only fixed score files and service-owned refs are accessible. Never invokes a shell. */
export class GitStore {
  constructor(private readonly root: string) {
    if (!path.isAbsolute(root))
      throw new Error("SCORE_GIT_ROOT must be absolute");
  }
  private directory(key: string) {
    check(key, keyPattern, "storage key");
    return path.join(this.root, `${key}.git`);
  }
  private run(
    key: string,
    arguments_: string[],
    input?: string,
    index?: string,
  ): Promise<string> {
    const directory = this.directory(key);
    return new Promise((resolve, reject) => {
      // Do not inherit Git config, alternate object stores, credentials or hooks from the host.
      const child = spawn(
        "git",
        [
          "--git-dir",
          directory,
          "-c",
          "core.hooksPath=/dev/null",
          ...arguments_,
        ],
        {
          shell: false,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH,
            HOME: tmpdir(),
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_AUTHOR_NAME: "Hakei",
            GIT_AUTHOR_EMAIL: "scores@localhost",
            GIT_COMMITTER_NAME: "Hakei",
            GIT_COMMITTER_EMAIL: "scores@localhost",
            ...(index ? { GIT_INDEX_FILE: index } : {}),
          },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let output = "";
      let error = "";
      let size = 0;
      const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) child.kill("SIGKILL");
        else output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (error.length < 4096) error += chunk.toString();
      });
      child.on("error", (cause) => {
        clearTimeout(timer);
        reject(cause);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(output.trimEnd());
        else reject(new Error(`Git command failed (${code}): ${error}`));
      });
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    });
  }
  async initialize(key: string) {
    const directory = this.directory(key);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await this.run(key, [
      "init",
      "--bare",
      "--object-format=sha1",
      "--initial-branch=main",
      directory,
    ]);
  }
  async commit(
    key: string,
    parent: string | undefined,
    files: Record<string, unknown>,
    message: string,
  ) {
    this.directory(key);
    if (parent) check(parent, oidPattern, "parent OID");
    for (const path of Object.keys(files)) check(path, pathPattern, "path");
    const temporary = await mkdtemp(path.join(tmpdir(), "hakei-index-"));
    const index = path.join(temporary, "index");
    try {
      await this.run(
        key,
        ["read-tree", ...(parent ? [parent] : ["--empty"])],
        undefined,
        index,
      );
      for (const [path, data] of Object.entries(files)) {
        const json = JSON.stringify(data);
        if (json === undefined || Buffer.byteLength(json) > 20 * 1024 * 1024)
          throw new Error("Invalid score JSON size");
        const blob = await this.run(
          key,
          ["hash-object", "-w", "--stdin"],
          json,
        );
        await this.run(
          key,
          ["update-index", "--add", "--cacheinfo", "100644", blob, path],
          undefined,
          index,
        );
      }
      const tree = await this.run(key, ["write-tree"], undefined, index);
      return await this.run(
        key,
        ["commit-tree", tree, ...(parent ? ["-p", parent] : [])],
        message,
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  async updateRef(
    key: string,
    reference: string,
    target: string,
    expected?: string,
  ) {
    check(reference, referencePattern, "ref");
    check(target, oidPattern, "target OID");
    if (expected) check(expected, oidPattern, "expected OID");
    await this.run(key, ["update-ref", reference, target, expected ?? zeroOid]);
  }
  async readRef(key: string, reference: string): Promise<string | undefined> {
    check(reference, referencePattern, "ref");
    try {
      return await this.run(key, ["show-ref", "--verify", "--hash", reference]);
    } catch {
      // Distinguish an absent ref from storage/process failures.
      await this.run(key, ["rev-parse", "--git-dir"]);
      const references = await this.run(key, [
        "for-each-ref",
        "--format=%(refname)",
        reference,
      ]);
      if (!references) return undefined;
      throw new Error("Cannot read Git ref");
    }
  }
  async repositoryExists(key: string) {
    try {
      const directory = await lstat(this.directory(key));
      return directory.isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  async verifyRepository(key: string) {
    await this.run(key, ["fsck", "--full", "--strict"]);
  }
  async listRefs(key: string) {
    const result = await this.run(key, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]);
    return result
      ? result.split("\n").map((line) => {
          const [reference, oid] = line.split(" ");
          check(reference, referencePattern, "ref");
          check(oid, oidPattern, "OID");
          return { ref: reference, oid };
        })
      : [];
  }
  async verifyCommit(key: string, oid: string) {
    check(oid, oidPattern, "OID");
    await this.run(key, ["cat-file", "-e", `${oid}^{commit}`]);
  }
  async retainCommit(key: string, oid: string) {
    check(oid, oidPattern, "OID");
    const reference = `refs/retention/${oid}`;
    const current = await this.readRef(key, reference);
    if (current !== oid) await this.updateRef(key, reference, oid, current);
  }
  async garbageCollect(key: string) {
    await this.run(key, ["gc", "--prune=now"]);
  }
  async hasScoreFile(key: string, oid: string, path: string): Promise<boolean> {
    check(oid, oidPattern, "OID");
    check(path, pathPattern, "path");
    return (
      (await this.run(key, ["ls-tree", "--name-only", oid, "--", path])) ===
      path
    );
  }
  async readJson(key: string, oid: string, path: string): Promise<unknown> {
    check(oid, oidPattern, "OID");
    check(path, pathPattern, "path");
    return JSON.parse(await this.run(key, ["show", `${oid}:${path}`]));
  }
}
