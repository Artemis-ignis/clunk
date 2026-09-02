UPDATE clunk_marketplace_listings SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP WHERE slug = 'cozy-tractor' AND status = 'DRAFT';
