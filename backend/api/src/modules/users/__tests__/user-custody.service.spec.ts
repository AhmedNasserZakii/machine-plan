import { DataSource } from 'typeorm';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { UserCustodyService } from '../user-custody.service';
import { UsersService } from '../users.service';

describe('UserCustodyService', () => {
  const user = {
    id: 'user-1',
    fullName: 'Representative',
    role: { code: 'REPRESENTATIVE' },
  };

  function service(
    machineRows: unknown[],
    openViolations = '0',
  ): { subject: UserCustodyService; dataSource: DataSource; users: UsersService } {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce(machineRows)
        .mockResolvedValueOnce([{ count: openViolations }]),
    } as unknown as DataSource;
    const users = {
      findById: jest.fn().mockResolvedValue(user),
    } as unknown as UsersService;

    return { subject: new UserCustodyService(dataSource, users), dataSource, users };
  }

  it('returns an empty summary when the user has no custody', async () => {
    const { subject } = service([]);

    await expect(subject.findForUser(user.id, 'branch-1', 'ar')).resolves.toEqual({
      user: { id: user.id, fullName: user.fullName, role: 'REPRESENTATIVE' },
      summary: { totalMachines: 0, withMerchants: 0, inHand: 0, openViolations: 0 },
      machines: [],
    });
  });

  it('maps one machine held directly by the user', async () => {
    const { subject } = service([
      {
        id: 'machine-1',
        serial: 'SN-1',
        model_name: 'Model A',
        status: MachineStatus.WITH_REPRESENTATIVE,
        merchant_id: null,
        merchant_shop_name: null,
        held_since: '2026-09-08T10:00:00.000Z',
      },
    ]);

    const result = await subject.findForUser(user.id, null, 'en');

    expect(result.summary).toEqual({
      totalMachines: 1,
      withMerchants: 0,
      inHand: 1,
      openViolations: 0,
    });
    expect(result.machines[0]).toMatchObject({ serial: 'SN-1', merchant: null });
  });

  it('totals direct and merchant custody and open violations', async () => {
    const base = {
      model_name: 'Model A',
      status: MachineStatus.WITH_MERCHANT,
      held_since: new Date('2026-09-08T10:00:00.000Z'),
    };
    const { subject } = service(
      [
        {
          ...base,
          id: 'machine-1',
          serial: 'SN-1',
          status: MachineStatus.WITH_REPRESENTATIVE,
          merchant_id: null,
          merchant_shop_name: null,
        },
        {
          ...base,
          id: 'machine-2',
          serial: 'SN-2',
          merchant_id: 'merchant-1',
          merchant_shop_name: 'Shop One',
        },
        {
          ...base,
          id: 'machine-3',
          serial: 'SN-3',
          merchant_id: 'merchant-2',
          merchant_shop_name: 'Shop Two',
        },
      ],
      '2',
    );

    const result = await subject.findForUser(user.id, null, 'ar');

    expect(result.summary).toEqual({
      totalMachines: 3,
      withMerchants: 2,
      inHand: 1,
      openViolations: 2,
    });
    expect(result.machines[1].merchant).toEqual({ id: 'merchant-1', shopName: 'Shop One' });
  });
});
