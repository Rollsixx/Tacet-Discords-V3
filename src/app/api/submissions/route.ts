import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type Submission = {
  id: string;
  uid: string;
  ign: string;
  slots: (string | null)[];
  status: "pending";
  createdAt: string;
};

const directory = join(homedir(), ".tacet-discords-v3");
const database = join(directory, "submissions.json");
const lockPath = join(directory, "submissions.lock");

const MAX_BODY_BYTES = 32768;
const MAX_RECORDS = 10000;

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validate(value: unknown): {
  uid: string;
  ign: string;
  slots: (string | null)[];
} | null {
  if (!isRecord(value)) return null;

  const { uid, ign, slots } = value;

  if (
    typeof uid !== "string" ||
    !/^[0-9]{8,12}$/.test(uid) ||
    typeof ign !== "string" ||
    ign.trim().length < 2 ||
    ign.trim().length > 32 ||
    /[\u0000-\u001f\u007f]/.test(ign) ||
    !Array.isArray(slots) ||
    slots.length !== 5 ||
    !slots.every(
      (slot) =>
        slot === null ||
        (typeof slot === "string" && slot.length <= 256),
    )
  ) {
    return null;
  }

  return {
    uid,
    ign: ign.trim(),
    slots: slots as (string | null)[],
  };
}

async function acquireLock() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (
        !isRecord(error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    }
  }

  throw new Error("Submission store busy");
}

async function readSubmissions(): Promise<Submission[]> {
  let raw: string;

  try {
    raw = await readFile(database, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid submission store");
  }

  return parsed as Submission[];
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return failure("JSON content type required.", 415);
  }

  const length = request.headers.get("content-length");

  if (
    length !== null &&
    (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)
  ) {
    return failure("Request too large.", 413);
  }

  let input: ReturnType<typeof validate>;

  try {
    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return failure("Request too large.", 413);
    }

    input = validate(JSON.parse(raw));
  } catch {
    return failure("Invalid JSON.", 400);
  }

  if (!input) {
    return failure(
      "Valid UID, IGN and five scanner slots required.",
      400,
    );
  }

  let lock: Awaited<ReturnType<typeof open>> | null = null;

  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    lock = await acquireLock();

    const submissions = await readSubmissions();

    if (submissions.length >= MAX_RECORDS) {
      return failure("Development store full.", 503);
    }

    const now = Date.now();

    const recent = submissions.some(
      (submission) =>
        submission.uid === input.uid &&
        now - Date.parse(submission.createdAt) < 60000,
    );

    if (recent) {
      return failure("Please wait before resubmitting.", 429);
    }

    const submission: Submission = {
      id: randomUUID(),
      uid: input.uid,
      ign: input.ign,
      slots: input.slots,
      status: "pending",
      createdAt: new Date(now).toISOString(),
    };

    submissions.push(submission);

    const temporary = join(
      directory,
      `submissions-${randomUUID()}.tmp`,
    );

    try {
      const file = await open(temporary, "wx", 0o600);

      try {
        await file.writeFile(
          JSON.stringify(submissions, null, 2),
          "utf8",
        );
      } finally {
        await file.close();
      }

      await rename(temporary, database);
    } finally {
      await unlink(temporary).catch(() => {});
    }

    return NextResponse.json(
      {
        ok: true,
        id: submission.id,
        status: "pending",
        createdAt: submission.createdAt,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return failure("Submission service unavailable.", 503);
  } finally {
    if (lock) {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }
}