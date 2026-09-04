-- 접근 등급 지정 (2026-09-04)
--
-- 낱개 판매를 없애고 구독 접근권으로 바꾸면서, 리스팅마다 어느 등급인지 적는다.
-- 기준: 폴리곤 3,000 미만 3D 와 텍스처·스프라이트 시트는 무료. 그 밖은 구독 전용.
-- 값은 app/data/listing-facts.json 의 실측 폴리곤 수에서 나왔다.
--
-- 낱개로 청구하는 값이 더는 없으므로 price_cents 도 0 으로 통일한다.
-- 아무도 청구하지 않는 가격이 남아 있으면 화면이 거짓을 말하게 된다.

UPDATE clunk_marketplace_listings SET access_tier = 'free', price_cents = 0;

-- 구독 전용 11건
UPDATE clunk_marketplace_listings SET access_tier = 'pro' WHERE slug IN (
  'clunk-heli-h145',
  'cozy-farm-set-vol1',
  'cozy-greenhouse',
  'grove-tree-pack-vol1',
  'hf-barn',
  'hf-cultivator-compact',
  'hf-farmhouse',
  'hf-player-farmhand',
  'hf-processing-line',
  'hf-seeder-compact',
  'hf-tractor-compact'
);
