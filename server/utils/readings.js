export const slotOrder = "CASE slot WHEN 'morning' THEN 1 WHEN 'breakfast' THEN 2 WHEN 'lunch' THEN 3 ELSE 4 END";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slotTitle(slot) {
  return ({ morning: 'Morning', breakfast: 'After breakfast', lunch: 'After lunch', dinner: 'After dinner' })[slot] || slot;
}
