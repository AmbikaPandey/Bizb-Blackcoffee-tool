const cache = new Map();

export async function lookupIFSC(ifsc) {
    if (!ifsc || ifsc.length !== 11 || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) return null;

    const code = ifsc.toUpperCase();
    if (cache.has(code)) return cache.get(code);

    try {
        const res = await fetch(`https://ifsc.razorpay.com/${code}`);
        if (!res.ok) return null;
        const data = await res.json();

        const result = {
            bank: data.BANK ? `${data.BANK}, ${data.BRANCH}` : '',
        };

        cache.set(code, result);
        return result;
    } catch {
        return null;
    }
}
