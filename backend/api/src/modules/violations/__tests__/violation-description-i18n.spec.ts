import { localizeAutoDescription } from '../violation-rules';

describe('localizeAutoDescription', () => {
  it.each([
    [
      'Battery returned as B-2, bonded battery is B-1',
      'أُعيدت البطارية برقم B-2، والبطارية المسجلة هي B-1',
    ],
    ['Issued with a charger and returned without one', 'سُلّمت بشاحن وأُعيدت بدونه'],
    ['Issued boxed and returned without the carton', 'سُلّمت بالكرتونة وأُعيدت بدونها'],
    ['Issued in GOOD condition and returned DAMAGED', 'سُلّمت بحالة سليمة وأُعيدت بحالة تالفة'],
    [
      'Held for 40 days, past the 30-day limit',
      'ظلت في العهدة 40 يومًا، بعد تجاوز الحد المسموح 30 يومًا',
    ],
  ])('words "%s" in Arabic', (english, arabic) => {
    expect(localizeAutoDescription(english, 'ar')).toBe(arabic);
  });

  it('leaves English readers and free text alone', () => {
    expect(localizeAutoDescription('Held for 40 days, past the 30-day limit', 'en')).toBe(
      'Held for 40 days, past the 30-day limit',
    );
    expect(localizeAutoDescription('كسر في الشاشة', 'ar')).toBe('كسر في الشاشة');
  });
});
