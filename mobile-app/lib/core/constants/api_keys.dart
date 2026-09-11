/// JSON keys used across request and response models. Models must never
/// repeat a raw key string.
class ApiKeys {
  // ── Envelope ─────────────────────────────────────────────────────────────
  static const String success = 'success';
  static const String data = 'data';
  static const String meta = 'meta';
  static const String error = 'error';
  static const String errors = 'errors';
  static const String message = 'message';
  static const String code = 'code';
  static const String details = 'details';
  static const String requestId = 'requestId';

  /// Each entry in `error.details` names the offending field and the rule it
  /// broke, which is what binds a server error back to a form input.
  static const String field = 'field';
  static const String constraint = 'constraint';
  static const String value = 'value';

  // ── Pagination ───────────────────────────────────────────────────────────
  static const String items = 'items';
  static const String page = 'page';
  static const String limit = 'limit';
  static const String total = 'total';
  static const String totalPages = 'totalPages';
  static const String hasNext = 'hasNext';
  static const String nextCursor = 'nextCursor';

  /// The `nextCursor` from the previous keyset page, sent back as a query param.
  static const String cursor = 'cursor';

  // ── Common entity fields ─────────────────────────────────────────────────
  static const String id = 'id';
  static const String name = 'name';
  static const String status = 'status';
  static const String notes = 'notes';
  static const String createdAt = 'createdAt';
  static const String updatedAt = 'updatedAt';
  static const String occurredAt = 'occurredAt';
  static const String isActive = 'isActive';
  static const String clientUuid = 'clientUuid';

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String phone = 'phone';
  static const String password = 'password';
  static const String currentPassword = 'currentPassword';
  static const String newPassword = 'newPassword';
  static const String deviceId = 'deviceId';
  static const String deviceModel = 'deviceModel';
  static const String platform = 'platform';

  /// Sent to `POST /auth/devices`, never in the login body — the login DTO
  /// rejects unknown fields.
  static const String pushToken = 'pushToken';

  static const String accessToken = 'accessToken';
  static const String refreshToken = 'refreshToken';
  static const String expiresIn = 'expiresIn';
  static const String refreshExpiresAt = 'refreshExpiresAt';
  static const String permissions = 'permissions';
  static const String mustChangePassword = 'mustChangePassword';
  static const String biometricEnabled = 'biometricEnabled';
  static const String signatureImageUrl = 'signatureImageUrl';

  /// `GET /auth/me` returns the profile flat, with `role` and `branch` as
  /// nested objects — there is no `user` wrapper.
  static const String fullName = 'fullName';
  static const String email = 'email';
  static const String role = 'role';
  static const String branch = 'branch';
  static const String branchId = 'branchId';
  static const String branchName = 'branchName';

  // ── Users, roles & permissions ───────────────────────────────────────────
  static const String roleId = 'roleId';
  static const String userId = 'userId';
  static const String displayName = 'displayName';
  static const String description = 'description';
  static const String isSystem = 'isSystem';
  static const String permissionCount = 'permissionCount';
  static const String lastLoginAt = 'lastLoginAt';
  static const String warehouse = 'warehouse';

  /// `GET /permissions` groups the catalogue by module and localizes both the
  /// group label and each permission's display name.
  static const String group = 'group';
  static const String label = 'label';

  /// `GET /users/:id/permissions` separates what the role grants from the
  /// per-user overrides, and returns the resolved set alongside both.
  static const String rolePermissions = 'rolePermissions';
  static const String overrides = 'overrides';
  static const String effectivePermissions = 'effectivePermissions';
  static const String effect = 'effect';

  /// `PUT /users/:id/permissions` takes the two override lists by code.
  static const String allow = 'allow';
  static const String deny = 'deny';

  // ── List query parameters ────────────────────────────────────────────────
  static const String search = 'search';
  static const String sortBy = 'sortBy';
  static const String sortDir = 'sortDir';

  // ── Machines ─────────────────────────────────────────────────────────────
  static const String serial = 'serial';

  /// SIM card serial (ICCID). Required by the backend for machine types whose
  /// [requiresSim] is true, and rejected for those where it is false.
  static const String simSerial = 'simSerial';

