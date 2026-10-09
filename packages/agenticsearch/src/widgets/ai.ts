import { connectAiAnswer, connectSuggestedQuestions } from '../connectors';
import type { Widget } from '../core/types';
import { button, clear, el, icon, openWhere, resolveContainer, type Container } from '../lib/dom';
import { renderCard } from './card';

export interface AiAnswerParams {
  container: Container;
  /** Show the products the answer is about under it. Off on a results page, where the grid already does. */
  showHits?: boolean;
}

/** The AI's answer to what was asked: one short text, where it comes from, and a way to start over. */
export function aiAnswer(params: AiAnswerParams): Widget {
  const root = resolveContainer(params.container, 'aiAnswer');
  return connectAiAnswer<AiAnswerParams>(({ status, question, answer, hits, links, disclaimer, isContinuing, enabled, reset, instance }) => {
    const s = instance.strings;
    root.classList.add('sfas-answer');
    clear(root);
    const on = enabled && (status === 'loading' || status === 'done');
    root.hidden = !on;
    root.setAttribute('aria-live', 'polite');
    if (!on) return;
    if (isContinuing || status === 'done') {
      const head = el('div', 'sfas-answer-head');
      head.appendChild(el('span', 'sfas-answer-asked', `“${question}”`));
      const over = button('sfas-answer-reset', s.startOver);
      over.addEventListener('click', () => { reset(); instance.submit(''); });
      head.appendChild(over);
      root.appendChild(head);
    }
    const body = el('div', 'sfas-answer-body');
    body.appendChild(icon('spark', 'sfas-answer-mark'));
    const said = el('div', 'sfas-answer-said');
    if (status === 'loading') {
      said.setAttribute('aria-busy', 'true');
      said.appendChild(el('span', 'sfas-ghost-line'));
      said.appendChild(el('span', 'sfas-ghost-line sfas-ghost-line--short'));
      said.appendChild(el('span', 'sfas-visually-hidden', s.thinking));
    } else {
      said.appendChild(el('p', 'sfas-answer-text', answer));
      if (links.length) {
        const places = el('div', 'sfas-answer-links');
        for (const link of links.slice(0, 3)) {
          const a = openWhere(el('a', '', link.label), instance.opensInNewTab());
          a.href = link.url;
          places.appendChild(a);
        }
        said.appendChild(places);
      }
      if (disclaimer) said.appendChild(el('p', 'sfas-answer-disclaimer', disclaimer));
    }
    body.appendChild(said);
    root.appendChild(body);
    if (params.showHits && status === 'done' && hits.length) {
      const list = el('ul', 'sfas-hits sfas-hits--rows');
      hits.forEach((hit, i) => list.appendChild(renderCard(hit, i, { compact: true, fallbackImage: instance.config.fallbackImage, newTab: instance.opensInNewTab(), onClick: (h, p) => instance.sendClick(h, p, question) })));
      root.appendChild(list);
    }
  }, () => clear(root))(params);
}

export interface SuggestedQuestionsParams { container: Container; questions?: string[]; limit?: number }

/** The tool's example questions as buttons. A click searches and asks. */
export function suggestedQuestions(params: SuggestedQuestionsParams): Widget {
  const root = resolveContainer(params.container, 'suggestedQuestions');
  return connectSuggestedQuestions<SuggestedQuestionsParams>(({ items, ask, enabled }) => {
    root.classList.add('sfas-questions');
    clear(root);
    root.hidden = !enabled || !items.length;
    for (const question of items) {
      const b = button('sfas-question', question);
      b.addEventListener('click', () => ask(question));
      root.appendChild(b);
    }
  }, () => clear(root))(params);
}
