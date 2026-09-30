import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { withOverall, tierLabel } from '../overall';
import { useCountUp } from '../lib/useCountUp';
import { fmtStat, fmtMoneyShort } from '../lib/formatters';
import { PlayerCard } from '../components/PlayerCard';
import { CoachingPanel } from '../components/CoachingPanel';
import { STAT_META } from '../data';
import type { Player } from '../types';

interface Props {
  vps: Player[];
  ams: Player[];
}

const VP_DISPLAY = ['appts','contracts','icp5','arip','dealReview','closedPct'];
const AM_DISPLAY = ['appts','icp5','arip','dealReviewLM','dealReviewLLM','closedPct'];

function pctColor(pct: number): string {
  if (pct >= 100) return '#1B6F5C';
  if (pct >= 75)  return '#1F507E';
  if (pct >= 50)  return '#8B6200';
  return '#8B3218';
}

export function Detail({ vps, ams }: Props) {
  const navigate = useNavigate();
  const { role, id } = useParams<{ role: string; id: string }>();
  const list = role === 'vp' ? vps : ams;
  const player = useMemo(() => {
    const found = list.find(p => p.id === id);
    return found ? withOverall(found) : null;
  }, [id, list]);

  const animOvr = Math.round(useCountUp(player?.overall ?? 0, 1200, [player?.id]));

  if (!player) {
    return (
      <section className="fade-up">
        <div className="section-head">
          <button className="back" onClick={() => navigate(`/roster/${role}`)}>← Back to roster</button>
        </div>
        <p style={{ color: 'var(--text-2)', marginTop: 24 }}>Player not found.</p>
      </section>
    );
  }

  const isVP = player.role.includes('Vice');
  const displayKeys = isVP ? VP_DISPLAY : AM_DISPLAY;
  const [first, ...rest] = player.name.split(' ');

  return (
    <section className="fade-up">
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="sub" style={{ marginBottom: 8 }}>
            {role === 'vp' ? 'Vice President' : 'Acquisition Manager'} · Player Card
          </div>
          <h2 style={{ fontSize: 36 }}><em>{first}</em> {rest.join(' ')}</h2>
        </div>
        <button className="back" onClick={() => navigate(`/roster/${role}`)}>← Back to roster</button>
      </div>

      <div className="stage">
        <div className="card-wrap">
          <PlayerCard player={player} compact />
        </div>

        <div className="detail">
          <div className="score-hero">
            <div className="score-hero-ovr">
              <span className="role-i">{tierLabel(player.tier)} · OVERALL</span>
              {player.overall > 0 ? (
                <div className="score-num">
                  {animOvr}
                  <span className="score-denom"> / 99</span>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
                  No targets loaded.<br />
                  <strong style={{ color: 'var(--text-2)' }}>Update your Apps Script and click Refresh.</strong>
                </div>
              )}
              <div className="score-label">weighted score · YTD 2026</div>
            </div>
            <div className="score-hero-stats">
              {[
                { label: 'Closed (Attr)', value: player.stats.closedRevAttr ?? 0 },
                { label: 'Closed (Qtr)',  value: player.stats.closedRevQtr  ?? 0 },
                { label: 'Pipeline',      value: player.stats.pipeline       ?? 0 },
              ].map(({ label, value }) => (
                <div className="score-hero-stat" key={label}>
                  <div className="sh-lbl">{label}</div>
                  <div className="sh-val">{fmtMoneyShort(value)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="kpi-grid">
            {displayKeys.map(k => {
              const meta = STAT_META[k];
              if (!meta) return null;
              const value = (player.stats as Record<string, number>)[k];
              if (value === undefined) return null;
              const bd = player.breakdown[k];
              const pct = bd ? Math.round(bd.ratio * 100) : null;
              const color = pct !== null ? pctColor(pct) : 'var(--text-3)';
              const label = k === 'appts'
                ? (isVP ? 'APPTs Attended' : 'APPTs Set')
                : meta.label;
              return (
                <div className="kpi-bubble" key={k}>
                  <div className="kpi-lbl">{label}</div>
                  <div className="kpi-val">{fmtStat(value, meta.kind)}</div>
                  {pct !== null ? (
                    <div className="kpi-foot">
                      <div className="kpi-track">
                        <div className="kpi-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                      </div>
                      <span className="kpi-pct" style={{ color }}>{pct}%</span>
                    </div>
                  ) : (
                    <div className="kpi-foot">
                      <span style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-3)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>tracking</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {player.overall > 0 && <CoachingPanel player={player} />}

          <p className="legend">
            Overall is a weighted score (0–100) based on each YTD metric vs its target from the Google Sheet.
            Weights and targets update automatically when you refresh live data.
            Each metric is capped at 100% of target.
          </p>
        </div>
      </div>
    </section>
  );
}
