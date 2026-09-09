import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/category_picker_screen.dart';

class CategoryManagementScreen extends StatefulWidget {
  const CategoryManagementScreen({super.key});
  @override
  State<CategoryManagementScreen> createState() =>
      _CategoryManagementScreenState();
}

class _CategoryManagementScreenState extends State<CategoryManagementScreen> {
  final FinanceRepo _repo = getIt<FinanceRepo>();
  List<FinanceCategory>? _rows;
  String? _error;
  FinanceKind _kind = FinanceKind.expense;
  Future<void> _load() async {
    setState(() {
      _rows = null;
      _error = null;
    });
    final result = await _repo.categories(kind: _kind, includeInactive: true);
    if (!mounted) return;
    result.fold(
      (f) => setState(() => _error = f.errorMessage),
      (v) => setState(() => _rows = v),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _edit([FinanceCategory? existing]) async {
    final name = TextEditingController(text: existing?.name);
    final description = TextEditingController(text: existing?.description);
    String? parentId = existing?.parentId;
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: Text(existing == null ? 'Add category' : 'Edit category'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                TextField(
                  controller: description,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Parent'),
                  subtitle: Text(
                    parentId == null ? 'Root category' : 'Selected',
                  ),
                  trailing: const Icon(Icons.account_tree),
                  onTap: () async {
                    final picked = await Navigator.push<FinanceCategory>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CategoryPickerScreen(
                          repo: _repo,
                          kind: _kind,
                          excludeId: existing?.id,
                        ),
                      ),
                    );
                    if (picked != null) setDialog(() => parentId = picked.id);
                  },
                ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (saved != true || name.text.trim().isEmpty) return;
    final draft = CategoryDraft(
      nameAr: name.text.trim(),
      nameEn: name.text.trim(),
      kind: _kind,
      parentId: parentId,
      descriptionAr: description.text.trim(),
      descriptionEn: description.text.trim(),
    );
    final result = existing == null
        ? await _repo.createCategory(draft)
        : await _repo.updateCategory(
            existing.id,
            draft,
            isActive: existing.isActive,
          );
    if (!mounted) return;
    result.fold((f) => showErrorToast(f.errorMessage, context), (_) async {
      if (existing != null && parentId != existing.parentId) {
        final moved = await _repo.moveCategory(existing.id, parentId);
        moved.fold((f) => showErrorToast(f.errorMessage, context), (_) {});
      }
      await _load();
    });
  }

  Future<void> _toggle(FinanceCategory c) async {
    final draft = CategoryDraft(
      nameAr: c.name,
      nameEn: c.name,
      kind: c.kind,
      parentId: c.parentId,
      descriptionAr: c.description,
      descriptionEn: c.description,
      sortOrder: c.sortOrder,
    );
    final result = await _repo.updateCategory(
      c.id,
      draft,
      isActive: !c.isActive,
    );
    if (!mounted) return;
    result.fold((f) => showErrorToast(f.errorMessage, context), (_) => _load());
  }

  Future<void> _delete(FinanceCategory c) async {
    if (!await AppConfirmDialog.show(
      context: context,
      title: 'Delete category?',
      description:
          'Categories with children or transactions cannot be deleted.',
      isDestructive: true,
    )) {
      return;
    }
    final result = await _repo.deleteCategory(c.id);
    if (!mounted) return;
    result.fold(
      (f) => showErrorToast(
        _friendlyCategoryError(f.code, f.errorMessage),
        context,
      ),
      (_) => _load(),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Finance categories')),
    floatingActionButton: FloatingActionButton(
      onPressed: _edit,
      child: const Icon(Icons.add),
    ),
    body: Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
          child: SegmentedButton<FinanceKind>(
            segments: const <ButtonSegment<FinanceKind>>[
              ButtonSegment(value: FinanceKind.expense, label: Text('Expense')),
              ButtonSegment(value: FinanceKind.income, label: Text('Income')),
            ],
            selected: <FinanceKind>{_kind},
            onSelectionChanged: (v) {
              _kind = v.first;
              _load();
            },
          ),
        ),
        Expanded(
          child: _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : _rows == null
              ? const AppLoadingIndicator()
              : ListView(
                  children: _rows!
                      .expand((e) => e.flattened)
                      .map(
                        (c) => ListTile(
                          contentPadding: EdgeInsetsDirectional.only(
                            start: AppSpacing.md + c.depth * 18,
                            end: AppSpacing.sm,
                          ),
                          leading: Icon(
                            c.isSystem
                                ? Icons.lock_outline
                                : Icons.category_outlined,
                            color: c.isActive
                                ? AppColors.primaryColor
                                : AppColors.textDisabledColor,
                          ),
                          title: Text(c.name),
                          subtitle: Text(
                            '${c.transactionCount} transactions • ${c.rolledUpTotal.toStringAsFixed(2)} EGP${c.isActive ? '' : ' • Inactive'}',
                          ),
                          trailing: c.isSystem
                              ? null
                              : PopupMenuButton<String>(
                                  onSelected: (value) {
                                    if (value == 'edit') _edit(c);
                                    if (value == 'toggle') _toggle(c);
                                    if (value == 'delete') _delete(c);
                                  },
                                  itemBuilder: (_) => <PopupMenuEntry<String>>[
                                    const PopupMenuItem(
                                      value: 'edit',
                                      child: Text('Edit / move'),
                                    ),
                                    PopupMenuItem(
                                      value: 'toggle',
                                      child: Text(
                                        c.isActive ? 'Deactivate' : 'Activate',
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Delete'),
                                    ),
                                  ],
                                ),
                        ),
                      )
                      .toList(),
                ),
        ),
      ],
    ),
  );
}

String _friendlyCategoryError(String code, String fallback) => switch (code) {
  'CIRCULAR_CATEGORY_REFERENCE' =>
    'A category cannot be moved inside its own subtree.',
  'CATEGORY_HAS_CHILDREN' => 'Move or delete the child categories first.',
  'CATEGORY_HAS_TRANSACTIONS' =>
    'This category has transactions. Deactivate it instead.',
  'SYSTEM_CATEGORY_PROTECTED' =>
    'System categories cannot be changed or deleted.',
  _ => fallback,
};
