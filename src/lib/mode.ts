/* Build-time data mode, kept free of imports so any module (middleware included) can read it. */
export const isMemoryMode = () => process.env.NEXT_PUBLIC_DATA_MODE === 'memory';
/** Public demo build (memory data, visitors enter without an account). */
export const isDemo = () => isMemoryMode() && process.env.NEXT_PUBLIC_DEMO === '1';
