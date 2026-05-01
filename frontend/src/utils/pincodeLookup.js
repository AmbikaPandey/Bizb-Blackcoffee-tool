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

// Approximate lat/lng for Indian states (centroid)
const STATE_COORDS = {
    'Andhra Pradesh': [15.9129, 79.74],
    'Arunachal Pradesh': [28.218, 94.7278],
    'Assam': [26.2006, 92.9376],
    'Bihar': [25.0961, 85.3131],
    'Chhattisgarh': [21.2787, 81.8661],
    'Goa': [15.2993, 74.124],
    'Gujarat': [22.2587, 71.1924],
    'Haryana': [29.0588, 76.0856],
    'Himachal Pradesh': [31.1048, 77.1734],
    'Jharkhand': [23.6102, 85.2799],
    'Karnataka': [15.3173, 75.7139],
    'Kerala': [10.8505, 76.2711],
    'Madhya Pradesh': [22.9734, 78.6569],
    'Maharashtra': [19.7515, 75.7139],
    'Manipur': [24.6637, 93.9063],
    'Meghalaya': [25.467, 91.3662],
    'Mizoram': [23.1645, 92.9376],
    'Nagaland': [26.1584, 94.5624],
    'Odisha': [20.9517, 85.0985],
    'Punjab': [31.1471, 75.3412],
    'Rajasthan': [27.0238, 74.2179],
    'Sikkim': [27.533, 88.5122],
    'Tamil Nadu': [11.1271, 78.6569],
    'Telangana': [18.1124, 79.0193],
    'Tripura': [23.9408, 91.9882],
    'Uttar Pradesh': [26.8467, 80.9462],
    'Uttarakhand': [30.0668, 79.0193],
    'West Bengal': [22.9868, 87.855],
    'Andaman and Nicobar Islands': [11.7401, 92.6586],
    'Chandigarh': [30.7333, 76.7794],
    'Dadra and Nagar Haveli and Daman and Diu': [20.1809, 73.0169],
    'Delhi': [28.7041, 77.1025],
    'Jammu and Kashmir': [33.7782, 76.5762],
    'Ladakh': [34.1526, 77.5771],
    'Lakshadweep': [10.5667, 72.6417],
    'Puducherry': [11.9416, 79.8083],
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
        const coords = STATE_COORDS[po.State];
        const result = {
            city: po.District || '',
            state: po.State || '',
            state_code: STATE_CODES[po.State] || '',
            district: po.District || '',
            latitude: coords ? coords[0] : null,
            longitude: coords ? coords[1] : null,
        };

        cache.set(pincode, result);
        return result;
    } catch {
        return null;
    }
}
