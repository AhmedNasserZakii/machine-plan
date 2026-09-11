import 'dart:async';

/// A tiny broadcast so anything showing finance totals — the Finance tab, the
/// home dashboard — can refresh the moment something outside its own screen
/// posts a finance transaction, most notably charging a violation from the
/// Violations tab.
///
/// Needed because `MainScaffold`'s `IndexedStack` keeps every tab's cubit
/// alive for the whole session once its tab is first built (`BlocProvider`'s
/// `create` runs once, not per tab switch), so a tab that never re-visits
/// `initState` would otherwise show stale totals until the app restarts.
class FinanceChangeNotifier {
  final StreamController<void> _changes = StreamController<void>.broadcast();
  Stream<void> get onChange => _changes.stream;

  void notify() {
    if (!_changes.isClosed) _changes.add(null);
  }
}
