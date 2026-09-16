import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Money } from './money';

const sessionState = vi.hoisted(() => ({
  permissions: [] as string[],
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('@/lib/auth/use-session', () => ({
  useSession: () => ({
    permissions: sessionState.permissions,
    user: null,
    isLoading: false,
  }),
}));

describe('Money', () => {
  beforeEach(() => {
    sessionState.permissions = [];
  });

  it('renders —— without finance.read', () => {
    render(<Money value={1250} />);
    expect(screen.getByText('web.common.moneyHidden')).toBeInTheDocument();
  });

  it('formats the amount when finance.read is present', () => {
    sessionState.permissions = ['finance.read'];
    render(<Money value={1250} />);
    expect(screen.getByText(/EGP/)).toBeInTheDocument();
    expect(screen.getByText(/1,?250\.00/)).toBeInTheDocument();
  });
});