  /// Carton serial. Optional for every type — not every factory prints one.
  static const String boxSerial = 'boxSerial';
  static const String qrPayload = 'qrPayload';
  static const String machineModelId = 'machineModelId';
  static const String machineModelName = 'machineModelName';
  static const String machineTypeId = 'machineTypeId';
  static const String machineTypeName = 'machineTypeName';

  /// Whether the machine type carries a SIM. Drives whether the form shows the
  /// SIM field at all: a PIN pad has no mobile line.
  static const String requiresSim = 'requiresSim';

  /// Which of the four serials a QR lookup matched: MACHINE, BATTERY, SIM, BOX.
  static const String matchedOn = 'matchedOn';
  static const String purchasePrice = 'purchasePrice';
  static const String purchaseDate = 'purchaseDate';
  static const String warrantyStart = 'warrantyStart';
  static const String warrantyEnd = 'warrantyEnd';
  static const String currentHolderType = 'currentHolderType';
  static const String currentHolderId = 'currentHolderId';
  static const String currentHolderName = 'currentHolderName';
  static const String hasBox = 'hasBox';
  static const String totalRepairCost = 'totalRepairCost';
  static const String repairCount = 'repairCount';
  static const String battery = 'battery';
  static const String batterySerial = 'batterySerial';
  static const String factoryInvoiceNo = 'factoryInvoiceNo';
  static const String decommissionedAt = 'decommissionedAt';
  static const String replacedByMachineId = 'replacedByMachineId';
  static const String replacesMachineId = 'replacesMachineId';

  /// The machine detail response nests these rather than flattening them, so a
  /// warranty or a purchase can be read as one thing.
  static const String warranty = 'warranty';
  static const String purchase = 'purchase';
  static const String maintenance = 'maintenance';
  static const String holder = 'holder';
  static const String model = 'model';
  static const String machine = 'machine';
  static const String machines = 'machines';
  static const String start = 'start';
  static const String end = 'end';
  static const String daysRemaining = 'daysRemaining';
  static const String price = 'price';
  static const String date = 'date';
  static const String invoiceNo = 'invoiceNo';
  static const String costVsPricePercent = 'costVsPricePercent';
  static const String manufacturer = 'manufacturer';
  static const String machineType = 'machineType';

  // Query-string only, so they have no counterpart in any response body.
  static const String holderType = 'holderType';
  static const String holderId = 'holderId';
  static const String warrantyExpiringBefore = 'warrantyExpiringBefore';
  static const String minRepairCost = 'minRepairCost';
  static const String includeRetired = 'includeRetired';

  // ── Transfers ────────────────────────────────────────────────────────────
  static const String referenceNo = 'referenceNo';

  /// The branch a pickable receiver belongs to, or null for a warehouse.
  static const String subtitle = 'subtitle';

  static const String receiverKind = 'receiverKind';
  static const String selfAttested = 'selfAttested';
  static const String allowedFromStatuses = 'allowedFromStatuses';

  static const String type = 'type';
  static const String direction = 'direction';
  static const String fromPartyType = 'fromPartyType';
  static const String fromPartyId = 'fromPartyId';
  static const String fromPartyName = 'fromPartyName';
  static const String toPartyType = 'toPartyType';
  static const String toPartyId = 'toPartyId';
  static const String toPartyName = 'toPartyName';
  static const String machineId = 'machineId';
  static const String batterySerialScanned = 'batterySerialScanned';
  static const String batteryMatches = 'batteryMatches';
  static const String simSerialScanned = 'simSerialScanned';
  static const String simMatches = 'simMatches';
  static const String boxSerialScanned = 'boxSerialScanned';
  static const String boxMatches = 'boxMatches';
  static const String hasCharger = 'hasCharger';
  static const String condition = 'condition';
  static const String photos = 'photos';
  static const String signature = 'signature';
  static const String signatures = 'signatures';
  static const String senderSignature = 'senderSignature';
  static const String signatureMediaId = 'signatureMediaId';
  static const String payloadHash = 'payloadHash';
  static const String rejectionReason = 'rejectionReason';

