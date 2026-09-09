import 'package:equatable/equatable.dart';

enum HomeBlockAvailability { loading, ready, offline, error }

/// One dashboard tile's fetch outcome, independent of every other tile so a
/// slow or broken backend module never blocks the rest of the dashboard from
/// rendering. `offline` and `error` are kept distinct on purpose: a tile with
/// no local cache genuinely has nothing to show while offline, which is not
/// the same fact as a request that reached the server and failed.
class HomeBlock<T> extends Equatable {
  const HomeBlock._({
    required this.availability,
    this.data,
    this.isFromCache = false,
    this.errorMessage,
  });

  const HomeBlock.loading() : this._(availability: HomeBlockAvailability.loading);

  const HomeBlock.ready(T value, {bool isFromCache = false})
    : this._(
        availability: HomeBlockAvailability.ready,
        data: value,
        isFromCache: isFromCache,
      );

  const HomeBlock.offline() : this._(availability: HomeBlockAvailability.offline);

  const HomeBlock.error(String message)
    : this._(availability: HomeBlockAvailability.error, errorMessage: message);

  final HomeBlockAvailability availability;
  final T? data;

  /// True when [data] came from the local cache rather than a fresh response —
  /// only ever set on a [ready] block, never on `loading`/`offline`/`error`.
  final bool isFromCache;
  final String? errorMessage;

  bool get isLoading => availability == HomeBlockAvailability.loading;

  bool get isReady => availability == HomeBlockAvailability.ready;

  @override
  List<Object?> get props => <Object?>[
    availability,
    data,
    isFromCache,
    errorMessage,
  ];
}
