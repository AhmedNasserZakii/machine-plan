import 'dart:async';

import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';

/// Broadcast so the merchants tab can update while it stays mounted in
/// `MainScaffold`'s `IndexedStack` — e.g. after registering a shop from Home.
class MerchantsChangeNotifier {
  final StreamController<MerchantsChange> _changes =
      StreamController<MerchantsChange>.broadcast();

  Stream<MerchantsChange> get onChange => _changes.stream;

  void notifyCreated(MerchantEntity merchant) {
    if (!_changes.isClosed) {
      _changes.add(MerchantCreated(merchant));
    }
  }

  void notifyUpdated(MerchantEntity merchant) {
    if (!_changes.isClosed) {
      _changes.add(MerchantUpdated(merchant));
    }
  }

  void notifyRemoved(String id) {
    if (!_changes.isClosed) {
      _changes.add(MerchantRemoved(id));
    }
  }
}

sealed class MerchantsChange {
  const MerchantsChange();
}

class MerchantCreated extends MerchantsChange {
  const MerchantCreated(this.merchant);
  final MerchantEntity merchant;
}

class MerchantUpdated extends MerchantsChange {
  const MerchantUpdated(this.merchant);
  final MerchantEntity merchant;
}

class MerchantRemoved extends MerchantsChange {
  const MerchantRemoved(this.id);
  final String id;
}
