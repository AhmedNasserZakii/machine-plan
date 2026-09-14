class LocaleKeys {
  // ── App ──────────────────────────────────────────────────────────────────
  static const String appName = 'app_name';

  // ── Validation ───────────────────────────────────────────────────────────
  static const String thisFieldIsRequired = 'this_field_is_required';
  static const String thisFieldIsNotValid = 'this_field_is_not_valid';
  static const String thisFieldIsNotMinusOrZero =
      'this_field_is_not_minus_or_zero';
  static const String invalidPhoneNumber = 'invalid_phone_number';
  static const String passwordMinEight = 'password_min_eight';
  static const String passwordNoCorrect = 'password_no_correct';
  static const String invalidSerialNumber = 'invalid_serial_number';

  // ── Networking & failures ────────────────────────────────────────────────
  static const String connectionTimeOutWithApiServer =
      'connection_time_out_with_api_server';
  static const String sendTimeOutWithApiServer =
      'send_time_out_with_api_server';
  static const String receiveTimeOutWithApiServer =
      'receive_time_out_with_api_server';
  static const String badCertificateWithApiServer =
      'bad_certificate_with_api_server';
  static const String requestToApiServerWasCanceled =
      'request_to_api_server_was_canceled';
  static const String connectionErrorWithApiServer =
      'connection_error_with_api_server';
  static const String unknownErrorWithApiServer =
      'unknown_error_with_api_server';
  static const String noInternetConnection = 'no_internet_connection';
  static const String internetConnectionLostSubtitle =
      'internet_connection_lost_subtitle';
  static const String anErrorOccurred = 'an_error_occurred';
  static const String paginationListTooLarge = 'pagination_list_too_large';
  static const String oopsThereWasAnError = 'oops_there_was_an_error';
  static const String internalServerError = 'internal_server_error';
  static const String yourRequestNotFound = 'your_request_not_found';
  static const String unauthorized = 'unauthorized';
  static const String unauthorizedMessage = 'unauthorized_message';
  static const String sessionExpired = 'session_expired';
  static const String sessionExpiredMessage = 'session_expired_message';
  static const String upgradeRequiredTitle = 'upgrade_required_title';
  static const String upgradeRequiredMessage = 'upgrade_required_message';
  static const String upgradeRequiredUpdate = 'upgrade_required_update';
  static const String upgradeRequiredMinVersion =
      'upgrade_required_min_version';
  static const String upgradeRequiredCurrentVersion =
      'upgrade_required_current_version';
  static const String upgradeRequiredNoStore = 'upgrade_required_no_store';

  // ── Backend error codes ──────────────────────────────────────────────────
  static const String errorMachineAlreadyInTransit =
      'error_machine_already_in_transit';
  static const String errorNotInYourCustody = 'error_not_in_your_custody';
  static const String errorInvalidMachineStatus =
      'error_invalid_machine_status';
  static const String errorPayloadChanged = 'error_payload_changed';
  static const String errorCategoryKindMismatch =
      'error_category_kind_mismatch';
  static const String errorStateChangedRefresh = 'error_state_changed_refresh';
  static const String errorCategoryCycle = 'error_category_cycle';
  static const String errorCategoryHasChildren = 'error_category_has_children';
  static const String errorCategoryHasTransactions =
      'error_category_has_transactions';
  static const String errorSystemCategoryProtected =
      'error_system_category_protected';
  static const String errorAutomaticTransactionImmutable =
      'error_automatic_transaction_immutable';
  static const String errorFinanceEditWindowExpired =
      'error_finance_edit_window_expired';
  static const String errorOverlappingBudget = 'error_overlapping_budget';
  static const String errorBudgetOnIncomeCategory =
      'error_budget_on_income_category';

  // ── Common actions ───────────────────────────────────────────────────────
  static const String save = 'save';
  static const String cancel = 'cancel';
  static const String confirm = 'confirm';
  static const String delete = 'delete';
  static const String edit = 'edit';
  static const String search = 'search';
  static const String retry = 'retry';
  static const String tryAgain = 'try_again';
  static const String close = 'close';
  static const String next = 'next';
  static const String back = 'back';
  static const String done = 'done';
  static const String yes = 'yes';
  static const String no = 'no';
  static const String all = 'all';
  static const String filter = 'filter';
  static const String clear = 'clear';
  static const String copiedToClipboard = 'copied_to_clipboard';

  static const String error = 'error';
  static const String success = 'success';

  // ── Generic states ───────────────────────────────────────────────────────
  static const String loading = 'loading';
  static const String emptyStateTitle = 'empty_state_title';
  static const String emptyStateSubtitle = 'empty_state_subtitle';
  static const String errorStateTitle = 'error_state_title';
  static const String noPermissionTitle = 'no_permission_title';
  static const String noPermissionSubtitle = 'no_permission_subtitle';

  // ── Offline & sync ───────────────────────────────────────────────────────
  static const String offlineBannerMessage = 'offline_banner_message';
  static const String savedLocallyWillSync = 'saved_locally_will_sync';
  static const String syncPending = 'sync_pending';
  static const String syncSynced = 'sync_synced';
  static const String syncFailed = 'sync_failed';
  static const String syncConflict = 'sync_conflict';
  static const String syncBlocked = 'sync_blocked';
  static const String syncQueue = 'sync_queue';
  static const String syncQueueEmpty = 'sync_queue_empty';
  static const String syncRetryNow = 'sync_retry_now';
  static const String syncDeleteItem = 'sync_delete_item';
  static const String syncDeleteConfirmTitle = 'sync_delete_confirm_title';
  static const String syncDeleteConfirmBody = 'sync_delete_confirm_body';
  static const String syncConflictDialogTitle = 'sync_conflict_dialog_title';
  static const String syncConflictDialogBody = 'sync_conflict_dialog_body';
  static const String syncConflictViewDetails = 'sync_conflict_view_details';
  static const String syncConflictDismiss = 'sync_conflict_dismiss';
  static const String syncAttemptsCount = 'sync_attempts_count';
  static const String syncPendingCount = 'sync_pending_count';
  static const String syncItemTypeCreateTransfer =
      'sync_item_type_create_transfer';
  static const String syncItemTypeConfirmTransfer =
      'sync_item_type_confirm_transfer';
  static const String syncItemTypeRejectTransfer =
      'sync_item_type_reject_transfer';
  static const String syncItemTypeCreateMerchant =
      'sync_item_type_create_merchant';
  static const String syncItemTypeCreateSubscription =
      'sync_item_type_create_subscription';
  static const String syncItemTypeCreateFinanceTransaction =
      'sync_item_type_create_finance_transaction';
  static const String syncItemTypeUploadMedia = 'sync_item_type_upload_media';

  // ── Relative time (ICU plurals) ──────────────────────────────────────────
  static const String relativeNow = 'relative_now';
  static const String relativeMinutes = 'relative_minutes';
  static const String relativeHours = 'relative_hours';
  static const String relativeDays = 'relative_days';

  // ── Language ─────────────────────────────────────────────────────────────
  static const String appLanguage = 'app_language';
  static const String arabicLanguage = 'arabic_language';
  static const String englishLanguage = 'english_language';

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String login = 'login';
  static const String logout = 'logout';
  static const String phoneNumber = 'phone_number';
  static const String password = 'password';
  static const String currentPassword = 'current_password';
  static const String newPassword = 'new_password';
  static const String confirmPassword = 'confirm_password';
  static const String changePassword = 'change_password';
  static const String loginTitle = 'login_title';
  static const String loginSubtitle = 'login_subtitle';
  static const String loginWithBiometric = 'login_with_biometric';
  static const String firstLoginNeedsInternet = 'first_login_needs_internet';
  static const String errorInvalidCredentials = 'error_invalid_credentials';
  static const String errorAccountInactive = 'error_account_inactive';
  static const String errorAccountLocked = 'error_account_locked';
  static const String passwordStrengthWeak = 'password_strength_weak';
  static const String passwordStrengthFair = 'password_strength_fair';
  static const String passwordStrengthGood = 'password_strength_good';
  static const String passwordStrengthStrong = 'password_strength_strong';
  static const String changePasswordRequiredTitle =
      'change_password_required_title';
  static const String changePasswordRequiredSubtitle =
      'change_password_required_subtitle';
  static const String changePasswordSuccessMessage =
      'change_password_success_message';
  static const String biometricEnrollTitle = 'biometric_enroll_title';
  static const String biometricEnrollMessage = 'biometric_enroll_message';
  static const String biometricEnrollConfirm = 'biometric_enroll_confirm';
  static const String biometricEnrollDismiss = 'biometric_enroll_dismiss';
  static const String biometricFailed = 'biometric_failed';
  static const String logoutConfirmTitle = 'logout_confirm_title';
  static const String logoutConfirmMessage = 'logout_confirm_message';
  static const String logoutPendingSyncWarning = 'logout_pending_sync_warning';

  // ── Navigation tabs ──────────────────────────────────────────────────────
  static const String navHome = 'nav_home';
  static const String navMachines = 'nav_machines';
  static const String navTransfers = 'nav_transfers';
  static const String navMerchants = 'nav_merchants';
  static const String navFinance = 'nav_finance';
  static const String navMore = 'nav_more';

  // ── Home dashboard ───────────────────────────────────────────────────────
  static const String homeOverviewSection = 'home_overview_section';
  static const String homeQuickActionsSection = 'home_quick_actions_section';
  static const String homeInYourScope = 'home_in_your_scope';
  static const String homeTransfersSubtitle = 'home_transfers_subtitle';
  static const String homeViolationsSubtitle = 'home_violations_subtitle';
  static const String homeMaintenanceTitle = 'home_maintenance_title';
  static const String homeMaintenanceSubtitle = 'home_maintenance_subtitle';
  static const String homeFinanceSubtitle = 'home_finance_subtitle';
  static const String homeBudgetsSubtitle = 'home_budgets_subtitle';
  static const String homeBlockOffline = 'home_block_offline';
  static const String homeLastUpdated = 'home_last_updated';
  static const String homeNoBlocksAvailable = 'home_no_blocks_available';

  // ── Finance ─────────────────────────────────────────────────────────────
  static const String financeTitle = 'finance_title';
  static const String financeIncome = 'finance_income';
  static const String financeExpense = 'finance_expense';
  static const String financeNet = 'finance_net';
  static const String financeBudgetAlerts = 'finance_budget_alerts';
  static const String financeTransactions = 'finance_transactions';
  static const String financeAddTransaction = 'finance_add_transaction';
  static const String financeBreakdown = 'finance_breakdown';
  static const String financeBudgets = 'finance_budgets';
  static const String financeCategories = 'finance_categories';
  static const String financeDateRange = 'finance_date_range';
  static const String financeBranch = 'finance_branch';
  static const String financePendingTransactions =
      'finance_pending_transactions';
  static const String financePendingSync = 'finance_pending_sync';
  static const String financeVoided = 'finance_voided';
  static const String financeAutoGenerated = 'finance_auto_generated';
  static const String financeSpentOfBudget = 'finance_spent_of_budget';
  static const String financeTimeElapsedProjected =
      'finance_time_elapsed_projected';
  static const String financeAddBudget = 'finance_add_budget';
  static const String financeEditBudget = 'finance_edit_budget';
  static const String financeExpenseCategory = 'finance_expense_category';
  static const String financeChooseCategory = 'finance_choose_category';
  static const String financePeriod = 'finance_period';
  static const String financePeriodMonthly = 'finance_period_monthly';
  static const String financePeriodQuarterly = 'finance_period_quarterly';
  static const String financePeriodYearly = 'finance_period_yearly';
  static const String financePeriodCustom = 'finance_period_custom';
  static const String financeFromDate = 'finance_from_date';
  static const String financeToDate = 'finance_to_date';
  static const String financeBudgetAmount = 'finance_budget_amount';
  static const String financeWarningThreshold = 'finance_warning_threshold';
  static const String financeThresholdRange = 'finance_threshold_range';
  static const String financeIncludeSubcategories =
      'finance_include_subcategories';
  static const String financeAutoRenew = 'finance_auto_renew';
  static const String financeSaving = 'finance_saving';
  static const String financeSaveBudget = 'finance_save_budget';
  static const String financeDeleteBudgetTitle = 'finance_delete_budget_title';
  static const String financeDeleteBudgetBody = 'finance_delete_budget_body';
  static const String financeDirectSpendOnly = 'finance_direct_spend_only';
  static const String financeSearchCategories = 'finance_search_categories';
  static const String financeOpenSubcategories = 'finance_open_subcategories';
  static const String financeAddCategory = 'finance_add_category';
  static const String financeEditCategory = 'finance_edit_category';
  static const String financeCategoryName = 'finance_category_name';
  static const String financeCategoryDescription =
      'finance_category_description';
  static const String financeCategoryParent = 'finance_category_parent';
  static const String financeRootCategory = 'finance_root_category';
  static const String financeSelected = 'finance_selected';
  static const String financeCategoryStats = 'finance_category_stats';
  static const String financeEditMove = 'finance_edit_move';
  static const String financeDeleteCategoryTitle =
      'finance_delete_category_title';
  static const String financeDeleteCategoryBody = 'finance_delete_category_body';
  static const String financeGrandTotal = 'finance_grand_total';
  static const String financeDirectRolledUp = 'finance_direct_rolled_up';
  static const String financeDirectTotal = 'finance_direct_total';
  static const String financeOpenSubtree = 'finance_open_subtree';
  static const String financeNoCategories = 'finance_no_categories';
  static const String financeNoCategoriesSubtitle =
      'finance_no_categories_subtitle';
  static const String financeNoBudgets = 'finance_no_budgets';
  static const String financeNoBudgetsSubtitle = 'finance_no_budgets_subtitle';
  static const String financeNoTransactions = 'finance_no_transactions';
  static const String financeNoTransactionsSubtitle =
      'finance_no_transactions_subtitle';
  static const String financeFilterTransactions = 'finance_filter_transactions';
  static const String financeReferenceOrNotes = 'finance_reference_or_notes';
  static const String financeMinAmount = 'finance_min_amount';
  static const String financeMaxAmount = 'finance_max_amount';
  static const String financeIncludeVoided = 'finance_include_voided';
  static const String financeApplyFilters = 'finance_apply_filters';
  static const String financeEditTransaction = 'finance_edit_transaction';
  static const String financeAmount = 'finance_amount';
  static const String financeCategory = 'finance_category';
  static const String financeChooseMatchingCategory =
      'finance_choose_matching_category';
  static const String financePaymentMethod = 'finance_payment_method';
  static const String financeBranchOptional = 'finance_branch_optional';
  static const String financeCompanyWide = 'finance_company_wide';
  static const String financeSupplierOptional = 'finance_supplier_optional';
  static const String financeNone = 'finance_none';
  static const String financeTransactionDate = 'finance_transaction_date';
  static const String financeNotesOptional = 'finance_notes_optional';
  static const String financeSaveTransaction = 'finance_save_transaction';
  static const String financeTransactionSaved = 'finance_transaction_saved';
  static const String financeVoidTransaction = 'finance_void_transaction';
  static const String financeVoidReason = 'finance_void_reason';
  static const String financeVoid = 'finance_void';
  static const String financeAutoGeneratedBanner =
      'finance_auto_generated_banner';
  static const String financeVoidedReason = 'finance_voided_reason';
  static const String financeKind = 'finance_kind';
  static const String financeScope = 'finance_scope';
  static const String financeCompany = 'finance_company';
  static const String financeSupplier = 'finance_supplier';
  static const String financeSource = 'finance_source';
  static const String financeNotes = 'finance_notes';
  static const String financeDate = 'finance_date';

  // ── More tab ─────────────────────────────────────────────────────────────
  static const String moreAccountSection = 'more_account_section';
  static const String moreManagementSection = 'more_management_section';
  static const String moreAppSection = 'more_app_section';
  static const String reports = 'reports';
  static const String reportsTitle = 'reports_title';
  static const String reportsOffline = 'reports_offline';
  static const String reportsDownloaded = 'reports_downloaded';
  static const String reportsMachinesSection = 'reports_machines_section';
  static const String reportsTransfersSection = 'reports_transfers_section';
  static const String reportsPeopleSection = 'reports_people_section';
  static const String reportsMerchantsSection = 'reports_merchants_section';
  static const String reportsMaintenanceSection = 'reports_maintenance_section';
  static const String reportsFinanceSection = 'reports_finance_section';
  static const String reportFilters = 'report_filters';
  static const String reportExport = 'report_export';
  static const String reportGeneratedAt = 'report_generated_at';
  static const String reportRows = 'report_rows';
  static const String reportTableView = 'report_table_view';
  static const String reportCardView = 'report_card_view';
  static const String reportGroupedView = 'report_grouped_view';
  static const String reportChartView = 'report_chart_view';
  static const String reportExportReady = 'report_export_ready';
  static const String reportExportFailed = 'report_export_failed';
  static const String reportNoDownloads = 'report_no_downloads';
  static const String reportDateRange = 'report_date_range';
  static const String reportBackendDefaultPeriod =
      'report_backend_default_period';
  static const String reportBranch = 'report_branch';
  static const String reportAllBranches = 'report_all_branches';
  static const String reportGroupBy = 'report_group_by';
  static const String reportDaysWithoutMovement =
      'report_days_without_movement';
  static const String reportExpiresWithinDays = 'report_expires_within_days';
  static const String reportGranularity = 'report_granularity';
  static const String reportMachineId = 'report_machine_id';
  static const String reportMachineIdRequired = 'report_machine_id_required';
  static const String reportClearFilters = 'report_clear_filters';
  static const String reportRun = 'report_run';
  static const String reportExportFormat = 'report_export_format';
  static const String reportExportStarted = 'report_export_started';
  static const String reportVisibleColumns = 'report_visible_columns';
  static const String reportChooseColumns = 'report_choose_columns';
  static const String reportApply = 'report_apply';
  static const String reportLoadMore = 'report_load_more';
  static const String reportTruncated = 'report_truncated';
  static const String reportRowsInGroup = 'report_rows_in_group';
  static const String reportNoChartData = 'report_no_chart_data';
  static const String reportNoRows = 'report_no_rows';
  static const String reportGroupRepresentative = 'report_group_representative';
  static const String reportGroupSupervisor = 'report_group_supervisor';
  static const String reportGroupBranch = 'report_group_branch';
  static const String reportGroupMerchant = 'report_group_merchant';
  static const String reportGroupStatus = 'report_group_status';
  static const String reportGroupModel = 'report_group_model';
  static const String reportPeriodDay = 'report_period_day';
  static const String reportPeriodWeek = 'report_period_week';
  static const String reportPeriodMonth = 'report_period_month';
  static const String reportPeriodYear = 'report_period_year';
  static const String reportExportQueued = 'report_export_queued';
  static const String reportExportRunning = 'report_export_running';
  static const String usersAndRoles = 'users_and_roles';
  static const String notifications = 'notifications';
  static const String featureNotReadyTitle = 'feature_not_ready_title';
  static const String featureNotReadySubtitle = 'feature_not_ready_subtitle';

  // ── Machine identity (the four serials of one unit) ──────────────────────
  static const String machineSerial = 'machine_serial';
  static const String batterySerial = 'battery_serial';
  static const String simSerial = 'sim_serial';
  static const String boxSerial = 'box_serial';
  static const String simSerialHint = 'sim_serial_hint';
  static const String boxSerialHint = 'box_serial_hint';
  static const String boxSerialNotPrinted = 'box_serial_not_printed';
  static const String serialImmutableNote = 'serial_immutable_note';
  static const String simImmutableNote = 'sim_immutable_note';
  static const String simRequiredForType = 'sim_required_for_type';
  static const String simNotApplicableForType = 'sim_not_applicable_for_type';
  static const String errorSimSerialExists = 'error_sim_serial_exists';
  static const String errorBoxSerialExists = 'error_box_serial_exists';

  // ── QR lookup: which serial matched ──────────────────────────────────────
  static const String matchedOnMachine = 'matched_on_machine';
  static const String matchedOnBattery = 'matched_on_battery';
  static const String matchedOnSim = 'matched_on_sim';
  static const String matchedOnBox = 'matched_on_box';

  // ── Machine statuses ─────────────────────────────────────────────────────
  static const String machineStatusInCompanyWarehouse =
      'machine_status_in_company_warehouse';
  static const String machineStatusInBranchWarehouse =
      'machine_status_in_branch_warehouse';
  static const String machineStatusWithSupervisor =
      'machine_status_with_supervisor';
  static const String machineStatusWithRepresentative =
      'machine_status_with_representative';
  static const String machineStatusWithMerchant =
      'machine_status_with_merchant';
  static const String machineStatusInTransit = 'machine_status_in_transit';
  static const String machineStatusUnderMaintenance =
      'machine_status_under_maintenance';
  static const String machineStatusAtFactory = 'machine_status_at_factory';
  static const String machineStatusAtServiceCenter =
      'machine_status_at_service_center';
  static const String machineStatusDecommissioned =
      'machine_status_decommissioned';
  static const String machineStatusReplaced = 'machine_status_replaced';
  static const String machineStatusUnknown = 'machine_status_unknown';

  // ── Transfer statuses ────────────────────────────────────────────────────
  static const String transferStatusPending = 'transfer_status_pending';
  static const String transferStatusConfirmed = 'transfer_status_confirmed';
  static const String transferStatusRejected = 'transfer_status_rejected';
  static const String transferStatusCancelled = 'transfer_status_cancelled';
  static const String transferStatusUnknown = 'transfer_status_unknown';

  // ── Users, roles & permissions ───────────────────────────────────────────
  static const String usersTitle = 'users_title';
  static const String usersSearchHint = 'users_search_hint';
  static const String usersEmptyTitle = 'users_empty_title';
  static const String usersEmptySubtitle = 'users_empty_subtitle';
  static const String usersNoSearchResults = 'users_no_search_results';
  static const String usersCount = 'users_count';
  static const String usersOnlineOnlyTitle = 'users_online_only_title';
  static const String usersOnlineOnlySubtitle = 'users_online_only_subtitle';

  static const String userAdd = 'user_add';
  static const String userEdit = 'user_edit';
  static const String userCreated = 'user_created';
  static const String userUpdated = 'user_updated';

  static const String userFullName = 'user_full_name';
  static const String userPhone = 'user_phone';
  static const String userEmail = 'user_email';
  static const String userEmailOptional = 'user_email_optional';
  static const String userRole = 'user_role';
  static const String userBranch = 'user_branch';
  static const String userInitialPassword = 'user_initial_password';
  static const String userInitialPasswordHint = 'user_initial_password_hint';
  static const String userPickRole = 'user_pick_role';
  static const String userPickBranch = 'user_pick_branch';
  static const String userNoBranch = 'user_no_branch';

  static const String userActive = 'user_active';
  static const String userInactive = 'user_inactive';
  static const String userNeverSignedIn = 'user_never_signed_in';
  static const String userMustChangePassword = 'user_must_change_password';

  static const String userFilters = 'user_filters';
  static const String userFilterStatus = 'user_filter_status';
  static const String userFilterAll = 'user_filter_all';
  static const String userClearFilters = 'user_clear_filters';

  static const String userDeactivate = 'user_deactivate';
  static const String userActivate = 'user_activate';
  static const String userDeactivateTitle = 'user_deactivate_title';
  static const String userDeactivateMessage = 'user_deactivate_message';
  static const String userDeactivated = 'user_deactivated';
  static const String userActivated = 'user_activated';
  static const String userHasCustody = 'user_has_custody';

  static const String userResetPassword = 'user_reset_password';
  static const String userResetPasswordTitle = 'user_reset_password_title';
  static const String userResetPasswordMessage = 'user_reset_password_message';
  static const String userResetPasswordDone = 'user_reset_password_done';

  static const String userPermissionsTitle = 'user_permissions_title';
  static const String userPermissionsSearchHint =
      'user_permissions_search_hint';
  static const String userPermissionsFromRole = 'user_permissions_from_role';
  static const String userPermissionsAllowed = 'user_permissions_allowed';
  static const String userPermissionsDenied = 'user_permissions_denied';
  static const String userPermissionsOverrideCount =
      'user_permissions_override_count';
  static const String userPermissionsConfirmTitle =
      'user_permissions_confirm_title';
  static const String userPermissionsSaved = 'user_permissions_saved';
  static const String userPermissionsNoChanges = 'user_permissions_no_changes';
  static const String userPermissionsDiscard = 'user_permissions_discard';
  static const String userPermissionsDiscardMessage =
      'user_permissions_discard_message';
  static const String userPermissionsSelfEditBlocked =
      'user_permissions_self_edit_blocked';
  static const String userPermissionsEmptySearch =
      'user_permissions_empty_search';

  static const String userDetailTitle = 'user_detail_title';
  static const String userLastLogin = 'user_last_login';
  static const String userCustodyTitle = 'user_custody_title';
  static const String userCustodyTotal = 'user_custody_total';
  static const String userCustodyInHand = 'user_custody_in_hand';
  static const String userCustodyAtMerchants = 'user_custody_at_merchants';
  static const String userViolationsTitle = 'user_violations_title';
  static const String userViolationsOpen = 'user_violations_open';
  static const String userViolationsAll = 'user_violations_all';
  static const String userViolationsCharged = 'user_violations_charged';
  static const String userViolationsTrend = 'user_violations_trend';
  static const String userActivityTitle = 'user_activity_title';
  static const String userActivityEmpty = 'user_activity_empty';

  static const String rolesTitle = 'roles_title';
  static const String rolesEmptyTitle = 'roles_empty_title';
  static const String rolesEmptySubtitle = 'roles_empty_subtitle';
  static const String roleCreate = 'role_create';
  static const String roleEdit = 'role_edit';
  static const String roleCode = 'role_code';
  static const String roleCodeHint = 'role_code_hint';
  static const String roleNameArabic = 'role_name_arabic';
  static const String roleNameEnglish = 'role_name_english';
  static const String roleDescriptionArabic = 'role_description_arabic';
  static const String roleDescriptionEnglish = 'role_description_english';
  static const String rolePermissionCount = 'role_permission_count';
  static const String rolePermissionsConfirmTitle =
      'role_permissions_confirm_title';
  static const String rolePermissionsAffected = 'role_permissions_affected';
  static const String rolePermissionsSaved = 'role_permissions_saved';
  static const String roleSystemProtected = 'role_system_protected';

  // ── Machines ─────────────────────────────────────────────────────────────
  static const String machinesTitle = 'machines_title';
  static const String machinesSearchHint = 'machines_search_hint';
  static const String machinesEmptyTitle = 'machines_empty_title';
  static const String machinesEmptySubtitle = 'machines_empty_subtitle';
  static const String machinesNoSearchResults = 'machines_no_search_results';
  static const String machinesCount = 'machines_count';
  static const String machinesOnlineOnlySubtitle =
      'machines_online_only_subtitle';

  static const String machineModel = 'machine_model';
  static const String machineType = 'machine_type';
  static const String machineManufacturer = 'machine_manufacturer';
  static const String machineBranch = 'machine_branch';
  static const String machineHolder = 'machine_holder';
  static const String machineNotes = 'machine_notes';
  static const String machineHasBox = 'machine_has_box';
  static const String machineHasBoxHint = 'machine_has_box_hint';

  static const String machineIdentityTitle = 'machine_identity_title';
  static const String machineBatteryBond = 'machine_battery_bond';
  static const String machineSerialCopied = 'machine_serial_copied';

  static const String machineWarrantyTitle = 'machine_warranty_title';
  static const String machineWarrantyActive = 'machine_warranty_active';
  static const String machineWarrantyExpired = 'machine_warranty_expired';
  static const String machineWarrantyUnknown = 'machine_warranty_unknown';
  static const String machineWarrantyDaysLeft = 'machine_warranty_days_left';
  static const String machineWarrantyStart = 'machine_warranty_start';
  static const String machineWarrantyEnd = 'machine_warranty_end';

  static const String machinePurchaseTitle = 'machine_purchase_title';
  static const String machinePurchasePrice = 'machine_purchase_price';
  static const String machinePurchaseDate = 'machine_purchase_date';
  static const String machineInvoiceNo = 'machine_invoice_no';

  static const String machineCostTitle = 'machine_cost_title';
  static const String machineRepairCount = 'machine_repair_count';
  static const String machineRepairsBadge = 'machine_repairs_badge';
  static const String machineTotalRepairCost = 'machine_total_repair_cost';
  static const String machineCostRatio = 'machine_cost_ratio';
  static const String machineConsiderScrapping = 'machine_consider_scrapping';

  static const String machineChainTitle = 'machine_chain_title';
  static const String machineChainCurrent = 'machine_chain_current';

  static const String machineAddTitle = 'machine_add_title';
  static const String machineEditTitle = 'machine_edit_title';
  static const String machineSerialsLocked = 'machine_serials_locked';
  static const String machineSaved = 'machine_saved';
  static const String machineCreated = 'machine_created';
  static const String machineSelectModel = 'machine_select_model';
  static const String machineModelRequired = 'machine_model_required';

  static const String machinesFilterTitle = 'machines_filter_title';
  static const String machinesFilterStatus = 'machines_filter_status';
  static const String machinesFilterType = 'machines_filter_type';
  static const String machinesFilterBranch = 'machines_filter_branch';
  static const String machinesFilterHolder = 'machines_filter_holder';
  static const String machinesFilterWarranty = 'machines_filter_warranty';
  static const String machinesFilterWarrantyExpiring =
      'machines_filter_warranty_expiring';
  static const String machinesFilterIncludeRetired =
      'machines_filter_include_retired';
  static const String machinesFilterIncludeRetiredHint =
      'machines_filter_include_retired_hint';

  // ── Machine detail actions (`8.1`) ───────────────────────────────────────
  static const String machineActionsTitle = 'machine_actions_title';
  static const String machineReplaceAction = 'machine_replace_action';
  static const String machineDecommissionAction = 'machine_decommission_action';

  // ── Machine timeline (`8.1`) ─────────────────────────────────────────────
  static const String machineTimelineTitle = 'machine_timeline_title';
  static const String machineTimelineEmpty = 'machine_timeline_empty';
  static const String timelineTransferPending = 'timeline_transfer_pending';
  static const String timelineTransferConfirmed = 'timeline_transfer_confirmed';
  static const String timelineTransferRejected = 'timeline_transfer_rejected';
  static const String timelineTransferCancelled = 'timeline_transfer_cancelled';
  static const String timelineMaintenanceOpened = 'timeline_maintenance_opened';
  static const String timelineMaintenanceClosed = 'timeline_maintenance_closed';
  static const String timelineViolationCreated = 'timeline_violation_created';
  static const String timelineMachineReplaced = 'timeline_machine_replaced';
  static const String timelineDecommissioned = 'timeline_decommissioned';
  static const String timelineDecommissionReverted =
      'timeline_decommission_reverted';
  static const String timelineUnknown = 'timeline_unknown';

  // ── Maintenance history (read-only; `11` owns the write side) ───────────
  static const String machineMaintenanceHistoryTitle =
      'machine_maintenance_history_title';
  static const String machineMaintenanceHistoryEmpty =
      'machine_maintenance_history_empty';
  static const String machineMaintenanceHistoryTotals =
      'machine_maintenance_history_totals';
  static const String machineMaintenanceHistoryOrdersCount =
      'machine_maintenance_history_orders_count';
  static const String machineMaintenanceHistoryTotalCost =
      'machine_maintenance_history_total_cost';
  static const String machineMaintenanceHistoryFreeUnderWarranty =
      'machine_maintenance_history_free_under_warranty';

  // ── Bulk import (`8.1`) ──────────────────────────────────────────────────
  static const String machineBulkImportTitle = 'machine_bulk_import_title';
  static const String machineBulkImportUnits = 'machine_bulk_import_units';
  static const String machineBulkImportAddRow = 'machine_bulk_import_add_row';
  static const String machineBulkImportRemoveRow =
      'machine_bulk_import_remove_row';
  static const String machineBulkImportSubmit = 'machine_bulk_import_submit';
  static const String machineBulkImportSuccess = 'machine_bulk_import_success';

  // ── Holder / party types ─────────────────────────────────────────────────
  static const String partyTypeFactory = 'party_type_factory';
  static const String partyTypeWarehouse = 'party_type_warehouse';
  static const String partyTypeSupervisor = 'party_type_supervisor';
  static const String partyTypeRepresentative = 'party_type_representative';
  static const String partyTypeMerchant = 'party_type_merchant';
  static const String partyTypeServiceCenter = 'party_type_service_center';
  static const String partyTypeUnknown = 'party_type_unknown';

  // ── Scanning ─────────────────────────────────────────────────────────────
  static const String scanTitle = 'scan_title';
  static const String scanHint = 'scan_hint';
  static const String scanManualEntry = 'scan_manual_entry';
  static const String scanManualEntryTitle = 'scan_manual_entry_title';
  static const String scanManualEntryHint = 'scan_manual_entry_hint';
  static const String scanTorch = 'scan_torch';
  static const String scanResolving = 'scan_resolving';
  static const String scanNotFound = 'scan_not_found';
  static const String scanNotFoundHint = 'scan_not_found_hint';
  static const String scanRetry = 'scan_retry';
  static const String scanCameraDenied = 'scan_camera_denied';
  static const String scanCameraDeniedHint = 'scan_camera_denied_hint';

  // ── Continuous scanning (`8.2`) ──────────────────────────────────────────
  static const String scanContinuousTitle = 'scan_continuous_title';
  static const String scanAdded = 'scan_added';
  static const String scanBatteryScanTooltip = 'scan_battery_scan_tooltip';
  static const String machineQrTitle = 'machine_qr_title';
  static const String machineQrHint = 'machine_qr_hint';

  // ── Transfers ────────────────────────────────────────────────────────────
  static const String transfersTitle = 'transfers_title';
  static const String transfersTabIncoming = 'transfers_tab_incoming';
  static const String transfersTabOutgoing = 'transfers_tab_outgoing';
  static const String transfersTabAll = 'transfers_tab_all';
  static const String transfersEmptyIncomingTitle =
      'transfers_empty_incoming_title';
  static const String transfersEmptyIncomingSubtitle =
      'transfers_empty_incoming_subtitle';
  static const String transfersEmptyOutgoingTitle =
      'transfers_empty_outgoing_title';
  static const String transfersEmptyOutgoingSubtitle =
      'transfers_empty_outgoing_subtitle';
  static const String transfersEmptyAllTitle = 'transfers_empty_all_title';
  static const String transfersEmptyAllSubtitle =
      'transfers_empty_all_subtitle';
  static const String transfersOnlineOnlySubtitle =
      'transfers_online_only_subtitle';
  static const String transferItemsCount = 'transfer_items_count';
  static const String transferAwaitingYou = 'transfer_awaiting_you';
  static const String transferFrom = 'transfer_from';
  static const String transferTo = 'transfer_to';
  static const String transferOccurredAt = 'transfer_occurred_at';
  static const String transferConfirmedAt = 'transfer_confirmed_at';
  static const String transferNotes = 'transfer_notes';
  static const String transferMachinesTitle = 'transfer_machines_title';
  static const String transferSignaturesTitle = 'transfer_signatures_title';
  static const String transferSignedBy = 'transfer_signed_by';
  static const String transferViolationsBadge = 'transfer_violations_badge';
  static const String transferItemCharger = 'transfer_item_charger';
  static const String transferItemBox = 'transfer_item_box';
  static const String transferItemCondition = 'transfer_item_condition';
  static const String transferItemBatteryMismatch =
      'transfer_item_battery_mismatch';
  static const String transferItemBatteryExpected =
      'transfer_item_battery_expected';
  static const String transferItemBatteryScanned =
      'transfer_item_battery_scanned';
  static const String transferItemAdjusted = 'transfer_item_adjusted';

  // Actions
  static const String transferActionConfirm = 'transfer_action_confirm';
  static const String transferActionReject = 'transfer_action_reject';
  static const String transferActionCancel = 'transfer_action_cancel';
  static const String transferConfirmed = 'transfer_confirmed';
  static const String transferRejected = 'transfer_rejected';
  static const String transferCancelled = 'transfer_cancelled';
  static const String transferRejectTitle = 'transfer_reject_title';
  static const String transferRejectHint = 'transfer_reject_hint';
  static const String transferRejectWarning = 'transfer_reject_warning';
  static const String transferCancelTitle = 'transfer_cancel_title';
  static const String transferCancelHint = 'transfer_cancel_hint';
  static const String transferPayloadChangedTitle =
      'transfer_payload_changed_title';
  static const String transferPayloadChangedBody =
      'transfer_payload_changed_body';
  static const String transferReloadAndReview = 'transfer_reload_and_review';

  // Confirm screen
  static const String transferConfirmTitle = 'transfer_confirm_title';
  static const String transferConfirmIntro = 'transfer_confirm_intro';
  static const String transferConfirmSummaryTitle =
      'transfer_confirm_summary_title';
  static const String transferSignatureTitle = 'transfer_signature_title';
  static const String transferSignatureHint = 'transfer_signature_hint';
  static const String transferSignatureClear = 'transfer_signature_clear';
  static const String transferSignatureUndo = 'transfer_signature_undo';
  static const String transferSignatureRequired = 'transfer_signature_required';
  static const String transferSubmitSignature = 'transfer_submit_signature';
  static const String transferItemReset = 'transfer_item_reset';
  static const String signatureMethodBiometric = 'signature_method_biometric';
  static const String signatureMethodDrawn = 'signature_method_drawn';
  static const String signatureBiometricConfirm = 'signature_biometric_confirm';
  static const String signatureBiometricVerified =
      'signature_biometric_verified';
  static const String signatureBiometricFailed = 'signature_biometric_failed';
  static const String signatureBiometricRequired =
      'signature_biometric_required';
  static const String signatureBiometricReasonReceive =
      'signature_biometric_reason_receive';
  static const String signatureBiometricReasonSend =
      'signature_biometric_reason_send';

  // Create wizard
  static const String transferCreateTitle = 'transfer_create_title';
  static const String transferStepType = 'transfer_step_type';
  static const String transferStepMachines = 'transfer_step_machines';
  static const String transferStepDetails = 'transfer_step_details';
  static const String transferStepReview = 'transfer_step_review';
  static const String transferSelectType = 'transfer_select_type';
  static const String transferSelectRecipient = 'transfer_select_recipient';
  static const String transferSelectWarehouse = 'transfer_select_warehouse';
  static const String transferMerchantIdHint = 'transfer_merchant_id_hint';
  static const String transferNewMerchant = 'transfer_new_merchant';
  static const String transferMerchantSelected = 'transfer_merchant_selected';
  static const String transferMerchantChange = 'transfer_merchant_change';
  static const String transferNoRecipients = 'transfer_no_recipients';
  static const String transferNoRecipientNeeded =
      'transfer_no_recipient_needed';
  static const String transferAddMachines = 'transfer_add_machines';
  static const String transferScanToAdd = 'transfer_scan_to_add';
  static const String transferPickFromList = 'transfer_pick_from_list';
  static const String transferPickerTitle = 'transfer_picker_title';
  static const String transferPickerSearchHint = 'transfer_picker_search_hint';
  static const String transferPickerEmpty = 'transfer_picker_empty';
  static const String transferPickerAddSelected =
      'transfer_picker_add_selected';
  static const String transferPickerAdded = 'transfer_picker_added';
  static const String transferNoMachinesYet = 'transfer_no_machines_yet';
  static const String transferMachineNotEligible =
      'transfer_machine_not_eligible';
  static const String transferMachineAlreadyAdded =
      'transfer_machine_already_added';
  static const String transferScanBattery = 'transfer_scan_battery';
  static const String transferBatteryMatch = 'transfer_battery_match';
  static const String transferItemNotes = 'transfer_item_notes';
  static const String transferItemPhotos = 'transfer_item_photos';
  static const String transferAddPhoto = 'transfer_add_photo';
  static const String transferPhotoSourceCamera =
      'transfer_photo_source_camera';
  static const String transferPhotoSourceGallery =
      'transfer_photo_source_gallery';
  static const String transferPhotoUploadFailed =
      'transfer_photo_upload_failed';
  static const String transferApplyToAll = 'transfer_apply_to_all';
  static const String transferApplyToAllApply = 'transfer_apply_to_all_apply';
  static const String transferApplyToAllApplied =
      'transfer_apply_to_all_applied';
  static const String transferReviewTitle = 'transfer_review_title';
  static const String transferSigner = 'transfer_signer';
  static const String transferPayloadFingerprint =
      'transfer_payload_fingerprint';
  static const String transferSignatureDevice = 'transfer_signature_device';
  static const String transferSignatureImageFailed =
      'transfer_signature_image_failed';
  static const String transferSignatureViewerTitle =
      'transfer_signature_viewer_title';
  static const String transferReviewMismatches = 'transfer_review_mismatches';
  static const String transferReviewMissingChargers =
      'transfer_review_missing_chargers';
  static const String transferValidationFailed = 'transfer_validation_failed';
  static const String transferSubmit = 'transfer_submit';
  static const String transferCreated = 'transfer_created';
  static const String transferSelfAttestedNote = 'transfer_self_attested_note';

  // Transfer types
  static const String transferTypeFactoryToCompany =
      'transfer_type_factory_to_company';
  static const String transferTypeCompanyToBranch =
      'transfer_type_company_to_branch';
  static const String transferTypeBranchToRepresentative =
      'transfer_type_branch_to_representative';
  static const String transferTypeRepresentativeToMerchant =
      'transfer_type_representative_to_merchant';
  static const String transferTypeMerchantToRepresentative =
      'transfer_type_merchant_to_representative';
  static const String transferTypeRepresentativeToBranch =
      'transfer_type_representative_to_branch';
  static const String transferTypeBranchToCompany =
      'transfer_type_branch_to_company';
  static const String transferTypeCompanyToMaintenance =
      'transfer_type_company_to_maintenance';
  static const String transferTypeMaintenanceToCompany =
      'transfer_type_maintenance_to_company';
  static const String transferTypeCompanyToFactory =
      'transfer_type_company_to_factory';
  static const String transferTypeFactoryToCompanyReturn =
      'transfer_type_factory_to_company_return';
  static const String transferTypeCompanyToServiceCenter =
      'transfer_type_company_to_service_center';
  static const String transferTypeServiceCenterToCompany =
      'transfer_type_service_center_to_company';
  static const String transferTypeCompanyToScrap =
      'transfer_type_company_to_scrap';
  static const String transferTypeUnknown = 'transfer_type_unknown';

  // Item conditions
  static const String itemConditionGood = 'item_condition_good';
  static const String itemConditionDamaged = 'item_condition_damaged';
  static const String itemConditionNotWorking = 'item_condition_not_working';
  static const String itemConditionUnknown = 'item_condition_unknown';

  // Signature roles
  static const String signatureRoleSender = 'signature_role_sender';
  static const String signatureRoleReceiver = 'signature_role_receiver';

  // ── Violation severities ─────────────────────────────────────────────────
  static const String violationSeverityLow = 'violation_severity_low';
  static const String violationSeverityMedium = 'violation_severity_medium';
  static const String violationSeverityHigh = 'violation_severity_high';
  static const String violationSeverityUnknown = 'violation_severity_unknown';

  // ── Merchants ────────────────────────────────────────────────────────────
  static const String merchantsTitle = 'merchants_title';
  static const String merchantsSearchHint = 'merchants_search_hint';
  static const String merchantsEmptyTitle = 'merchants_empty_title';
  static const String merchantsEmptySubtitle = 'merchants_empty_subtitle';
  static const String merchantsNoSearchResults = 'merchants_no_search_results';
  static const String merchantsFilterTitle = 'merchants_filter_title';
  static const String merchantsFilterBranch = 'merchants_filter_branch';
  static const String merchantsFilterHolding = 'merchants_filter_holding';
  static const String merchantsFilterHoldingWith =
      'merchants_filter_holding_with';
  static const String merchantsFilterHoldingWithout =
      'merchants_filter_holding_without';
  static const String merchantsFilterIncludeInactive =
      'merchants_filter_include_inactive';
  static const String merchantsFilterIncludeInactiveHint =
      'merchants_filter_include_inactive_hint';

  static const String merchantRegisterTitle = 'merchant_register_title';
  static const String merchantEditTitle = 'merchant_edit_title';
  static const String merchantName = 'merchant_name';
  static const String merchantShopName = 'merchant_shop_name';
  static const String merchantPhone = 'merchant_phone';
  static const String merchantAddress = 'merchant_address';
  static const String merchantNationalId = 'merchant_national_id';
  static const String merchantNationalIdHint = 'merchant_national_id_hint';
  static const String merchantNotes = 'merchant_notes';
  static const String merchantCreated = 'merchant_created';
  static const String merchantUpdated = 'merchant_updated';
  static const String merchantDuplicatePhone = 'merchant_duplicate_phone';
  static const String merchantDuplicateNationalId =
      'merchant_duplicate_national_id';
  static const String merchantDuplicateExisting = 'merchant_duplicate_existing';

  static const String merchantDetailsTitle = 'merchant_details_title';
  static const String merchantInactive = 'merchant_inactive';
  static const String merchantRegisteredBy = 'merchant_registered_by';
  static const String merchantRegisteredOn = 'merchant_registered_on';
  static const String merchantMachinesCard = 'merchant_machines_card';
  static const String merchantMachinesEmpty = 'merchant_machines_empty';
  static const String merchantSubscriptionsCard = 'merchant_subscriptions_card';
  static const String merchantSubscriptionsEmpty =
      'merchant_subscriptions_empty';
  static const String merchantTimelineCard = 'merchant_timeline_card';
  static const String merchantTimelineEmpty = 'merchant_timeline_empty';
  static const String merchantTotalPaid = 'merchant_total_paid';
  static const String merchantDeactivate = 'merchant_deactivate';
  static const String merchantDeactivateConfirm = 'merchant_deactivate_confirm';
  static const String merchantDeactivateBlocked = 'merchant_deactivate_blocked';
  static const String merchantDeactivated = 'merchant_deactivated';

  static const String subscriptionAdd = 'subscription_add';
  static const String subscriptionPlan = 'subscription_plan';
  static const String subscriptionAmount = 'subscription_amount';
  static const String subscriptionStartDate = 'subscription_start_date';
  static const String subscriptionEndDate = 'subscription_end_date';
  static const String subscriptionMachine = 'subscription_machine';
  static const String subscriptionMachineAll = 'subscription_machine_all';
  static const String subscriptionNextDue = 'subscription_next_due';
  static const String subscriptionOverdue = 'subscription_overdue';
  static const String subscriptionCollected = 'subscription_collected';
  static const String subscriptionCollectionsCount =
      'subscription_collections_count';
  static const String subscriptionCreated = 'subscription_created';
  static const String subscriptionEnded = 'subscription_ended';
  static const String subscriptionCollect = 'subscription_collect';
  static const String subscriptionCollectTitle = 'subscription_collect_title';
  static const String subscriptionCollectAmount = 'subscription_collect_amount';
  static const String subscriptionCollectMethod = 'subscription_collect_method';
  static const String subscriptionCollectDone = 'subscription_collect_done';

  // Plan types
  static const String planTypeNone = 'plan_type_none';
  static const String planTypeOneTimeFee = 'plan_type_one_time_fee';
  static const String planTypeWeekly = 'plan_type_weekly';
  static const String planTypeMonthly = 'plan_type_monthly';
  static const String planTypeUnknown = 'plan_type_unknown';

  // Timeline entry codes
  static const String merchantTimelineReceived = 'merchant_timeline_received';
  static const String merchantTimelineReturned = 'merchant_timeline_returned';
  static const String merchantTimelineSubscribed =
      'merchant_timeline_subscribed';
  static const String merchantTimelineCollection =
      'merchant_timeline_collection';

  // ── Violations ───────────────────────────────────────────────────────────
  static const String violationsTitle = 'violations_title';
  static const String violationsMineTitle = 'violations_mine_title';
  static const String violationsEmptyTitle = 'violations_empty_title';
  static const String violationsEmptySubtitle = 'violations_empty_subtitle';
  static const String violationsNoSearchResults =
      'violations_no_search_results';
  static const String violationsFilterTitle = 'violations_filter_title';
  static const String violationsFilterStatus = 'violations_filter_status';
  static const String violationsFilterSeverity = 'violations_filter_severity';
  static const String violationsFilterMineOnly = 'violations_filter_mine_only';
  static const String violationsFilterAutoOnly = 'violations_filter_auto_only';

  static const String violationDetailsTitle = 'violation_details_title';
  static const String violationAutoBadge = 'violation_auto_badge';
  static const String violationAgainst = 'violation_against';
  static const String violationMachine = 'violation_machine';
  static const String violationTransfer = 'violation_transfer';
  static const String violationViewTransfer = 'violation_view_transfer';
  static const String violationRaisedOn = 'violation_raised_on';
  static const String violationChargedAmount = 'violation_charged_amount';
  static const String violationChargedOn = 'violation_charged_on';
  static const String violationWaiverReason = 'violation_waiver_reason';
  static const String violationAcknowledgedOn = 'violation_acknowledged_on';

  static const String violationAcknowledge = 'violation_acknowledge';
  static const String violationAcknowledgeHint = 'violation_acknowledge_hint';
  static const String violationAcknowledged = 'violation_acknowledged_toast';
  static const String violationCharge = 'violation_charge';
  static const String violationChargeTitle = 'violation_charge_title';
  static const String violationChargeDone = 'violation_charge_done';
  static const String violationWaive = 'violation_waive';
  static const String violationWaiveTitle = 'violation_waive_title';
  static const String violationWaiveDone = 'violation_waive_done';
  static const String violationAutoLocked = 'violation_auto_locked';
  static const String violationRaise = 'violation_raise';
  static const String violationRaiseTitle = 'violation_raise_title';
  static const String violationType = 'violation_type';
  static const String violationRaised = 'violation_raised';
  static const String violationDescription = 'violation_description';
  static const String violationSelectUser = 'violation_select_user';
  static const String violationSelectMachine = 'violation_select_machine';
  static const String violationEdit = 'violation_edit';
  static const String violationEditTitle = 'violation_edit_title';
  static const String violationEditDone = 'violation_edit_done';

  static const String violationSummaryTitle = 'violation_summary_title';
  static const String violationSummaryOpen = 'violation_summary_open';
  static const String violationSummaryCharged = 'violation_summary_charged';
  static const String violationSummaryWaived = 'violation_summary_waived';
  static const String violationSummaryTotal = 'violation_summary_total';
  static const String violationSummaryByType = 'violation_summary_by_type';
  static const String violationSummaryTrend = 'violation_summary_trend';

  // Violation statuses
  static const String violationStatusOpen = 'violation_status_open';
  static const String violationStatusAcknowledged =
      'violation_status_acknowledged';
  static const String violationStatusWaived = 'violation_status_waived';
  static const String violationStatusCharged = 'violation_status_charged';
  static const String violationStatusClosed = 'violation_status_closed';
  static const String violationStatusUnknown = 'violation_status_unknown';

  // Trends
  static const String violationTrendImproving = 'violation_trend_improving';
  static const String violationTrendSteady = 'violation_trend_steady';
  static const String violationTrendWorsening = 'violation_trend_worsening';
  static const String violationTrendUnknown = 'violation_trend_unknown';

  // ── Maintenance (`11.1`/`11.2`) ──────────────────────────────────────────
  static const String maintenanceStatusOpen = 'maintenance_status_open';
  static const String maintenanceStatusInProgress =
      'maintenance_status_in_progress';
  static const String maintenanceStatusReturned = 'maintenance_status_returned';
  static const String maintenanceStatusClosed = 'maintenance_status_closed';
  static const String maintenanceStatusCancelled =
      'maintenance_status_cancelled';
  static const String maintenanceStatusUnknown = 'maintenance_status_unknown';

  static const String maintenanceResultRepaired = 'maintenance_result_repaired';
  static const String maintenanceResultReplaced = 'maintenance_result_replaced';
  static const String maintenanceResultUnrepairable =
      'maintenance_result_unrepairable';
  static const String maintenanceResultUnknown = 'maintenance_result_unknown';

  static const String maintenanceResponsibleCompany =
      'maintenance_responsible_company';
  static const String maintenanceResponsibleRepresentative =
      'maintenance_responsible_representative';
  static const String maintenanceResponsibleMerchant =
      'maintenance_responsible_merchant';
  static const String maintenanceResponsibleFactory =
      'maintenance_responsible_factory';
  static const String maintenanceResponsibleUnknown =
      'maintenance_responsible_unknown';

  static const String maintenanceListTitle = 'maintenance_list_title';
  static const String maintenanceEmptyTitle = 'maintenance_empty_title';
  static const String maintenanceEmptySubtitle = 'maintenance_empty_subtitle';
  static const String maintenanceNoSearchResults =
      'maintenance_no_search_results';
  static const String maintenanceFilterTitle = 'maintenance_filter_title';

  static const String maintenanceDetailTitle = 'maintenance_detail_title';
  static const String maintenanceReportedFault = 'maintenance_reported_fault';
  static const String maintenanceLocation = 'maintenance_location';
  static const String maintenanceSentAt = 'maintenance_sent_at';
  static const String maintenanceReturnedAt = 'maintenance_returned_at';
  static const String maintenanceCost = 'maintenance_cost';
  static const String maintenanceFreeUnderWarranty =
      'maintenance_free_under_warranty';
  static const String maintenanceResponsibleParty =
      'maintenance_responsible_party';
  static const String maintenancePerformedBy = 'maintenance_performed_by';
  static const String maintenanceNotes = 'maintenance_notes';
  static const String maintenanceCancelledAt = 'maintenance_cancelled_at';
  static const String maintenanceCancelReasonLabel =
      'maintenance_cancel_reason_label';
  static const String maintenanceClosedAt = 'maintenance_closed_at';

  static const String maintenanceCreateTitle = 'maintenance_create_title';
  static const String maintenanceSelectMachine = 'maintenance_select_machine';
  static const String maintenanceSelectLocation = 'maintenance_select_location';
  static const String maintenanceReportedFaultHint =
      'maintenance_reported_fault_hint';
  static const String maintenanceCreateSubmit = 'maintenance_create_submit';
  static const String maintenanceCreatedSuccess = 'maintenance_created_success';

  static const String maintenanceActionSend = 'maintenance_action_send';
  static const String maintenanceActionReceive = 'maintenance_action_receive';
  static const String maintenanceActionCancel = 'maintenance_action_cancel';
  static const String maintenanceActionClose = 'maintenance_action_close';
  static const String maintenanceActionEdit = 'maintenance_action_edit';

  static const String maintenanceSendTitle = 'maintenance_send_title';
  static const String maintenanceReceiveTitle = 'maintenance_receive_title';
  static const String maintenanceCancelTitle = 'maintenance_cancel_title';
  static const String maintenanceCancelHint = 'maintenance_cancel_hint';
  static const String maintenanceCancelReasonRequired =
      'maintenance_cancel_reason_required';

  static const String maintenanceSentSuccess = 'maintenance_sent_success';
  static const String maintenanceReceivedSuccess =
      'maintenance_received_success';
  static const String maintenanceCancelledSuccess =
      'maintenance_cancelled_success';
  static const String maintenanceClosedSuccess = 'maintenance_closed_success';
  static const String maintenanceUpdatedSuccess = 'maintenance_updated_success';

  static const String maintenanceCloseTitle = 'maintenance_close_title';
  static const String maintenanceCloseResult = 'maintenance_close_result';
  static const String maintenanceCloseFreeUnderWarranty =
      'maintenance_close_free_under_warranty';
  static const String maintenanceCloseWarrantySuggested =
      'maintenance_close_warranty_suggested';
  static const String maintenanceCloseCost = 'maintenance_close_cost';
  static const String maintenanceCloseCostRequired =
      'maintenance_close_cost_required';
  static const String maintenanceCloseResponsibleParty =
      'maintenance_close_responsible_party';
  static const String maintenanceCloseResponsibleUser =
      'maintenance_close_responsible_user';
  static const String maintenanceCloseResponsibleMerchant =
      'maintenance_close_responsible_merchant';
  static const String maintenanceClosePaymentMethod =
      'maintenance_close_payment_method';
  static const String maintenanceCloseSupplier = 'maintenance_close_supplier';
  static const String maintenanceCloseInvoice = 'maintenance_close_invoice';
  static const String maintenanceCloseReturnedAt =
      'maintenance_close_returned_at';
  static const String maintenanceCloseSubmit = 'maintenance_close_submit';
  static const String maintenanceCloseNeedsReplacement =
      'maintenance_close_needs_replacement';

  static const String maintenanceClosePreviewTitle =
      'maintenance_close_preview_title';
  static const String maintenanceClosePreviewNone =
      'maintenance_close_preview_none';
  static const String maintenanceClosePreviewExpense =
      'maintenance_close_preview_expense';
  static const String maintenanceClosePreviewViolation =
      'maintenance_close_preview_violation';
  static const String maintenanceClosePreviewSubscriptionFee =
      'maintenance_close_preview_subscription_fee';

  // ── Replacement (`11.3`) ──────────────────────────────────────────────────
  static const String machineReplaceTitle = 'machine_replace_title';
  static const String replacementNewSerial = 'replacement_new_serial';
  static const String replacementNewBattery = 'replacement_new_battery';
  static const String replacementNewSim = 'replacement_new_sim';
  static const String replacementNewBox = 'replacement_new_box';
  static const String replacementHasBox = 'replacement_has_box';
  static const String replacementReason = 'replacement_reason';
  static const String replacementReplacedAt = 'replacement_replaced_at';
  static const String replacementSubmit = 'replacement_submit';
  static const String replacementSuccess = 'replacement_success';
  static const String replacementChainPreviewTitle =
      'replacement_chain_preview_title';
  static const String replacementOldMachine = 'replacement_old_machine';
  static const String replacementNewMachine = 'replacement_new_machine';
  static const String replacementOldMachineDetail =
      'replacement_old_machine_detail';
  static const String replacementNewMachineDetail =
      'replacement_new_machine_detail';
  static const String replacementCustodyNote = 'replacement_custody_note';
  static const String replacementWarrantyTitle = 'replacement_warranty_title';
  static const String replacementScan = 'replacement_scan';
  static const String replacementMinimumLength = 'replacement_minimum_length';
  static const String replacementSerialMustDiffer =
      'replacement_serial_must_differ';
  static const String replacementWarrantyOrder = 'replacement_warranty_order';

  // ── Decommission (`11.4`/`11.5`) ─────────────────────────────────────────
  static const String machineDecommissionTitle = 'machine_decommission_title';
  static const String decommissionReason = 'decommission_reason';
  static const String decommissionNotes = 'decommission_notes';
  static const String decommissionAt = 'decommission_at';
  static const String decommissionSubmit = 'decommission_submit';
  static const String decommissionSuccess = 'decommission_success';
  static const String decommissionSnapshotTitle = 'decommission_snapshot_title';
  static const String decommissionRepairCount = 'decommission_repair_count';
  static const String decommissionCumulativeCost =
      'decommission_cumulative_cost';
  static const String decommissionCostRatio = 'decommission_cost_ratio';
  static const String decommissionAge = 'decommission_age';
  static const String decommissionAgeMonths = 'decommission_age_months';
  static const String decommissionChainLength = 'decommission_chain_length';
  static const String decommissionUnknownPrice = 'decommission_unknown_price';
  static const String decommissionChainAwareNote =
      'decommission_chain_aware_note';
  static const String decommissionRatioNote = 'decommission_ratio_note';
  static const String decommissionNotesHint = 'decommission_notes_hint';
  static const String decommissionReasonRequired =
      'decommission_reason_required';
  static const String decommissionNotesRequired = 'decommission_notes_required';
  static const String decommissionConfirmTitle = 'decommission_confirm_title';
  static const String decommissionConfirmDescription =
      'decommission_confirm_description';
  static const String decommissionSignatureReason =
      'decommission_signature_reason';
  static const String decommissionPreconditionTitle =
      'decommission_precondition_title';
  static const String decommissionPreconditionDescription =
      'decommission_precondition_description';

  static const String decommissionRevertTitle = 'decommission_revert_title';
  static const String decommissionRevertReason = 'decommission_revert_reason';
  static const String decommissionRevertSubmit = 'decommission_revert_submit';
  static const String decommissionRevertSuccess = 'decommission_revert_success';
  static const String decommissionRevertedBadge = 'decommission_reverted_badge';

  static const String decommissionsListTitle = 'decommissions_list_title';
  static const String decommissionsEmpty = 'decommissions_empty';

  static const String decommissionCandidatesTitle =
      'decommission_candidates_title';
  static const String decommissionCandidatesEmpty =
      'decommission_candidates_empty';
  static const String decommissionRecommendationKeep =
      'decommission_recommendation_keep';
  static const String decommissionRecommendationReview =
      'decommission_recommendation_review';
  static const String decommissionRecommendationConsider =
      'decommission_recommendation_consider';
  static const String decommissionCandidateAction =
      'decommission_candidate_action';
  static const String decommissionCandidatesSuggestion =
      'decommission_candidates_suggestion';
  static const String decommissionThresholdsTitle =
      'decommission_thresholds_title';
  static const String decommissionMinRatio = 'decommission_min_ratio';
  static const String decommissionMinRepairs = 'decommission_min_repairs';
  static const String decommissionMinAge = 'decommission_min_age';
  static const String decommissionApplyThresholds =
      'decommission_apply_thresholds';
  static const String decommissionSortRatio = 'decommission_sort_ratio';
  static const String decommissionSortRepairs = 'decommission_sort_repairs';
  static const String decommissionSortAge = 'decommission_sort_age';
  static const String decommissionRatioShort = 'decommission_ratio_short';
  static const String decommissionRepairsShort = 'decommission_repairs_short';
  static const String decommissionAgeShort = 'decommission_age_short';
  static const String decommissionChainCount = 'decommission_chain_count';

  // ── Notifications ────────────────────────────────────────────────────────
  static const String notificationsEmptyTitle = 'notifications_empty_title';
  static const String notificationsEmptySubtitle =
      'notifications_empty_subtitle';
  static const String notificationsMarkAllRead = 'notifications_mark_all_read';
  static const String notificationPreferencesTitle =
      'notification_preferences_title';
  static const String notificationsChannelPush = 'notifications_channel_push';
  static const String notificationsChannelInApp =
      'notifications_channel_in_app';
  static const String notificationsInAppLockedHint =
      'notifications_in_app_locked_hint';
  static const String notificationsQuietHoursTitle =
      'notifications_quiet_hours_title';
  static const String notificationsQuietHoursBody =
      'notifications_quiet_hours_body';
  static const String notificationsQuietHoursExceptions =
      'notifications_quiet_hours_exceptions';
  static const String notificationsPermissionTitle =
      'notifications_permission_title';
  static const String notificationsPermissionBody =
      'notifications_permission_body';
  static const String notificationsPermissionAllow =
      'notifications_permission_allow';
  static const String notificationsPermissionNotNow =
      'notifications_permission_not_now';
  static const String notificationsDeepLinkUnavailable =
      'notifications_deep_link_unavailable';
  static const String notificationsGroupToday = 'notifications_group_today';
  static const String notificationsGroupYesterday =
      'notifications_group_yesterday';
  static const String notificationsGroupThisWeek =
      'notifications_group_this_week';
  static const String notificationsGroupOlder = 'notifications_group_older';
  static const String notificationTemplateTransferPending =
      'notification_template_transfer_pending';
  static const String notificationTemplateTransferConfirmed =
      'notification_template_transfer_confirmed';
  static const String notificationTemplateTransferRejected =
      'notification_template_transfer_rejected';
  static const String notificationTemplateTransferReminder =
      'notification_template_transfer_reminder';
  static const String notificationTemplateTransferStuck =
      'notification_template_transfer_stuck';
  static const String notificationTemplateViolationCreated =
      'notification_template_violation_created';
  static const String notificationTemplateViolationCharged =
      'notification_template_violation_charged';
  static const String notificationTemplateMaintenanceOpened =
      'notification_template_maintenance_opened';
  static const String notificationTemplateMaintenanceReturned =
      'notification_template_maintenance_returned';
  static const String notificationTemplateMachineReplaced =
      'notification_template_machine_replaced';
  static const String notificationTemplateWarrantyExpiring =
      'notification_template_warranty_expiring';
  static const String notificationTemplateWarrantyExpired =
      'notification_template_warranty_expired';
  static const String notificationTemplateBudgetWarning =
      'notification_template_budget_warning';
  static const String notificationTemplateBudgetExceeded =
      'notification_template_budget_exceeded';
  static const String notificationTemplateSubscriptionDue =
      'notification_template_subscription_due';
  static const String notificationTemplateSubscriptionOverdue =
      'notification_template_subscription_overdue';
  static const String notificationTemplateMachineIdle =
      'notification_template_machine_idle';
  static const String notificationTemplateDecommissionCandidate =
      'notification_template_decommission_candidate';
  static const String notificationTemplateMachineDecommissioned =
      'notification_template_machine_decommissioned';
  static const String notificationTemplateDigest =
      'notification_template_digest';
  static const String notificationTemplateUnknown =
      'notification_template_unknown';
}
