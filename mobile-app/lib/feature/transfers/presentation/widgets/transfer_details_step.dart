import 'dart:typed_data';

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Step three: what is actually in the box for each machine.
///
/// The battery serial is checked here, on the device, against what the record
/// says is bonded to the unit. The warning has to appear while the person is
/// still holding it — after a round trip it is just a report.
class TransferDetailsStep extends StatelessWidget {
  const TransferDetailsStep({required this.state, super.key});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      itemCount: state.items.length + 2,
      itemBuilder: (BuildContext context, int index) {
        if (index == 0) return const _ApplyToAllButton();
        if (index == state.items.length + 1) return const _NotesField();

        return _ItemDetails(
          key: ValueKey<String>(state.items[index - 1].machine.id),
          item: state.items[index - 1],
        );
      },
    );
  }
}

/// Sets the same accessories/condition across every item in the draft. With
/// twenty identical machines, per-item entry is punishing — the plan's exact
/// call-out (`13-feature-transfers-handover.md`).
class _ApplyToAllButton extends StatelessWidget {
  const _ApplyToAllButton();

  Future<void> _open(BuildContext context) async {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();
    final DraftItem source = cubit.state.items.first;

    final _ApplyToAllChoice? choice = await _ApplyToAllSheet.show(
      context: context,
      initial: source.params,
    );

    if (choice == null || !context.mounted) return;

    cubit.applyToAll(
      hasCharger: choice.hasCharger,
      hasBox: choice.hasBox,
      condition: choice.condition,
    );
    showSuccessToast(LocaleKeys.transferApplyToAllApplied.tr(), context);
  }

  @override
  Widget build(BuildContext context) {
    final bool enabled = context.select(
      (CreateTransferCubit cubit) => cubit.state.items.length > 1,
    );

    if (!enabled) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      child: Align(
        alignment: AlignmentDirectional.centerEnd,
        child: TextButton.icon(
          onPressed: () => _open(context),
          icon: const Icon(Icons.done_all_rounded, size: 18),
          label: Semantics(
            identifier: 'transfer_apply_to_all',
            child: Text(LocaleKeys.transferApplyToAll.tr()),
          ),
        ),
      ),
    );
  }
}

class _ApplyToAllChoice {
  const _ApplyToAllChoice({
    required this.hasCharger,
    required this.hasBox,
    required this.condition,
  });

  final bool hasCharger;
  final bool hasBox;
  final ItemCondition condition;
}

class _ApplyToAllSheet extends StatefulWidget {
  const _ApplyToAllSheet({required this.initial});

  final TransferItemParams initial;

  static Future<_ApplyToAllChoice?> show({
    required BuildContext context,
    required TransferItemParams initial,
  }) {
    return showModalBottomSheet<_ApplyToAllChoice>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => _ApplyToAllSheet(initial: initial),
    );
  }

  @override
  State<_ApplyToAllSheet> createState() => _ApplyToAllSheetState();
}

