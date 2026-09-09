export interface StoredObject {
  sizeBytes: number;
  checksum: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/**
 * The one surface every object storage backend implements (`19`). `StorageService` selects an
 * implementation at construction time based on environment configuration; nothing outside this
 * directory should ever depend on which one is active.
 */
export interface StorageAdapter {
  put(storageKey: string, body: Buffer): Promise<StoredObject>;
  /** `null` when the object was never uploaded — the normal outcome of a failed field upload. */
  head(storageKey: string): Promise<StoredObject | null>;
  get(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<void>;
  /** A URL the client may `PUT` raw bytes to, valid for the configured TTL. */
  uploadUrl(storageKey: string): Promise<SignedUrl>;
  /** A short-lived read URL. Objects are private; this is the only way out. */
  downloadUrl(storageKey: string): Promise<SignedUrl>;
}
