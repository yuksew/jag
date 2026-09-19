import { describe, expect, it } from 'vitest';
import { fresh } from './state';
import { isTabOpen, openTabs, visibleTabs } from './tabs';

describe('タブの解放', () => {
  it('初期は練習場と身体だけ。次の記録帳が鍵付きで見える', () => {
    const s = fresh();
    expect(openTabs(s)).toEqual(['practice', 'body']);
    expect(visibleTabs(s)).toEqual([
      { id: 'practice', open: true },
      { id: 'body', open: true },
      { id: 'record', open: false },
    ]);
  });

  it('記録帳 → クラブ（4 球）→ 路上（5 球）→ パッシング（6 球）', () => {
    const s = fresh();
    s.recordOpen = true;
    expect(openTabs(s)).toEqual(['practice', 'body', 'record']);
    s.balls = 4;
    expect(isTabOpen(s, 'club')).toBe(true);
    expect(isTabOpen(s, 'street')).toBe(false);
    s.balls = 6;
    expect(openTabs(s)).toEqual(['practice', 'body', 'record', 'club', 'street', 'passing']);
  });

  it('舞台は 7 球フラッシュと拍手 1000 の両方が要る', () => {
    const s = fresh();
    s.recordOpen = true;
    s.balls = 7;
    s.applause = 1000;
    expect(isTabOpen(s, 'stage')).toBe(false);
    s.flash7 = true;
    expect(isTabOpen(s, 'stage')).toBe(true);
    s.applause = 999;
    expect(isTabOpen(s, 'stage')).toBe(false);
  });
});
