import "server-only";

/** Error raised before an untrusted request body can consume unbounded memory. */
export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

interface BodySource {
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}

function declaredLength(headers: Headers): number | null {
  const value = headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new RequestBodyError("Invalid Content-Length.", 400);
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw new RequestBodyError("Invalid Content-Length.", 400);
  return length;
}

/** Read a Request/Response stream while enforcing the limit even for chunked bodies. */
export async function readBodyBytes(source: BodySource, maxBytes: number): Promise<Uint8Array> {
  const length = declaredLength(source.headers);
  if (length !== null && length > maxBytes) {
    throw new RequestBodyError("Request body is too large.", 413);
  }
  if (!source.body) return new Uint8Array();

  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new RequestBodyError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function isJsonContentType(value: string): boolean {
  const mediaType = value.split(";", 1)[0]!.trim().toLowerCase();
  return mediaType === "application/json" || (mediaType.startsWith("application/") && mediaType.endsWith("+json"));
}

/** Strict, size-bounded JSON parser for public and privileged API routes. */
export async function readJsonBody<T>(req: Request, maxBytes = 32 * 1024): Promise<T> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!isJsonContentType(contentType)) {
    throw new RequestBodyError("Expected application/json.", 415);
  }
  const bytes = await readBodyBytes(req, maxBytes);
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RequestBodyError("Expected a JSON object.", 400);
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Malformed JSON.", 400);
  }
}

/** Size-bounded multipart parser. Native parsing only starts after the cap held. */
export async function readMultipartFormData(req: Request, maxBytes: number): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary=/i.test(contentType)) {
    throw new RequestBodyError("Expected multipart/form-data.", 415);
  }
  const bytes = await readBodyBytes(req, maxBytes);
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return await new Response(copy.buffer, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new RequestBodyError("Malformed multipart body.", 400);
  }
}
