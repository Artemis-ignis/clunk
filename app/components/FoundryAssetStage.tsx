import Image from "next/image";
import Link from "./NativeLink";
import { Icon } from "./Icon";
import { CLI_SAMPLE } from "./product-facts";

export function FoundryAssetStage() {
  return (
    <div className="foundry-asset-stage" aria-label="Clunk 실제 샘플 에셋 스테이지">
      <div className="foundry-stage-toolbar">
        <span>CLUNK / ASSET STAGE · TRACTOR / SHIPPED VISUAL SAMPLE</span>
        <strong>PUBLIC PREVIEW</strong>
      </div>
      <div className="foundry-stage-image">
        <Image
          src="/landing/tractor-hero.png"
          alt="Clunk가 검사하는 실제 3D 트랙터 샘플"
          width={900}
          height={610}
          priority
        />
      </div>
      <div className="foundry-stage-footer">
        <div>
          <strong>CORE EVIDENCE · {CLI_SAMPLE.file}</strong>
          <small>
            {CLI_SAMPLE.byteLength.toLocaleString()} B · sha256 {CLI_SAMPLE.inputHash.slice(0, 16)}…
          </small>
        </div>
        <div className="foundry-stage-verdict">
          <span>CONTRACT FIXTURE · SAMPLE · NOT FOR SALE</span>
          <b>{CLI_SAMPLE.score}/100 · STATIC PASS</b>
        </div>
      </div>
      <Link className="foundry-stage-open" href="/app" prefetch={false}>
        Game Ready evidence 열기 <Icon name="arrowUpRight" size={14} />
      </Link>
    </div>
  );
}
