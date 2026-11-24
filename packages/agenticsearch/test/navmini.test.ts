// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../src/prebuilt';
import { browseBody, configBody, fakeFetch, tick } from './helpers';

const host = () => { const node = document.createElement('div'); document.body.appendChild(node); return node; };
const serve = () => { globalThis.fetch = fakeFetch({ '/browse/': browseBody({ state: undefined }), '/omnibox/search/': { products: [], suggestions: [] }, '/omnibox/config/': configBody() }).fetch; };
const pop = () => document.querySelector('.sfas-mini-pop') as HTMLElement | null;
let n = 0;
const mini = () => { serve(); const node = host(); const mounted = mount({ toolId: `mini${++n}`, target: node, layout: 'navmini', apiBase: 'https://api.test', placeholder: 'Etsi' }); return { node, mounted, trigger: node.querySelector('.sfas-mini-trigger') as HTMLButtonElement }; };

afterEach(() => { document.body.innerHTML = ''; });

describe('the Nav mini layout', () => {
  it('shows only the icon until it is clicked', () => {
    const { node, trigger, mounted } = mini();
    expect(mounted.layout).toBe('navmini');
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(node.querySelector('input')).toBeNull();
    expect(pop()).toBeNull();
    mounted.destroy();
  });

  it('opens a panel with the field in it, focused, on one click', async () => {
    const { trigger, mounted } = mini();
    trigger.click();
    await tick(5);
    const panel = pop()!;
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const input = panel.querySelector('.sfas-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Etsi');
    expect(document.activeElement).toBe(input);
    // Fixed under the icon, never wider than the window.
    expect(panel.style.top).toMatch(/px$/);
    expect(parseInt(panel.style.width, 10)).toBeLessThanOrEqual(680);
    mounted.destroy();
  });

  it('closes on a second click on the icon, and on a click elsewhere, but not on a click inside', async () => {
    const { trigger, mounted } = mini();
    trigger.click();
    const panel = pop()!;
    panel.querySelector('.sfas-input')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.hidden).toBe(false);
    trigger.click();
    expect(panel.hidden).toBe(true);
    trigger.click();
    expect(panel.hidden).toBe(false);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    mounted.destroy();
  });

  it('closes on Esc and gives the focus back to the icon', () => {
    const { trigger, mounted } = mini();
    trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pop()!.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
    mounted.destroy();
  });

  it('can be opened with words already in it, and is gone when destroyed', async () => {
    const { node, mounted } = mini();
    mounted.open('kreatiini');
    await tick(5);
    expect((pop()!.querySelector('.sfas-input') as HTMLInputElement).value).toBe('kreatiini');
    mounted.destroy();
    expect(pop()).toBeNull();
    expect(node.querySelector('.sfas-mini-trigger')).toBeNull();
  });

  it('is turned on from the element\'s data-layout, and the box layout has no icon', () => {
    serve();
    document.body.innerHTML = '<div id="a" data-sf-agenticsearch data-tool-id="miniA" data-layout="navmini" data-api-base="https://api.test"></div>';
    const a = mount({ toolId: 'miniA', target: '#a', layout: 'navmini', apiBase: 'https://api.test' });
    expect(document.querySelector('#a .sfas-mini-trigger')).not.toBeNull();
    const b = mount({ toolId: 'miniB', target: host(), layout: 'box', apiBase: 'https://api.test' });
    expect(b.element.querySelector('.sfas-mini-trigger')).toBeNull();
    a.destroy(); b.destroy();
  });
});
