const fs = require('fs');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

// Assina o elemento <infNFe> do XML NF-e usando arquivo PFX (.p12/.pfx)
// Uso: configure config.example.json (pfxPath e pfxPassword) e coloque nfe_unnsigned.xml gerado

const cfg = require('./config.example.json');

function loadPfx(pfxPath, password) {
  const pfxBuff = fs.readFileSync(pfxPath);
  const pfxDer = forge.util.createBuffer(pfxBuff.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  let keyObj = null;
  let certObj = null;

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
        keyObj = safeBag.key;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        certObj = safeBag.cert;
      }
    }
  }

  if (!keyObj || !certObj) throw new Error('Não foi possível extrair chave e certificado do PFX');

  const privateKeyPem = forge.pki.privateKeyToPem(keyObj);
  const certPem = forge.pki.certificateToPem(certObj);
  const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\r|\n/g, '');
  return { privateKeyPem, certPem, certBase64 };
}

function signXml(xml, privateKeyPem, certBase64) {
  const sig = new SignedXml();
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.addReference("//*[local-name()='infNFe']", [
    "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
    "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
  ], 'http://www.w3.org/2001/04/xmlenc#sha256');

  sig.signingKey = privateKeyPem;
  sig.keyInfoProvider = {
    getKeyInfo: function () {
      return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
    }
  };

  // Inserir a assinatura imediatamente após o elemento infNFe
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name()='infNFe']", action: 'after' }
  });
  return sig.getSignedXml();
}

(async () => {
  try {
    const pfxPath = cfg.pfxPath;
    const pfxPassword = cfg.pfxPassword;
    if (!fs.existsSync(pfxPath)) {
      console.error('Arquivo PFX não encontrado em', pfxPath);
      process.exit(1);
    }

    const rawXml = fs.readFileSync('nfe_unnsigned.xml', 'utf8');
    const { privateKeyPem, certPem, certBase64 } = loadPfx(pfxPath, pfxPassword);
    const signed = signXml(rawXml, privateKeyPem, certBase64);

    fs.writeFileSync('nfe_signed.xml', signed, 'utf8');
    console.log('XML assinado gerado: nfe_signed.xml');
  } catch (err) {
    console.error('Erro ao assinar XML:', err);
    process.exit(1);
  }
})();
