/**
 * The garden.
 *
 * Six (or more) plots, each of which is one of four things: empty, growing, ripe,
 * or holding a crop whose seed no longer exists. The renderer builds each plot
 * once and then only updates the parts that change -- the timer, the progress
 * bar -- because a plot that gets replaced four times a second loses its
 * animation and, on a phone, drops the touch that was in progress on it.
 *
 * Seeds are picked in a popover anchored to the plot, not in a separate screen.
 * Planting is the only action, so making it a two-tap flow inside the panel beats
 * navigating anywhere.
 */

import { SEEDS } from '../../../shared/balance.js';
import { fmt, fmtDuration, fmtRate } from '../../../shared/format.js';
import { gardenSummary, plotInfo, seedCost, seedYield } from '../../../shared/garden.js';
import { el, fill } from './dom.js';
import { setIcon } from './icon.js';
import { hideTooltip, showTooltip, tipRow } from './tooltip.js';

let game = null;
let grid = null;
let summary = null;
let openPicker = null;
/** plot index -> {root, timer, progress, ready, iconKey} */
let plots = new Map();

/**
 * Swap a plot's drawing, but only when the drawing would actually change.
 *
 * `renderGarden` repaints four times a second and `setIcon` rebuilds the node
 * from a cloned template, so calling it unconditionally would be a fresh SVG
 * subtree per plot, sixteen times a second, for an identical result.
 *
 * @param {{icon:Element, iconKey?:string}} slot
 * @param {string} emoji
 */
function setPlotIcon(slot, emoji) {
  if (slot.iconKey === emoji) return;
  slot.iconKey = emoji;
  setIcon(slot.icon, emoji);
}

export function mountGarden(controller) {
  game = controller;
  grid = document.getElementById('garden-grid');
  summary = document.getElementById('garden-summary');
  if (!grid) return;

  game.events.on('garden-changed', () => renderGarden(controller, controller.now(), true));
  game.events.on('bought', (event) => {
    // Buying production changes every price in this panel.
    if (event.item.baseCost !== undefined) renderGarden(controller, controller.now(), true);
  });

  buildPlots(controller);
  renderGarden(controller, controller.now(), true);
}

function buildPlots(controller) {
  const count = controller.state.garden.plotCount;
  if (plots.size === count && grid.childElementCount === count) return;

  plots = new Map();
  fill(grid, Array.from({ length: count }, (_, index) => {
    const timer = el('span.plot-timer');
    const progress = el('span.plot-progress-fill');
    const root = el('button.plot', {
      type: 'button',
      dataset: { plot: String(index) },
      on: {
        click: () => onPlotTap(index, controller),
        pointerenter: (e) => plotTip(e.currentTarget, index, controller),
        pointerleave: hideTooltip,
      },
    }, [
      el('span.plot-icon'),
      el('span.plot-name'),
      timer,
      el('span.plot-progress', {}, [progress]),
    ]);

    plots.set(index, {
      root, timer, progress,
      icon: root.querySelector('.plot-icon'),
      iconKey: null,
      name: root.querySelector('.plot-name'),
    });
    return root;
  }));
}

export function renderGarden(controller, now, force = false) {
  if (!grid) return;

  // A forced rebuild replaced the plot nodes, so an open picker would be
  // detached. A routine throttled repaint must NOT close it: the panel refreshes
  // four times a second, and a menu that vanishes before the player's finger
  // reaches a seed is worse than no menu at all.
  if (force) {
    buildPlots(controller);
    closePicker();
  }

  const s = controller.state;
  const info = gardenSummary(s, now);

  // The one case where an open picker must go during a routine repaint: the plot
  // it is anchored to is no longer empty.
  if (openPicker && s.garden.plots[openPicker.index]) closePicker();

  if (summary) {
    summary.textContent = info.total === 0
      ? 'No plots yet'
      : `${info.ready} ready · ${info.growing} growing · ${info.empty} empty`;
  }

  for (let i = 0; i < s.garden.plotCount; i++) {
    const slot = plots.get(i);
    if (!slot) continue;
    const plot = s.garden.plots[i];
    paintPlot(slot, plotInfo(plot, now), controller, plot);
  }
}

function paintPlot(slot, info, controller, plot) {
  const { root } = slot;
  // The payout was fixed when the seed went in, so every figure here reads the
  // plot's own `lockedCps` rather than the live rate. Showing the current rate
  // would promise more than the harvest will actually deliver.
  const payout = info.seed ? seedYield(info.seed, plot?.lockedCps ?? 0) : 0;

  if (info.state === 'empty') {
    root.className = 'plot plot--empty';
    setPlotIcon(slot, '＋');
    slot.name.textContent = 'Empty';
    slot.timer.textContent = '';
    slot.progress.style.transform = 'scaleX(0)';
    root.setAttribute('aria-label', `Empty plot ${indexOfPlot(root) + 1}. Tap to plant.`);
    return;
  }

  if (info.state === 'unknown') {
    root.className = 'plot plot--broken';
    setPlotIcon(slot, '❓');
    slot.name.textContent = 'Unknown crop';
    slot.timer.textContent = 'tap to clear';
    slot.progress.style.transform = 'scaleX(0)';
    root.setAttribute('aria-label', 'A crop that no longer exists. Tap to clear the plot.');
    return;
  }

  if (info.state === 'ready') {
    root.className = 'plot plot--ready';
    setPlotIcon(slot, info.seed.icon);
    slot.name.textContent = info.seed.name;
    slot.timer.textContent = `+${fmt(payout)}`;
    slot.progress.style.transform = 'scaleX(1)';
    root.setAttribute('aria-label', `${info.seed.name}, ready. Tap to harvest for ${fmt(payout)} cookies.`);
    return;
  }

  root.className = 'plot plot--growing';
  setPlotIcon(slot, info.seed.icon);
  slot.name.textContent = info.seed.name;
  slot.timer.textContent = fmtDuration(info.remainingMs);
  slot.progress.style.transform = `scaleX(${info.progress.toFixed(3)})`;
  root.setAttribute('aria-label', `${info.seed.name}, ${fmtDuration(info.remainingMs)} remaining.`);
}

