-- 2026-09-04: 운영자 지적 — "경운기"는 트랙터 뒤에 거는 부착 작업기이지 경운기(동력 경운기)가 아니다.
-- 이름이 물건과 다르면 산 사람이 속는다. 실제 물건 이름으로 바꾼다.
UPDATE clunk_marketplace_listings SET title = '경운 작업기' WHERE slug = 'hf-cultivator-compact';
UPDATE clunk_marketplace_listings SET title = '파종 작업기' WHERE slug = 'hf-seeder-compact';
UPDATE clunk_marketplace_listings
SET description = '트랙터 뒤에 걸어 밭을 가는 경운 작업기입니다. 단독 장비가 아니라 트랙터에 매다는 부착 작업기이고, 링크 자리에 이름이 붙어 있어 소형 트랙터에 그대로 걸립니다. 게임에서 밭을 갈 때의 움직임이 애니메이션으로 파일 안에 들어 있어, 땅을 짚는 게이지 휠이 구르고 갈퀴가 흙에 눌려 흔들립니다. 움직이는 내내 바닥 아래로 파고들지 않게 높이를 맞춰 두었습니다.'
WHERE slug = 'hf-cultivator-compact';
UPDATE clunk_marketplace_listings
SET description = '씨앗 통을 얹고 줄뿌림하는 파종 작업기입니다. 단독 장비가 아니라 트랙터에 매다는 부착 작업기이고, 소형 트랙터와 같은 손맛으로 만들어 나란히 두면 한 세트로 보입니다. 게임에서 씨를 뿌릴 때의 움직임이 애니메이션으로 파일 안에 들어 있어, 골을 째는 원판과 게이지 휠, 흙을 덮는 바퀴가 굴러가고 씨앗 계량 축이 함께 돌아갑니다.'
WHERE slug = 'hf-seeder-compact';