  /// The transfer detail response nests parties as `{ type, id, name }` rather
  /// than flattening them, because a party is a polymorphic thing: a user, a
  /// warehouse, a merchant, or nothing at all.
  static const String from = 'from';
  static const String to = 'to';
  static const String partyRole = 'partyRole';
  static const String userFullName = 'userFullName';
  static const String signedAt = 'signedAt';
  static const String confirmedAt = 'confirmedAt';
  static const String itemsCount = 'itemsCount';
  static const String violationsCount = 'violationsCount';
  static const String transferId = 'transferId';
  static const String transferItemId = 'transferItemId';
  static const String adjustments = 'adjustments';
  static const String photoMediaIds = 'photoMediaIds';
  static const String mediaId = 'mediaId';
  static const String reason = 'reason';
  static const String valid = 'valid';
  static const String problems = 'problems';

  // Query-string only.
  static const String dateFrom = 'dateFrom';
  static const String dateTo = 'dateTo';
  static const String hasViolations = 'hasViolations';

  // ── Merchants ────────────────────────────────────────────────────────────
  static const String merchantId = 'merchantId';
  static const String shopName = 'shopName';
  static const String address = 'address';
  static const String nationalId = 'nationalId';
  static const String planType = 'planType';
  static const String amount = 'amount';
  static const String startDate = 'startDate';
  static const String endDate = 'endDate';
  static const String nextDueDate = 'nextDueDate';
  static const String machinesCount = 'machinesCount';
  static const String registeredBy = 'registeredBy';
  static const String activeSubscription = 'activeSubscription';
  static const String totalPaid = 'totalPaid';
  static const String totalCollected = 'totalCollected';
  static const String collectionCount = 'collectionCount';
  static const String lastCollectedAt = 'lastCollectedAt';
  static const String isOverdue = 'isOverdue';
  static const String machineSerial = 'machineSerial';
  static const String collectedAt = 'collectedAt';
  static const String paymentMethodId = 'paymentMethodId';
  static const String invoiceMediaId = 'invoiceMediaId';
  static const String warnings = 'warnings';
  static const String existing = 'existing';
  static const String createdByUserId = 'createdByUserId';
  static const String hasMachines = 'hasMachines';
  static const String includeInactive = 'includeInactive';

  // ── Finance ──────────────────────────────────────────────────────────────
  static const String kind = 'kind';
  static const String categoryId = 'categoryId';
  static const String categoryName = 'categoryName';
  static const String parentId = 'parentId';
  static const String children = 'children';
  static const String directTotal = 'directTotal';
  static const String rolledUpTotal = 'rolledUpTotal';
  static const String income = 'income';
  static const String expense = 'expense';
  static const String net = 'net';
  static const String budgetAmount = 'budgetAmount';
  static const String spentAmount = 'spentAmount';
  static const String period = 'period';

  // ── Machine timeline ─────────────────────────────────────────────────────
  static const String at = 'at';
  static const String refId = 'refId';
  static const String refNo = 'refNo';

  // ── Maintenance history (read-only; `11` owns the write side) ───────────
  static const String location = 'location';
  static const String sentAt = 'sentAt';
  static const String returnedAt = 'returnedAt';
  static const String isFreeUnderWarranty = 'isFreeUnderWarranty';
  static const String responsibleParty = 'responsibleParty';
  static const String result = 'result';
  static const String orders = 'orders';
  static const String totalCost = 'totalCost';
  static const String freeUnderWarranty = 'freeUnderWarranty';
  static const String chargedToCompany = 'chargedToCompany';
  static const String chargedToRepresentative = 'chargedToRepresentative';
  static const String chargedToMerchant = 'chargedToMerchant';
  static const String chargedToFactory = 'chargedToFactory';

  // ── Violations & maintenance ─────────────────────────────────────────────
  static const String severity = 'severity';
  static const String violationTypeId = 'violationTypeId';
  static const String typeId = 'typeId';
  static const String violationTypeName = 'violationTypeName';
  static const String chargeAmount = 'chargeAmount';
  static const String cost = 'cost';
  static const String closedAt = 'closedAt';
  static const String defaultSeverity = 'defaultSeverity';
  static const String sortOrder = 'sortOrder';
  static const String user = 'user';
  static const String count = 'count';
  static const String chargedAmount = 'chargedAmount';
  static const String chargedAt = 'chargedAt';
  static const String waiverReason = 'waiverReason';
  static const String acknowledgedAt = 'acknowledgedAt';
  static const String resolvedAt = 'resolvedAt';
  static const String autoGenerated = 'autoGenerated';
  static const String isEditable = 'isEditable';
  static const String totals = 'totals';
  static const String byType = 'byType';
  static const String bySeverity = 'bySeverity';
  static const String totalCharged = 'totalCharged';
  static const String last12Months = 'last12Months';
  static const String trend = 'trend';
  static const String month = 'month';
  static const String all = 'all';
  static const String open = 'open';
  static const String charged = 'charged';
  static const String waived = 'waived';