function onPlotTap(index, controller) {
  const current = controller.state.garden.plots[index];

  if (!current) return openSeedPicker(index, controller);

  if (current.seedId && plotInfo(current, controller.now()).state === 'ready') {
    controller.harvest(index);
    return;
  }

  if (current.seedId && plotInfo(current, controller.now()).state === 'unknown') {
    controller.harvest(index); // the harvest path clears an unreadable crop
    return;
  }

  // Growing: nothing to do, but say so rather than looking broken.
  hideTooltip();
  controller.events.emit('sound', 'deny');
}

function openSeedPicker(index, controller) {
  closePicker();

  const slot = plots.get(index);
  if (!slot) return;

  const s = controller.state;
  const cps = controller.derived.cps;

  const options = SEEDS.map((seed) => {
    const cost = seedCost(seed, cps);
    const yieldValue = seedYield(seed, cps);
    const affordable = s.cookies >= cost;

    return el('button.seed', {
      type: 'button',
      class: `seed${affordable ? '' : ' is-locked'}`,
      disabled: !affordable,
      on: {
        click: (e) => {
          e.stopPropagation();
          controller.plant(index, seed.id);
          closePicker();
        },
        pointerenter: (e) => showTooltip(e.currentTarget, {
          title: seed.name,
          icon: seed.icon,
          rows: [
            tipRow({ label: 'Grows in', value: fmtDuration(seed.growMs) }),
            tipRow({ label: 'Pays', value: fmt(yieldValue), tone: 'good' }),
            tipRow({ label: 'Costs', value: fmt(cost), tone: 'gold' }),
            tipRow({ label: 'Per hour', value: fmt(Math.floor((yieldValue / seed.growMs) * 3_600_000)) }),
            seed.buff ? tipRow({ label: 'Bonus', value: `×${seed.buff.mult} production for ${fmtDuration(seed.buff.durationMs)}`, tone: 'purple' }) : null,
          ],
          footer: seed.description,
        }),
        pointerleave: hideTooltip,
      },
    }, [
      el('span.seed-icon', { icon: seed.icon, 'aria-hidden': 'true' }),
      el('span.seed-body', {}, [
        el('span.seed-name', { text: seed.name }),
        el('span.seed-meta', { text: `${fmtDuration(seed.growMs)} · +${fmt(yieldValue)}` }),
      ]),
      el('span.seed-cost', { text: fmt(cost) }),
    ]);
  });

  const picker = el('div.seed-picker', {
    on: {
      // Stop a tap inside the picker from reaching the plot underneath it and
      // immediately closing what was just opened.
      click: (e) => e.stopPropagation(),
    },
  }, [
    el('div.seed-picker-title', { text: 'Choose a seed' }),
    ...options,
  ]);

  slot.root.append(picker);
  openPicker = { picker, index };

  // Dismiss on the next outside click, rather than binding a permanent listener
  // that would have to be removed and re-removed on every open.
  setTimeout(() => {
    const dismiss = (event) => {
      if (!picker.contains(event.target)) {
        closePicker();
        document.removeEventListener('pointerdown', dismiss, true);
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
  }, 0);
}

function closePicker() {
  if (!openPicker) return;
  openPicker.picker.remove();
  openPicker = null;
}

const indexOfPlot = (node) => Number(node.dataset.plot);

function plotTip(node, index, controller) {
  const info = plotInfo(controller.state.garden.plots[index], controller.now());
  if (info.state === 'empty') {
    showTooltip(node, {
      title: 'Empty plot',
      icon: '🌱',
      rows: [tipRow({ label: 'Production', value: `${fmtRate(controller.derived.cps)}/sec` })],
      footer: 'Seeds are priced from your production, so the garden scales with you.',
    });
    return;
  }
  if (info.state === 'unknown') {
    showTooltip(node, { title: 'Unreadable crop', icon: '❓', rows: ['This seed no longer exists. Tap to clear the plot.'] });
    return;
  }

  const locked = controller.state.garden.plots[index]?.lockedCps ?? 0;
  showTooltip(node, {
    title: info.seed.name,
    icon: info.seed.icon,
    subtitle: info.state === 'ready' ? 'Ready to harvest' : `${fmtDuration(info.remainingMs)} left`,
    rows: [
      tipRow({ label: 'Planted at', value: `${fmtRate(locked)}/sec` }),
      tipRow({ label: 'Pays', value: fmt(seedYield(info.seed, locked)), tone: 'good' }),
      info.seed.buff ? tipRow({ label: 'Bonus', value: `×${info.seed.buff.mult} for ${fmtDuration(info.seed.buff.durationMs)}`, tone: 'purple' }) : null,
    ],
    footer: info.seed.description,
  });
}
