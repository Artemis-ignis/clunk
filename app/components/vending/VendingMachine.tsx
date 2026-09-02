"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "../NativeLink";
import { Icon } from "../Icon";
import { machineCountLabel, slotForKeypad, type VendingMachineData, type VendingSlot } from "./vending-catalog";

/** 뽑기 요청의 결과. 성공이면 실제 응답이 준 내려받기 주소가 함께 온다. */
export type DispenseOutcome =
  | { ok: true; title: string; slug: string; downloadUrl: string | null; note: string }
  | { ok: false; message: string; loginHref?: string };

type VendingMachineProps = {
  machine: VendingMachineData;
  /** 모바일에서 지금 보이는 기계인지. 데스크톱에서는 넉 대가 모두 보인다. */
  active: boolean;
  /** 크레딧 표시창에 뜨는 한 줄. 로그인 상태에 따라 홀이 정해서 내려 준다. */
  creditLine: string;
  reducedMotion: boolean;
  onDispense: (slot: VendingSlot) => Promise<DispenseOutcome>;
  /** 상품이 트레이에 닿는 순간 홀에 알린다(소리는 홀이 켜고 끈다). */
  onLanded: () => void;
};

type TrayItem = { key: string; code: string; title: string; slug: string; downloadUrl: string | null };

/** 나선이 도는 시간과 상품이 떨어지는 시간. 움직임 최소화 설정이면 둘 다 0이 된다. */
const TURN_MS = 520;
const DROP_MS = 420;