  // ── Notifications ────────────────────────────────────────────────────────
  static const String title = 'title';
  static const String body = 'body';
  static const String isRead = 'isRead';
  static const String readAt = 'readAt';
  static const String deepLink = 'deepLink';
  static const String unreadCount = 'unreadCount';

  // ── Media ────────────────────────────────────────────────────────────────
  static const String uploadUrl = 'uploadUrl';
  static const String fileKey = 'fileKey';
  static const String contentType = 'contentType';
  static const String url = 'url';
  static const String purpose = 'purpose';
  static const String mimeType = 'mimeType';
  static const String sizeBytes = 'sizeBytes';
  static const String checksum = 'checksum';
  static const String storageKey = 'storageKey';
  static const String expiresAt = 'expiresAt';
  static const String isConfirmed = 'isConfirmed';
  static const String method = 'method';

  // ── Sync ─────────────────────────────────────────────────────────────────
  static const String since = 'since';
  static const String operations = 'operations';
  static const String entity = 'entity';
  static const String payload = 'payload';
  static const String results = 'results';

  // ── Maintenance, replacement, decommission (`11`) ───────────────────────
  static const String locationId = 'locationId';
  static const String reportedFault = 'reportedFault';
  static const String suggestedFreeUnderWarranty = 'suggestedFreeUnderWarranty';
  static const String warehouseId = 'warehouseId';
  static const String responsibleUserId = 'responsibleUserId';
  static const String responsibleMerchantId = 'responsibleMerchantId';
  static const String supplierId = 'supplierId';
  static const String performedByName = 'performedByName';
  static const String outTransferId = 'outTransferId';
  static const String inTransferId = 'inTransferId';
  static const String financeTransactionId = 'financeTransactionId';
  static const String violationId = 'violationId';
  static const String subscriptionId = 'subscriptionId';
  static const String replacementMachineId = 'replacementMachineId';
  static const String closedByUserId = 'closedByUserId';
  static const String cancelledAt = 'cancelledAt';
  static const String cancelReason = 'cancelReason';
  static const String newSerial = 'newSerial';
  static const String newBattery = 'newBattery';
  static const String newSimSerial = 'newSimSerial';
  static const String newBoxSerial = 'newBoxSerial';
  static const String newWarrantyStart = 'newWarrantyStart';
  static const String newWarrantyEnd = 'newWarrantyEnd';
  static const String replacedAt = 'replacedAt';
  static const String replacement = 'replacement';
  static const String oldMachine = 'oldMachine';
  static const String newMachine = 'newMachine';
  static const String oldMachineId = 'oldMachineId';
  static const String newMachineId = 'newMachineId';
  static const String maintenanceOrderId = 'maintenanceOrderId';
  static const String reasonId = 'reasonId';
  static const String reasonCode = 'reasonCode';
  static const String reasonName = 'reasonName';
  static const String decommissionedByUserId = 'decommissionedByUserId';
  static const String snapshot = 'snapshot';
  static const String cumulativeRepairCost = 'cumulativeRepairCost';
  static const String costToValueRatio = 'costToValueRatio';
  static const String chainLength = 'chainLength';
  static const String revertedAt = 'revertedAt';
  static const String revertReason = 'revertReason';
  static const String minCostRatio = 'minCostRatio';
  static const String minRepairCount = 'minRepairCount';
  static const String minAgeMonths = 'minAgeMonths';
  static const String ageMonths = 'ageMonths';
  static const String isInChain = 'isInChain';
  static const String recommendation = 'recommendation';
  static const String lastMaintenanceAt = 'lastMaintenanceAt';
}
