/**
 * The stock market.
 *
 * A price table with two buttons per row. The interesting part is the timer: the
 * panel shows a live countdown to the next tick, because a market you cannot
 * time is just a slot machine with extra steps.
 *
 * Rows are built once. On every refresh only the price, the change figure, the
 * share count and the four button states are written, which is four dozen
 * property assignments rather than a rebuild of a list with focusable buttons
 * inside it.
 */

import { STOCK_BY_ID } from '../../../shared/balance.js';
import { fmt } from '../../../shared/format.js';
import { nextTickIn, portfolioValue, priceChange } from '../../../shared/market.js';
import { el, fill, labelNode } from './dom.js';
import { hideTooltip, showTooltip, tipRow } from './tooltip.js';

let game = null;
let list = null;
let summary = null;
/** symbol -> row nodes */
const rows = new Map();

export function mountMarket(controller) {
  game = controller;
  list = document.getElementById('market-list');
  summary = document.getElementById('market-summary');
  if (!list) return;

  game.events.on('market-changed', () => renderMarket(controller, controller.now()));
  buildRows(controller);
  renderMarket(controller, controller.now());
}

function buildRows(controller) {
  if (rows.size === controller.state.market.length && list.childElementCount) return;

  rows.clear();
  fill(list, controller.state.market.map((row) => {
    const def = STOCK_BY_ID[row.symbol];

    const price = el('span.stock-price');
    const change = el('span.stock-change');
    const owned = el('span.stock-owned');
    const value = el('span.stock-value');
    const buttons = {
      buy1: actionButton('buy1', 'Buy 1', def.icon),
      buy5: actionButton('buy5', 'Buy 5', def.icon),
      sell: actionButton('sell', 'Sell 1', '💸'),
    };

    const card = el('div.stock', {
      dataset: { symbol: row.symbol },
    }, [
      el('div.stock-head', {}, [
        el('span.stock-icon', { icon: def.icon, 'aria-hidden': 'true' }),
        el('div.stock-id', {}, [
          el('span.stock-symbol', { text: def.symbol }),
          el('span.stock-name', { text: def.name }),
        ]),
        el('div.stock-figures', {}, [price, change]),
      ]),
      el('div.stock-foot', {}, [owned, value, el('div.stock-actions', {}, Object.values(buttons))]),
    ]);

    rows.set(row.symbol, { card, price, change, owned, value, buttons });
    return card;
  }));

  for (const [symbol, row] of rows) {
    row.buttons.buy1.onclick = () => game.buyStock(symbol, 1);
    row.buttons.buy5.onclick = () => game.buyStock(symbol, 5);
    row.buttons.sell.onclick = () => game.sellStock(symbol);

    row.card.addEventListener('pointerenter', () => describe(row.card, symbol));
    row.card.addEventListener('pointerleave', hideTooltip);
  }
}

/**
 * Build one of the four trade buttons.
 *
 * `dataset: { action }` is `{ action: 'action' }`, not a shorthand for the value
 * -- the key is the name and the variable is the value. Getting this backwards
 * produces four buttons that all carry `data-action="action"` and no handler can
 * tell them apart.
 */
function actionButton(action, label, icon) {
  return el('button.btn.btn--stock', {
    type: 'button',
    dataset: { action: action },
  }, [labelNode(`${icon} ${label}`)]);
}
export function renderMarket(controller, now) {
  if (!list) return;
  buildRows(controller);

  const s = controller.state;
  const portfolio = portfolioValue(s);
  const secondsToTick = Math.ceil(nextTickIn(s, now) / 1000);

  if (summary) {
    const shares = `${portfolio.shares} share${portfolio.shares === 1 ? '' : 's'}`;
    summary.textContent = `${shares} · worth ${fmt(portfolio.cost)} · next tick ${secondsToTick}s`;
  }

  for (const row of s.market) {
    const nodes = rows.get(row.symbol);
    const def = STOCK_BY_ID[row.symbol];
    if (!nodes || !def) continue;

    const change = priceChange(row, 6);
    const up = change >= 0;

    nodes.price.textContent = fmt(row.price);
    nodes.change.textContent = `${up ? '+' : ''}${(change * 100).toFixed(1)}%`;
    nodes.change.className = `stock-change ${up ? 'is-up' : 'is-down'}`;
    nodes.owned.textContent = `${row.shares}/${def.maxShares} shares`;
    nodes.value.textContent = row.shares ? `worth ${fmt(row.shares * row.price)}` : '';

    const room = def.maxShares - row.shares;
    nodes.buttons.buy1.disabled = room < 1 || s.cookies < Math.ceil(row.price);
    nodes.buttons.buy5.disabled = room < 1 || s.cookies < Math.ceil(row.price * Math.min(5, room));
    nodes.buttons.sell.disabled = row.shares < 1;

    nodes.card.classList.toggle('is-up', up);
    nodes.card.classList.toggle('is-down', !up);
  }
}

function describe(node, symbol) {
  const row = game.state.market.find((r) => r.symbol === symbol);
  const def = STOCK_BY_ID[symbol];
  if (!row || !def) return;

  showTooltip(node, {
    title: `${def.symbol} · ${def.name}`,
    icon: def.icon,
    rows: [
      tipRow({ label: 'Price', value: fmt(row.price) }),
      tipRow({ label: 'Start price', value: fmt(def.startPrice) }),
      tipRow({ label: 'Volatility', value: `${Math.round(def.volatility * 100)}%` }),
      tipRow({ label: 'Share cap', value: String(def.maxShares) }),
      tipRow({ label: 'You hold', value: String(row.shares), tone: row.shares ? 'good' : null }),
      tipRow({ label: 'Position value', value: fmt(row.shares * row.price) }),
    ],
    footer: 'Prices mean-revert toward their start value, so waiting is sometimes the trade.',
  });
}
