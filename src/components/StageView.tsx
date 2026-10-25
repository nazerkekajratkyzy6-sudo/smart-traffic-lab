import { SimCanvas, SimFrame, ViewBox } from './SimCanvas';
import type { Network } from '../core/network';
import { PHASES } from '../core/network';
import { fmtTime } from '../lib/format';

const STAGE = { green: 'жасыл', yellow: 'сары', allred: 'бәрі қызыл' } as Record<string, string>;
const SHORT_PHASE = ['негізгі: тура', 'негізгі: солға', 'қосалқы: тура', 'қосалқы: солға'];

export function StageView({
  net,
  frame,
  view,
  title,
  color,
  t,
  duration,
  maxHeight,
  showScores,
  showLabels = true,
}: {
  net: Network;
  frame: SimFrame;
  view: ViewBox;
  title: string;
  color?: string;
  t: number;
  duration: number;
  maxHeight?: number;
  showScores?: boolean;
  showLabels?: boolean;
}) {
  return (
    <div className="stage">
      <div className="stage-bar">
        <span className="stage-title">
          {color && <span className="dot" style={{ background: color }} />}
          {title}
        </span>
        <span className="spacer" />
        <span className="chip" title="Модельдік уақыт">
          {fmtTime(t)} / {fmtTime(duration)}
        </span>
      </div>
      <SimCanvas net={net} frame={frame} view={view} title={`${title}: жол желісінің шартты схемасы`} maxHeight={maxHeight} showLabels={showLabels} />
      <div className="stage-foot">
        {frame.views.map((jv) => (
          <span key={jv.id} className="chip" title={PHASES[jv.phase]?.name}>
            {net.junctions.length > 1 ? `${jv.id.replace('J', '')}-қиылыс: ` : ''}
            {SHORT_PHASE[jv.phase]} · {STAGE[jv.stage]} {Math.floor(jv.stageTime)} с
            {showScores && jv.scores ? ` · S = [${jv.scores.map((x) => x.toFixed(1)).join('; ')}]` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i style={{ background: '#1f9d55' }} />
        жасыл — жүруге болады
      </span>
      <span>
        <i style={{ background: '#d33a2c' }} />
        қызыл — тоқта
      </span>
      <span>
        <i style={{ background: '#e5352a', width: 8 }} />
        жанған артқы шам — көлік тоқтап тұр
      </span>
      <span>
        <i style={{ background: '#1769aa' }} />
        жүк көлігі
      </span>
      <span>
        <i style={{ background: '#9a5b00', borderRadius: 6 }} />
        «+N» — кіре алмай күтіп тұрған көлік
      </span>
    </div>
  );
}
