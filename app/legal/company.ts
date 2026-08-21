/**
 * Single source for the operator disclosures Korean e-commerce law requires
 * (전자상거래법 제10조). Every field is null until the operator actually registers a
 * business — the pages render "사업자 등록 후 기재" rather than a plausible-looking
 * placeholder, because a fake registration number on a live page is worse than an
 * obviously missing one.
 *
 * Filling these in is the last step before charging money: set the values here and the
 * disclosure block on every legal page updates at once.
 */
export type CompanyInfo = {
  /** 상호 (법인명 또는 개인사업자 상호) */
  legalName: string | null;
  /** 대표자 성명 */
  representative: string | null;
  /** 사업자등록번호 */
  businessNumber: string | null;
  /** 통신판매업 신고번호 */
  mailOrderNumber: string | null;
  /** 사업장 주소 */
  address: string | null;
  /** 고객 문의 전화 */
  phone: string | null;
  /** 고객 문의 이메일 — 유일하게 지금 확정된 값 */
  email: string;
  /** 개인정보 보호책임자 */
  privacyOfficer: string | null;
};

export const COMPANY: CompanyInfo = {
  legalName: null,
  representative: null,
  businessNumber: null,
  mailOrderNumber: null,
  address: null,
  phone: null,
  email: "jyp201333@gmail.com",
  privacyOfficer: null,
};

/** 유료 판매를 시작할 수 있는 상태인지. 하나라도 비면 false. */
export const CAN_SELL =
  COMPANY.legalName !== null &&
  COMPANY.representative !== null &&
  COMPANY.businessNumber !== null &&
  COMPANY.address !== null;

/** 문서 개정일 — 내용이 바뀌면 함께 올린다. */
export const LEGAL_REVISION = "2026-08-21";

export const PROCESSORS = [
  {
    name: "Cloudflare, Inc.",
    role: "서비스 실행 인프라 및 데이터베이스(D1) 운영",
    location: "미국 등 글로벌 리전",
  },
  {
    name: "GitHub, Inc.",
    role: "GitHub 계정 로그인 사용 시 본인 확인",
    location: "미국",
  },
  {
    name: "OpenAI, L.L.C.",
    role: "ChatGPT Sites 호스팅 및 로그인 인증 처리",
    location: "미국",
  },
] as const;
