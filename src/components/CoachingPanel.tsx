import { useMemo } from 'react';
import { coach } from '../coaching';
import type { PlayerWithOverall } from '../types';

interface Props {
  player: PlayerWithOverall;
}

export function CoachingPanel({ player }: Props) {
  const c = useMemo(() => coach(player), [player]);
  const first = player.name.split(' ')[0];

  return (
    <div className="coach">
      <div className="coach-head">
        <span className="coach-kicker">How {first} improves</span>
        {c.nextTier && c.focus.length > 0 && (
          <span className="coach-tier">
            {c.nextTier.pointsNeeded} pts to {c.nextTier.label}
          </span>
        )}
      </div>

      <p className="coach-headline">{c.headline}</p>

      {c.focus.length > 0 && (
        <ol className="coach-list">
          {c.focus.map((item, i) => (
            <li className="coach-item" key={item.key}>
              <span className="coach-rank">{i + 1}</span>
              <div className="coach-body">
                <div className="coach-title">
                  <span>{item.title}</span>
                  <span className="coach-pts">+{item.points} pts</span>
                </div>
                <div className="coach-action">{item.action}</div>
                {item.detail && <div className="coach-detail">{item.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {c.watch.length > 0 && (
        <div className="coach-watch">
          <span className="coach-sub">Also worth</span>
          {c.watch.map(w => (
            <span className="coach-chip" key={w.key}>
              {w.title} <b>+{w.points}</b>
            </span>
          ))}
        </div>
      )}

      {c.strengths.length > 0 && (
        <div className="coach-strengths">
          <span className="coach-sub">At target</span>
          {c.strengths.map(s => (
            <span className="coach-chip ok" key={s}>{s}</span>
          ))}
        </div>
      )}

      {c.notes.length > 0 && (
        <div className="coach-notes">
          <span className="coach-sub">Manager notes</span>
          <ul>
            {c.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {c.focus.length > 0 && (
        <div className="coach-foot">
          Hit the top {c.focus.length === 1 ? 'item' : `${c.focus.length} items`} → about <b>{c.potential}</b> overall.
          Updates automatically when the sheet refreshes.
        </div>
      )}
    </div>
  );
}
