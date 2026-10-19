const values = new Map();
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 1;
export const getItemAsync = async key => values.get(key) ?? null;
export const setItemAsync = async (key, value) => { values.set(key, value); };
export const deleteItemAsync = async key => { values.delete(key); };