export function VendingMachine({ machine, active, creditLine, reducedMotion, onDispense, onLanded }: VendingMachineProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [keypad, setKeypad] = useState("");
  const [phase, setPhase] = useState<"idle" | "turning" | "dropping">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loginHref, setLoginHref] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const timers = useRef<number[]>([]);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const headingId = useId();
  const windowId = useId();

  useEffect(() => () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const selected = machine.slots.find((slot) => slot.code === selectedCode) ?? null;

  const select = useCallback((slot: VendingSlot) => {
    setSelectedCode(slot.code);
    setKeypad(slot.code.slice(machine.theme.code.length));
    setMessage(null);
    setLoginHref(null);
  }, [machine.theme.code]);

  function pressDigit(digit: string) {
    const next = (keypad.length >= 2 ? digit : keypad + digit).replace(/^0+(?=\d)/u, "");
    setKeypad(next);
    const slot = slotForKeypad(machine, next);
    if (slot) {
      setSelectedCode(slot.code);
      setMessage(null);
      setLoginHref(null);
    } else {
      setSelectedCode(null);
      setMessage(`${machine.theme.code}${next} 자리는 비어 있습니다.`);
    }
  }

  function clearKeypad() {
    setKeypad("");
    setSelectedCode(null);
    setMessage(null);
    setLoginHref(null);
  }

  /** 좌우·상하 화살표로 슬롯 사이를 옮겨 다닌다. 탭 이동은 브라우저가 이미 해 준다. */
  function onSlotKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (!step) return;
    event.preventDefault();
    const count = machine.slots.length;
    const next = (index + step + count) % count;
    slotRefs.current[next]?.focus();
  }

  async function dispense() {
    if (busy) return;
    if (!selected) {
      setMessage("먼저 유리창 안에서 뽑을 것을 고르거나, 키패드로 번호를 눌러 주세요.");
      return;
    }
    setBusy(true);
    setMessage("뽑는 중입니다…");
    setLoginHref(null);
    const outcome = await onDispense(selected);
    if (!outcome.ok) {
      setMessage(outcome.message);
      setLoginHref(outcome.loginHref ?? null);
      setBusy(false);
      return;
    }
    const land = () => {
      setPhase("idle");
      setTray((current) => [
        { key: `${selected.code}-${Date.now()}`, code: selected.code, title: outcome.title, slug: outcome.slug, downloadUrl: outcome.downloadUrl },
        ...current.filter((item) => item.slug !== outcome.slug),
      ].slice(0, 4));
      setMessage(outcome.note);
      setBusy(false);
      onLanded();
    };
    if (reducedMotion) {
      land();
      return;
    }
    setPhase("turning");
    timers.current.push(window.setTimeout(() => setPhase("dropping"), TURN_MS));
    timers.current.push(window.setTimeout(land, TURN_MS + DROP_MS));
  }

  return (
    <section
      className="vm"
      data-active={active ? "true" : "false"}
      data-phase={phase}
      style={{ "--vm-accent": machine.theme.accent } as React.CSSProperties}
      aria-labelledby={headingId}
    >
      <header className="vm-sign">
        <div>
          <h3 id={headingId}>{machine.theme.name}</h3>
          <p>{machine.theme.tagline}</p>
        </div>
        <span className="vm-sign-count">{machineCountLabel(machine)}</span>
      </header>

      <div className="vm-glass">
        <ul className="vm-slots" id={windowId} aria-label={`${machine.theme.name} 자판기 안에 든 에셋`}>
          {machine.slots.map((slot, index) => (
            <li key={slot.code}>
              <button
                type="button"
                className="vm-slot"
                aria-pressed={selectedCode === slot.code}
                ref={(node) => { slotRefs.current[index] = node; }}
                onClick={() => select(slot)}
                onKeyDown={(event) => onSlotKeyDown(event, index)}
              >
                <span className="vm-slot-art">
                  {slot.preview
                    ? <img src={slot.preview} alt="" width={280} height={280} loading="lazy" />
                    : <span className="vm-slot-noart" aria-hidden="true" />}
                  <span className="vm-slot-code">{slot.code}</span>
                </span>
                <b className="vm-slot-title">{slot.listing.title}</b>
                <span className="vm-slot-fact">{slot.fact}</span>
                <span className="vm-slot-price">
                  {slot.price.struck ? <s>{slot.price.struck}</s> : null}
                  <i>{slot.price.label}</i>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="vm-coil" aria-hidden="true"><span /></div>
        <div className="vm-drop" aria-hidden="true">
          {selected?.preview ? <img src={selected.preview} alt="" width={120} height={120} /> : <span className="vm-drop-box" />}
        </div>
      </div>

      <div className="vm-panel">
        <div className="vm-meter">
          <span className="vm-coinslot" aria-hidden="true"><i /></span>
          <span className="vm-meter-text">
            <small>크레딧 투입구</small>
            <b>{creditLine}</b>
          </span>
        </div>

        <div className="vm-keypad" role="group" aria-label={`${machine.theme.name} 자판기 번호 키패드`}>
          <output className="vm-readout" aria-live="off">
            {machine.theme.code}<em>{keypad || "–"}</em>
          </output>
          <div className="vm-keys">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((digit) => (
              <button type="button" key={digit} className="vm-key" onClick={() => pressDigit(digit)}>
                {digit}
              </button>
            ))}
            <button type="button" className="vm-key vm-key-wide" onClick={clearKeypad}>지우기</button>
          </div>
        </div>

        <button type="button" className="vm-dispense" onClick={() => void dispense()} disabled={busy}>
          {busy ? "뽑는 중…" : "뽑기"}
          <span>{selected ? `${selected.code} · ${selected.listing.title}` : "고른 것 없음"}</span>
        </button>
      </div>

      <div className="vm-tray" data-lit={tray.length > 0 ? "true" : "false"} role="status" aria-live="polite">
        <span className="vm-tray-label">배출구</span>
        {message ? (
          <p className="vm-tray-message">
            {message}
            {loginHref ? <> <Link href={loginHref} prefetch={false}>로그인하러 가기</Link></> : null}
          </p>
        ) : null}
        {tray.length === 0 && !message ? <p className="vm-tray-empty">아직 아무것도 떨어지지 않았습니다.</p> : null}
        <ul className="vm-tray-items">
          {tray.map((item) => (
            <li className="vm-tray-item" key={item.key}>
              <b>{item.code} · {item.title}</b>
              <span>
                {item.downloadUrl
                  ? <a className="vm-tray-get" href={item.downloadUrl}>받기 <Icon name="download" size={13} /></a>
                  : null}
                <Link className="vm-tray-page" href={`/marketplace/${encodeURIComponent(item.slug)}`} prefetch={false}>
                  상품 페이지 <Icon name="arrowRight" size={13} />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
