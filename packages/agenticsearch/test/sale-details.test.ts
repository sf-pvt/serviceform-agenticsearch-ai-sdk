import { describe, expect, it } from 'vitest';
import { hitFromWire } from '../src/client/wire';
import { renderCard } from '../src/widgets/card';

const row = { t: 'Kreatiini 500 g', p: '8,99 €', op: '17,95 €', off: 50, meta: 'Brand · Category', h: '/products/k', img: '' };

describe('sale price and the details line', () => {
  it('reads the old price and the percent off from the wire', () => {
    const hit = hitFromWire(row)!;
    expect(hit.oldPrice).toBe('17,95 €');
    expect(hit.discount).toBe(50);
  });

  it('strikes the old price through and badges the percent off', () => {
    const card = renderCard(hitFromWire(row)!, 0, {});
    expect(card.querySelector('.sfas-hit-price')?.firstChild?.textContent).toBe('8,99 €');
    expect(card.querySelector('s.sfas-hit-was')?.textContent).toBe('17,95 €');
    expect(card.querySelector('.sfas-hit-badge--sale')?.textContent).toBe('-50%');
  });

  it('shows the line under the name unless told not to', () => {
    expect(renderCard(hitFromWire(row)!, 0, {}).querySelector('.sfas-hit-meta')).not.toBeNull();
    expect(renderCard(hitFromWire(row)!, 0, { details: false }).querySelector('.sfas-hit-meta')).toBeNull();
  });
});

describe('sale switched off', () => {
  it('shows only the price', () => {
    const card = renderCard(hitFromWire(row)!, 0, { sale: false });
    expect(card.querySelector('s.sfas-hit-was')).toBeNull();
    expect(card.querySelector('.sfas-hit-badge--sale')).toBeNull();
  });
});

describe("the shop's own badge", () => {
  const own = { ...row, bd: '💫 NEW!' };
  it('shows it on the picture, before the percent off', () => {
    const card = renderCard(hitFromWire(own)!, 0, {});
    const badges = [...card.querySelectorAll('.sfas-hit-badge')].map((b) => b.textContent);
    expect(badges).toEqual(['💫 NEW!', '-50%']);
  });
  it('can be switched off', () => {
    expect(renderCard(hitFromWire(own)!, 0, { shopBadge: false }).querySelector('.sfas-hit-badge--shop')).toBeNull();
  });
});
