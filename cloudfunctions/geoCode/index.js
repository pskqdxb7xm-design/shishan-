const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { lat, lng } = event;
  if (!lat || !lng) return { city: '', district: '' };

  try {
    const https = require('https');
    const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=zh';

    return new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': 'MiniProgram/1.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const addr = json.address || {};
            const city = (addr.city || addr.town || addr.county || addr.state || '').replace(/市|县/g, '');
            const district = addr.county || addr.district || '';
            resolve({ city: city, district: district.replace(/市|县|区/g, '') });
          } catch (e) {
            resolve({ city: '', district: '' });
          }
        });
      }).on('error', () => resolve({ city: '', district: '' }));
    });
  } catch (e) {
    return { city: '', district: '' };
  }
};
