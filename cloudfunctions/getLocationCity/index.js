const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { lat, lng } = event;
  if (!lat || !lng) return { city: '全国' };

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
            const city = (addr.city || addr.town || addr.county || addr.state || '全国').replace(/市|县/g, '');
            resolve({ city: city || '全国' });
          } catch (e) {
            resolve({ city: '全国' });
          }
        });
      }).on('error', () => resolve({ city: '全国' }));
    });
  } catch (e) {
    return { city: '全国' };
  }
};
