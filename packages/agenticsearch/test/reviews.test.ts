import { afterEach, describe, expect, it } from 'vitest';
import { agenticsearch, infiniteHits } from '../src';
import { hitFromWire } from '../src/client/wire';
import { browseBody, clientWith, configBody, product, tick } from './helpers';

const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
const routes = () => ({
  '/browse/': browseBody({ state: undefined, products: [product(40, { rt: 4.4, rc: 60 }), product(60)] }),
  '/omnibox/config/': configBody({ language: 'en' }),
});

afterEach(() => { document.body.innerHTML = ''; });

describe('reviews on cards', () => {
  it('reads a rating and its count from the wire, and nothing for a product without', () => {
    expect(hitFromWire(product(1, { rt: 4.4, rc: 60 }))).toMatchObject({ rating: 4.4, reviews: 60 });
    const plain = hitFromWire(product(2))!;
    expect(plain.rating).toBeUndefined();
    expect(plain.reviews).toBeUndefined();
    expect(hitFromWire(product(3, { rt: 9, rc: 'x' }))).toMatchObject({ rating: 5 });
  });

  it('shows stars and the count by default, only on products that have a rating', async () => {
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    const ratings = node.querySelectorAll<HTMLElement>('.sfas-hit-rating');
    expect(ratings).toHaveLength(1);
    expect(ratings[0].getAttribute('aria-label')).toBe('4.4 / 5 (60)');
    expect(ratings[0].querySelector<HTMLElement>('.sfas-stars-on')!.style.width).toBe('88%');
    expect(ratings[0].querySelector('.sfas-hit-reviews')!.textContent).toBe('(60)');
  });

  it('shows none when turned off', async () => {
    const { client } = clientWith(routes());
    const node = host();
    agenticsearch({ searchClient: client, insights: false, reviews: false }).addWidgets([infiniteHits({ container: node })]).start();
    await tick(5);
    expect(node.querySelectorAll('.sfas-hit')).toHaveLength(2);
    expect(node.querySelector('.sfas-hit-rating')).toBeNull();
  });
});
