/**
 * The awards panel.
 *
 * Grouped by category rather than one flat list of thirty-nine, because the flat
 * list is unreadable and the groups are how a player decides what to go and do
 * next. Locked entries are shown, not hidden: a player who cannot tell that
 * "Green Thumb" exists has no reason to plant carrots.
 *
 * The summary is the part that earns its space. It states the running production
 * bonus in plain terms, because "+2% each" is a rule and "you are 47% faster
 * because of things you have already done" is a reason.
 *
 * All of the counting comes from `achievementSummary`, so the panel and the rules
 * layer cannot disagree about what is earned.
 */

import { ACHIEVEMENT_CPS_PER, MILESTONES } from '../../../shared/balance.js';
import { achievementSummary } from '../../../shared/achievements.js';
import { achievementMult } from '../../../shared/economy.js';
import { el, fill } from './dom.js';

let summary = null;
let list = null;

export function mountAwards(controller) {
  summary = document.getElementById('awards-summary');
  list = document.getElementById('awards-list');
  if (!list) return;

  controller.events.on('achievements', () => renderAwards(controller));
  renderAwards(controller);
}

export function renderAwards(controller) {
  if (!list) return;
  const view = achievementSummary(controller.state);

  if (summary) {
    fill(summary,
      el('div.awards-figure', {}, [
        el('span.awards-big', { text: String(view.got) }),
        el('span.awards-of', { text: `/ ${view.total} unlocked` }),
      ]),

      el('div.awards-bar', {
        role: 'progressbar',
        'aria-valuenow': String(view.pct),
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-label': `${view.got} of ${view.total} achievements unlocked`,
      }, [el('span.awards-bar-fill', { style: { width: `${view.pct}%` } })]),

      el('div.awards-mult', {
        text: `Production bonus from achievements: ×${achievementMult(view.got).toFixed(2)}`,
      }),

      el('div.awards-milestones', {}, MILESTONES.map((milestone) => {
        const earned = view.got >= milestone.count;
        const next = view.next?.count === milestone.count;
        return el('span.milestone', {
          class: earned ? 'is-earned' : (next ? 'is-next' : null),
          title: earned
            ? `Unlocked: ×${milestone.mult} production`
            : (next ? `Next milestone at ${milestone.count} achievements` : `Unlocks at ${milestone.count} achievements`),
        }, [
          // Split out from the string it used to live in: an emoji embedded in
          // a `text` value cannot be swapped for art, so the medal and the
          // caption are siblings now and the medal gets the `icon` treatment.
          el('span.milestone-icon', { icon: milestone.icon, 'aria-hidden': 'true' }),
          el('span.milestone-text', {
            text: `${milestone.label} ×${milestone.mult} at ${milestone.count}`,
          }),
        ]);
      })),

      el('div.awards-legend', {
        text: view.next
          ? `${view.earned.length} of ${MILESTONES.length} milestones earned · next: ${view.next.label} at ${view.next.count}`
          : `All ${MILESTONES.length} milestones earned`,
      }),
    );
  }

  fill(list, view.groups.map((group) => {
    const done = group.items.filter((item) => item.unlocked).length;
    return el('section.awards-group', {}, [
      el('h3.group-heading', {}, [
        group.label,
        el('span.group-count', { text: `${done}/${group.items.length}` }),
      ]),
      ...group.items.map((item) => awardRow(item, item.unlocked)),
    ]);
  }));
}

function awardRow(achievement, unlocked) {
  return el('div.award', { class: unlocked ? 'is-unlocked' : null }, [
    el('span.award-icon', { icon: unlocked ? achievement.icon : '🔒', 'aria-hidden': 'true' }),
    el('span.award-name', { text: achievement.name }),
    el('span.award-reward', { text: `+${ACHIEVEMENT_CPS_PER * 100}%` }),
  ]);
}
