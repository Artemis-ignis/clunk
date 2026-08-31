import Link from "./NativeLink";
import { Icon } from "./Icon";
import { getClunkSeriesCatalog } from "../../packages/clunk-series/src/catalog";
import type { ClunkSeriesDescriptor, ClunkSourceRecord } from "../../packages/clunk-series/src/contracts";

const SERIES_ROUTES: Record<ClunkSeriesDescriptor["id"], string> = {
  "asset-forge": "/studio",
  "sprite-lab": "/studio",
  "material-lab": "/studio",
  "motion-lab": "/studio",
  "game-ready": "/app",
  market: "/marketplace",
};

const AVAILABILITY_LABELS = {
  native: "CLUNK NATIVE",
  "research-only": "RESEARCH ONLY",
  planned: "PLANNED",
} as const;

export function ClunkSeriesCatalog({
  catalog = getClunkSeriesCatalog(),
  sources,
}: {
  catalog?: readonly ClunkSeriesDescriptor[];
  sources?: readonly ClunkSourceRecord[];
}) {
  return (
    <div className="series-grid" data-testid="clunk-series-catalog">
      {catalog.map((series, index) => {
        const sourceRecords = (sources ?? []).filter((source) => series.sourceRecordIds.includes(source.id));
        return (
          <article className={`series-card series-card-${series.id}`} key={series.id}>
            <div className="series-card-topline">
              <span className="series-card-index">0{index + 1}</span>
              <span className={`series-availability series-availability-${series.availability}`}>
                <i />
                {AVAILABILITY_LABELS[series.availability]}
              </span>
            </div>
            <div className="series-card-copy">
              <h3>{series.name}</h3>
              <p>{series.description}</p>
            </div>
            <div className="series-capability-list" aria-label={`${series.name} capabilities`}>
              {series.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
            </div>
            <div className="series-card-footer">
              <div className="series-source-chips" aria-label={`${series.name} source records`}>
                {sourceRecords.length > 0
                  ? sourceRecords.map((source) => (
                    <a key={source.id} href={source.repository} target="_blank" rel="noreferrer" className="series-source-chip">
                      {source.id}
                      <small>{source.license}</small>
                      <Icon name="arrowUpRight" size={12} />
                    </a>
                  ))
                  : <span className="series-source-chip series-source-chip-native">Clunk-owned surface</span>}
              </div>
              <Link className="text-link" href={SERIES_ROUTES[series.id]}>
                {series.id === "market" ? "카탈로그 열기" : series.id === "game-ready" ? "검사기 열기" : "작업면 열기"}
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
