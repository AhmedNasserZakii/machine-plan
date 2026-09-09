export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  /** The routing payload of `18`: templateCode, entityType, entityId, deepLink, notificationId. */
  data: Record<string, string>;
}

export interface PushDeliveryResult {
  delivered: number;
  failed: number;
  /**
   * Tokens FCM reported as `UNREGISTERED`. The app was uninstalled or the token rotated, and
   * `18`, delivery rule 4 requires them gone from `user_devices` immediately — a dead token kept
   * around is a permanent per-send failure that hides the real ones.
   */
  unregisteredTokens: string[];
  /** Set when the whole send failed rather than individual tokens. */
  transportError?: string;
}

/**
 * The push leg, behind one verb.
 *
 * `available` is deliberately part of the contract rather than something a caller infers from a
 * thrown error: a transport with no credentials must be visibly unavailable so the dispatcher can
 * record *why* a push did not happen, instead of writing a notification row that looks delivered.
 */
export interface PushTransport {
  readonly available: boolean;
  /** Why the transport is unavailable, for the log line at boot. Null when it is available. */
  readonly unavailableReason: string | null;
  send(message: PushMessage): Promise<PushDeliveryResult>;
}
