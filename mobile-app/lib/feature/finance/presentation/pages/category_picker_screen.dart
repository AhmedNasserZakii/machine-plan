import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/local_storage/local_storage_constant_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';

class CategoryPickerScreen extends StatefulWidget {
  const CategoryPickerScreen({
    required this.repo,
    required this.kind,
    super.key,
    this.excludeId,
  });
  final FinanceRepo repo;
  final FinanceKind kind;
  final String? excludeId;
  @override
  State<CategoryPickerScreen> createState() => _CategoryPickerScreenState();
}

class _CategoryPickerScreenState extends State<CategoryPickerScreen> {
  List<FinanceCategory>? _roots;
  String? _error;
  String _search = '';
  final List<FinanceCategory> _trail = <FinanceCategory>[];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await widget.repo.categories(kind: widget.kind);
    if (!mounted) return;
    result.fold(
      (f) => setState(() => _error = f.errorMessage),
      (rows) => setState(() => _roots = rows),
    );
  }

  List<FinanceCategory> get _current => _trail.isEmpty
      ? (_roots ?? const <FinanceCategory>[])
      : _trail.last.children;
  Iterable<FinanceCategory> get _all =>
      (_roots ?? const <FinanceCategory>[]).expand((e) => e.flattened);
  Future<void> _select(FinanceCategory category) async {
    final List<String> recent =
        LocalStorage.local
            ?.getStringList(StorageKeys.recentFinanceCategoryIds)
            ?.toList() ??
        <String>[];
    recent
      ..remove(category.id)
      ..insert(0, category.id);
    await LocalStorage.local?.setStringList(
      StorageKeys.recentFinanceCategoryIds,
      recent.take(8).toList(),
    );
    if (mounted) Navigator.pop(context, category);
  }

  @override
  Widget build(BuildContext context) {
    if (_roots == null && _error == null) {
      return const Scaffold(body: AppLoadingIndicator());
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(),
        body: AppErrorView(message: _error!, onRetry: _load),
      );
    }
    final String query = _search.trim().toLowerCase();
    final List<FinanceCategory> rows =
        (query.isEmpty
                ? _current
                : _all.where((c) => c.name.toLowerCase().contains(query)))
            .where((c) => c.id != widget.excludeId && c.isActive)
            .toList(growable: false);
    final Set<String> recentIds =
        (LocalStorage.local?.getStringList(
                  StorageKeys.recentFinanceCategoryIds,
                ) ??
                const <String>[])
            .toSet();
    if (query.isEmpty && _trail.isEmpty) {
      rows.sort(
        (a, b) => (recentIds.contains(b.id) ? 1 : 0).compareTo(
          recentIds.contains(a.id) ? 1 : 0,
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.financeChooseCategory.tr())),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: LocaleKeys.financeSearchCategories.tr(),
              ),
              onChanged: (value) => setState(() => _search = value),
            ),
          ),
          if (_trail.isNotEmpty && query.isEmpty)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
              ),
              child: Row(
                children: <Widget>[
                  ActionChip(
                    label: Text(LocaleKeys.all.tr()),
                    onPressed: () => setState(_trail.clear),
                  ),
                  ..._trail.asMap().entries.map(
                    (entry) => Row(
                      children: <Widget>[
                        const Icon(Icons.chevron_right, size: 18),
                        ActionChip(
                          label: Text(entry.value.name),
                          onPressed: () => setState(
                            () => _trail.removeRange(
                              entry.key + 1,
                              _trail.length,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: rows.isEmpty
                ? AppEmptyState(
                    icon: Icons.category_outlined,
                    title: LocaleKeys.financeNoCategories.tr(),
                    subtitle: LocaleKeys.financeNoCategoriesSubtitle.tr(),
                  )
                : ListView.builder(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    itemCount: rows.length,
                    itemBuilder: (_, index) {
                      final c = rows[index];
                      return Card(
                        child: ListTile(
                          leading: recentIds.contains(c.id) && _trail.isEmpty
                              ? const Icon(Icons.history)
                              : Icon(
                                  c.children.isEmpty
                                      ? Icons.label_outline
                                      : Icons.folder_outlined,
                                ),
                          title: Text(c.name),
                          subtitle: c.description == null
                              ? null
                              : Text(c.description!, maxLines: 1),
                          onTap: () => _select(c),
                          trailing: c.children.isEmpty
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.chevron_right),
                                  tooltip: LocaleKeys.financeOpenSubcategories
                                      .tr(),
                                  onPressed: () => setState(() {
                                    _trail.add(c);
                                    _search = '';
                                  }),
                                ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
