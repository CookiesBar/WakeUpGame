// AlarmKit wants UUIDs. Derive them from the key, so cancelling needs no stored ids.
export const alarmKitId = (key: string, link: number): string => {
    const s = `${key}#${link}`;
    let hex = '';
    for (let seed = 0; seed < 4; seed++) {
        let h = 0x811c9dc5 ^ seed; // FNV-1a, one 32-bit lane per seed
        for (let c = 0; c < s.length; c++) h = Math.imul(h ^ s.charCodeAt(c), 0x01000193);
        hex += (h >>> 0).toString(16).padStart(8, '0');
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
