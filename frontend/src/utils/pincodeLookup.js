const STATE_CODES = {
    'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
    'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02',
    'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23',
    'Maharashtra': '27', 'Manipur': '14', 'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13',
    'Odisha': '21', 'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33',
    'Telangana': '36', 'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05',
    'West Bengal': '19', 'Andaman and Nicobar Islands': '35', 'Chandigarh': '04',
    'Dadra and Nagar Haveli and Daman and Diu': '26', 'Delhi': '07', 'Jammu and Kashmir': '01',
    'Ladakh': '38', 'Lakshadweep': '31', 'Puducherry': '34',
};

const cache = new Map();

export async function lookupPincode(pincode) {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return null;

    if (cache.has(pincode)) return cache.get(pincode);

    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();

        if (!data?.[0] || data[0].Status !== 'Success' || !data[0].PostOffice?.length) return null;

        const po = data[0].PostOffice[0];
        const result = {
            city: po.District || '',
            state: po.State || '',
            state_code: STATE_CODES[po.State] || '',
        };

        cache.set(pincode, result);
        return result;
    } catch {
        return null;
    }
}
