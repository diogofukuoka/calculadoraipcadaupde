import https from 'https';

https.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json', (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', () => {});
  res.on('end', () => console.log('Finished'));
}).on('error', (e) => {
  console.error(e);
});
