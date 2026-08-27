const fs = require('fs');
const axios = require('axios');
const cfg = require('./config.example.json');

// Transmissão simples do XML assinado para o serviço de autorização (NFeAutorizacao)
// Atenção: endpoints variam por UF e ambiente — configurar endpointAutorizacao corretamente.
// Para produção em MG configure o endpoint oficial da SEFAZ-MG. Testar primeiro em homologação.

async function transmit(signedXml) {
  // Monta envelope SOAP simples com nfeDadosMsg
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>\n<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:nfe=\"http://www.portalfiscal.inf.br/nfe\">\n  <soapenv:Header/>\n  <soapenv:Body>\n    <nfe:nfeDadosMsg>\n      ${escapeXmlForSoap(signedXml)}\n    </nfe:nfeDadosMsg>\n  </soapenv:Body>\n</soapenv:Envelope>`;

  const url = cfg.endpointAutorizacao;
  if (!url || url.includes('SEFAZ_ENDPOINT_AQUI')) {
    console.error('Configure o endpointAutorizacao no config.example.json para o serviço NFeAutorizacao da UF e ambiente escolhidos');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': ''
  };

  const res = await axios.post(url, soapEnvelope, { headers, timeout: 60000 });
  return res.data;
}

function escapeXmlForSoap(xml) {
  // Algumas integrações colocam o XML diretamente; para evitar problemas de parsing no exemplo, tira quebras
  return xml.replace(/\r?\n/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  try {
    const signedPath = 'nfe_signed.xml';
    if (!fs.existsSync(signedPath)) {
      console.error('Arquivo assinado não encontrado. Execute primeiro: npm run sign');
      process.exit(1);
    }
    const signedXml = fs.readFileSync(signedPath, 'utf8');
    console.log('Transmitindo para:', cfg.endpointAutorizacao);
    const result = await transmit(signedXml);
    fs.writeFileSync('transmit_response.xml', result, 'utf8');
    console.log('Resposta gravada em transmit_response.xml');
  } catch (err) {
    console.error('Erro na transmissão:', err.message || err);
    if (err.response) console.error(err.response.data);
    process.exit(1);
  }
})();