class _ApplyToAllSheetState extends State<_ApplyToAllSheet> {
  late bool _hasCharger = widget.initial.hasCharger;
  late bool _hasBox = widget.initial.hasBox;
  late ItemCondition _condition = widget.initial.condition;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(LocaleKeys.transferApplyToAll.tr(), style: Styles.s17(context)),
              const SizedBox(height: AppSpacing.md),
              SwitchListTile.adaptive(
                value: _hasCharger,
                contentPadding: EdgeInsets.zero,
                title: Text(LocaleKeys.transferItemCharger.tr()),
                onChanged: (bool value) => setState(() => _hasCharger = value),
              ),
              SwitchListTile.adaptive(
                value: _hasBox,
                contentPadding: EdgeInsets.zero,
                title: Text(LocaleKeys.transferItemBox.tr()),
                onChanged: (bool value) => setState(() => _hasBox = value),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: TransferLabels.selectableConditions
                    .map(
                      (ItemCondition condition) => ChoiceChip(
                        label: Text(TransferLabels.condition(condition)),
                        selected: _condition == condition,
                        onSelected: (_) => setState(() => _condition = condition),
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(
                  _ApplyToAllChoice(
                    hasCharger: _hasCharger,
                    hasBox: _hasBox,
                    condition: _condition,
                  ),
                ),
                child: Text(LocaleKeys.transferApplyToAllApply.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ItemDetails extends StatefulWidget {
  const _ItemDetails({required this.item, super.key});

  final DraftItem item;

  @override
  State<_ItemDetails> createState() => _ItemDetailsState();
}

class _ItemDetailsState extends State<_ItemDetails> {
  late final TextEditingController _batteryController = TextEditingController(
    text: widget.item.params.batterySerialScanned ?? '',
  );
  late final TextEditingController _notesController = TextEditingController(
    text: widget.item.params.notes ?? '',
  );

  /// Every photo added this session, keyed by the id the upload/staging call
  /// returned. A create-draft photo has no server URL to preview from — the
  /// bytes captured on-device are the only copy worth showing back.
  final Map<String, Uint8List> _photoPreviews = <String, Uint8List>{};
  bool _uploadingPhoto = false;

  String get _machineId => widget.item.machine.id;

  CreateTransferCubit get _cubit => context.read<CreateTransferCubit>();

  @override
  void dispose() {
    _batteryController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _scanBattery() async {
    final String? code = await AppRoute.goToRawBarcodeScanner(
      context: context,
      titleKey: LocaleKeys.scanBatteryScanTooltip,
    );

    if (code == null || !mounted) return;

    setState(() => _batteryController.text = code);
    _cubit.updateItem(_machineId, batterySerialScanned: code);
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final int currentCount = _cubit.state.items
        .firstWhere((DraftItem item) => item.machine.id == _machineId)
        .params
        .photoMediaIds
        .length;
    if (currentCount >= 4) return;

    final XFile? picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 90,
    );
    if (picked == null || !mounted) return;

    setState(() => _uploadingPhoto = true);

    final Uint8List raw = await picked.readAsBytes();
    // Normalizes orientation (`autoCorrectionAngle`) and strips EXIF
    // (`keepExif: false`) as part of the same pass, rather than as separate
    // steps — the plan's "compressed on capture" covers all three.
    final Uint8List compressed = await FlutterImageCompress.compressWithList(
      raw,
      minWidth: 1280,
      minHeight: 1280,
      quality: 70,
      autoCorrectionAngle: true,
      keepExif: false,
    );

    final String? mediaId = await _cubit.addPhoto(_machineId, compressed);

    if (!mounted) return;
    setState(() => _uploadingPhoto = false);

    if (mediaId == null) {
      showErrorToast(LocaleKeys.transferPhotoUploadFailed.tr(), context);
      return;
    }

    setState(() => _photoPreviews[mediaId] = compressed);
  }

  Future<void> _chooseSource() async {
    final ImageSource? source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(LocaleKeys.transferPhotoSourceCamera.tr()),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(LocaleKeys.transferPhotoSourceGallery.tr()),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;
    await _pickPhoto(source);
  }

  void _removePhoto(String mediaId) {
    _cubit.removePhoto(_machineId, mediaId);
    setState(() => _photoPreviews.remove(mediaId));
  }

  @override
  Widget build(BuildContext context) {
    // Rebuilds on every cubit emit, so the freshest params (including this
    // item's own photoMediaIds after an upload) always drive the UI, while
    // the controllers above stay this widget's own — untouched by rebuilds.
    final DraftItem item = context.select(
      (CreateTransferCubit cubit) => cubit.state.items.firstWhere(
        (DraftItem draftItem) => draftItem.machine.id == _machineId,
        orElse: () => widget.item,
      ),
    );

    return Container(
      margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: item.batteryMatches == false
              ? AppColors.dangerColor
              : AppColors.borderColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          LtrText(
            item.machine.serial,
            style: Styles.mono(context).copyWith(fontWeight: FontWeight.w700),
          ),
          SwitchListTile.adaptive(
            value: item.params.hasCharger,
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.transferItemCharger.tr()),
            onChanged: (bool value) =>
                _cubit.updateItem(_machineId, hasCharger: value),
          ),
          SwitchListTile.adaptive(
            value: item.params.hasBox,
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.transferItemBox.tr()),
            onChanged: (bool value) =>
                _cubit.updateItem(_machineId, hasBox: value),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: TransferLabels.selectableConditions
                .map(
                  (ItemCondition condition) => ChoiceChip(
                    label: Text(TransferLabels.condition(condition)),
                    selected: item.params.condition == condition,
                    onSelected: (_) =>
                        _cubit.updateItem(_machineId, condition: condition),
                  ),
                )
                .toList(growable: false),
          ),
          const SizedBox(height: AppSpacing.md),
          LabeledTextFormField(
            label: LocaleKeys.transferScanBattery.tr(),
            hintText: LocaleKeys.scanManualEntryHint.tr(),
            controller: _batteryController,
            textDirection: TextDirection.ltr,
            identifier: 'draft_battery_${item.machine.serial}',
            onChanged: (String value) =>
                _cubit.updateItem(_machineId, batterySerialScanned: value),
            suffixIcon: IconButton(
              onPressed: _scanBattery,
              icon: const Icon(Icons.qr_code_scanner_rounded, size: 20),
              tooltip: LocaleKeys.scanBatteryScanTooltip.tr(),
            ),
          ),
          if (item.batteryMatches != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            _BatteryVerdict(item: item),
          ],
          const SizedBox(height: AppSpacing.md),
          LabeledTextFormField(
            label: LocaleKeys.transferItemNotes.tr(),
            hintText: LocaleKeys.transferItemNotes.tr(),
            controller: _notesController,
            maxLines: 2,
            identifier: 'draft_notes_${item.machine.serial}',
            onChanged: (String value) =>
                _cubit.updateItem(_machineId, notes: value),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            LocaleKeys.transferItemPhotos.tr(),
            style: Styles.s14(context).copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PhotosRow(
            mediaIds: item.params.photoMediaIds,
            previews: _photoPreviews,
            isUploading: _uploadingPhoto,
            onAdd: _chooseSource,
            onRemove: _removePhoto,
          ),
        ],
      ),
    );
  }
}

class _PhotosRow extends StatelessWidget {
  const _PhotosRow({
    required this.mediaIds,
    required this.previews,
    required this.isUploading,
    required this.onAdd,
    required this.onRemove,
  });

  final List<String> mediaIds;
  final Map<String, Uint8List> previews;
  final bool isUploading;
  final VoidCallback onAdd;
  final void Function(String mediaId) onRemove;

  static const double _tileSize = 72;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _tileSize,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: <Widget>[
          for (final String mediaId in mediaIds)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
              child: _PhotoThumb(
                bytes: previews[mediaId],
                onRemove: () => onRemove(mediaId),
              ),
            ),
          if (mediaIds.length < 4)
            Semantics(
              identifier: 'transfer_add_photo',
              child: SizedBox(
                width: _tileSize,
                height: _tileSize,
                child: OutlinedButton(
                  onPressed: isUploading ? null : onAdd,
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                  ),
                  child: isUploading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add_a_photo_outlined, size: 22),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.bytes, required this.onRemove});

  final Uint8List? bytes;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _PhotosRow._tileSize,
      height: _PhotosRow._tileSize,
      child: Stack(
        children: <Widget>[
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: SizedBox(
              width: _PhotosRow._tileSize,
              height: _PhotosRow._tileSize,
              child: bytes != null
                  ? Image.memory(bytes!, fit: BoxFit.cover)
                  : const ColoredBox(
                      color: AppColors.borderColor,
                      child: Icon(Icons.image_outlined),
                    ),
            ),
          ),
          PositionedDirectional(
            top: -6,
            end: -6,
            child: InkWell(
              onTap: onRemove,
              borderRadius: BorderRadius.circular(12),
              child: const CircleAvatar(
                radius: 11,
                backgroundColor: AppColors.dangerColor,
                child: Icon(Icons.close_rounded, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Says plainly whether the battery in hand belongs to this machine. A mismatch
/// does not block the hand-off — it is recorded, and someone answers for it
/// later — but it must not go unsaid at the moment it is discovered.
class _BatteryVerdict extends StatelessWidget {
  const _BatteryVerdict({required this.item});

  final DraftItem item;

  @override
  Widget build(BuildContext context) {
    final bool matches = item.batteryMatches ?? false;
    final Color color = matches
        ? AppColors.successColor
        : AppColors.dangerColor;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(
          matches
              ? Icons.check_circle_outline_rounded
              : Icons.battery_alert_outlined,
          size: 16,
          color: color,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                matches
                    ? LocaleKeys.transferBatteryMatch.tr()
                    : LocaleKeys.transferItemBatteryMismatch.tr(),
                style: Styles.s12(
                  context,
                ).copyWith(color: color, fontWeight: FontWeight.w600),
              ),
              if (!matches && item.expectedBatterySerial != null)
                LtrText(
                  LocaleKeys.transferItemBatteryExpected.tr(
                    args: <String>[item.expectedBatterySerial!],
                  ),
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NotesField extends StatelessWidget {
  const _NotesField();

  @override
  Widget build(BuildContext context) {
    return LabeledTextFormField(
      label: LocaleKeys.transferNotes.tr(),
      hintText: LocaleKeys.transferNotes.tr(),
      maxLines: 3,
      identifier: 'transfer_notes_field',
      onChanged: context.read<CreateTransferCubit>().setNotes,
    );
  }
}
