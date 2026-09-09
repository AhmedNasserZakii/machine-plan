/// One dashboard tile, named so a single failed/offline tile can be retried
/// without re-fetching the other six.
enum HomeBlockKind { machines, transfers, merchants, violations, maintenance, finance, budgets }
